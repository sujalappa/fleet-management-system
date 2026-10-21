import { getProjectModel } from "../../model/index.js";
import { listProjects } from "../../projects/index.js";
import { isVolvoConfigured, field, getStatusesSince, getPositionsSince } from "./client.js";

// Volvo's accumulated data arrives hourly and on ignition on/off; its docs
// recommend polling about every 15 minutes.
const POLL_INTERVAL_MS = 15 * 60 * 1000;
// rFMS rejects starttime older than 14 days.
const MAX_LOOKBACK_MS = 13.9 * 24 * 60 * 60 * 1000;

const ml = (v) => (v == null ? undefined : v / 1000);
const num = (v) => (v == null ? undefined : Number(v));

const gnssOf = (obj) => field(obj, "gnssPosition");

async function getVolvoVehiclesByProject() {
  const groups = [];
  for (const project of listProjects()) {
    const Vehicle = getProjectModel(project.projectId, "Vehicle");
    const vehicles = await Vehicle.find({ data_source: "volvo_live", chassis_number: { $ne: null } }).lean();
    if (vehicles.length) groups.push({ projectId: project.projectId, vehicles });
  }
  return groups;
}

// Resume from the newest record already stored; first run backfills the
// full 14 days Volvo keeps.
function cursorFrom(latest) {
  const floor = new Date(Date.now() - MAX_LOOKBACK_MS);
  return latest && latest > floor ? new Date(latest.getTime() + 1000) : floor;
}

async function ingestStatuses(projectId, byVin) {
  const VehicleStatus = getProjectModel(projectId, "VehicleStatus");
  const GPSLog = getProjectModel(projectId, "GPSLog");
  const FuelLog = getProjectModel(projectId, "Fuel");

  const latest = await VehicleStatus.findOne({ chassis_number: { $in: [...byVin.keys()] } })
    .sort({ received_at: -1 })
    .lean();
  const reports = await getStatusesSince(cursorFrom(latest?.received_at));

  let stored = 0;
  for (const r of reports) {
    const vin = field(r, "vin");
    const vehicle = byVin.get(vin);
    if (!vehicle) continue;

    const created = new Date(field(r, "createdDateTime"));
    const trigger = field(field(r, "triggerType"), "triggerType");
    const externalRef = `${vin}:${field(r, "createdDateTime")}:${trigger}`;
    const acc = field(r, "accumulatedData") || {};

    const result = await VehicleStatus.updateOne(
      { external_ref: externalRef },
      {
        $setOnInsert: {
          vehicle_id: vehicle.vehicle_id,
          chassis_number: vin,
          trigger_type: trigger,
          created_at_vehicle: created,
          received_at: new Date(field(r, "receivedDateTime")),
          odometer_km: ml(field(r, "hrTotalVehicleDistance")),
          engine_hours: num(field(r, "totalEngineHours")),
          total_fuel_used_liters: ml(field(r, "engineTotalFuelUsed")),
          gross_combination_weight_kg: num(field(r, "grossCombinationVehicleWeight")),
          moving_seconds: num(field(acc, "durationWheelbaseSpeedOverZero")),
          moving_fuel_liters: ml(field(acc, "fuelWheelbaseSpeedOverZero")),
          idle_seconds: num(field(acc, "durationWheelbaseSpeedZero")),
          idle_fuel_liters: ml(field(acc, "fuelWheelbaseSpeedZero")),
          // Full report kept — its *Class histograms (speed, RPM, braking,
          // PTO...) feed the Fuel & Performance metrics.
          raw_data: r,
          source: "telematics",
          external_ref: externalRef
        }
      },
      { upsert: true }
    );
    stored += result.upsertedCount;

    // Snapshot block (position, fuel level) only arrives if the trucks'
    // subscription includes it — written automatically when it does.
    const snap = field(r, "snapshotData");
    const gnss = gnssOf(snap);
    if (gnss && field(gnss, "latitude") != null) {
      await GPSLog.updateOne(
        { external_ref: `${externalRef}:snap` },
        {
          $setOnInsert: {
            vehicle_id: vehicle.vehicle_id,
            chassis_number: vin,
            latitude: field(gnss, "latitude"),
            longitude: field(gnss, "longitude"),
            direction: field(gnss, "heading"),
            altitude: field(gnss, "altitude"),
            speed: field(snap, "wheelBasedSpeed") ?? field(gnss, "speed"),
            device_timestamp: new Date(field(gnss, "positionDateTime") || created),
            source: "telematics",
            external_ref: `${externalRef}:snap`
          }
        },
        { upsert: true }
      );
    }
    if (snap && field(snap, "fuelLevel1") != null) {
      await FuelLog.updateOne(
        { external_ref: `${externalRef}:snap` },
        {
          $setOnInsert: {
            vehicle_id: vehicle.vehicle_id,
            chassis_number: vin,
            fuel_percentage: field(snap, "fuelLevel1"),
            odometer_km: ml(field(r, "hrTotalVehicleDistance")),
            engine_hours: num(field(r, "totalEngineHours")),
            device_timestamp: created,
            source: "telematics",
            external_ref: `${externalRef}:snap`
          }
        },
        { upsert: true }
      );
    }
  }
  return { fetched: reports.length, stored };
}

async function ingestPositions(projectId, byVin) {
  const GPSLog = getProjectModel(projectId, "GPSLog");
  const latest = await GPSLog.findOne({ chassis_number: { $in: [...byVin.keys()] } })
    .sort({ device_timestamp: -1 })
    .lean();
  const positions = await getPositionsSince(cursorFrom(latest?.device_timestamp));

  for (const p of positions) {
    const vin = field(p, "vin");
    const vehicle = byVin.get(vin);
    const gnss = gnssOf(p);
    if (!vehicle || !gnss) continue;

    const externalRef = `${vin}:${field(p, "createdDateTime")}:pos`;
    await GPSLog.updateOne(
      { external_ref: externalRef },
      {
        $setOnInsert: {
          vehicle_id: vehicle.vehicle_id,
          chassis_number: vin,
          latitude: field(gnss, "latitude"),
          longitude: field(gnss, "longitude"),
          direction: field(gnss, "heading"),
          altitude: field(gnss, "altitude"),
          speed: field(p, "wheelBasedSpeed") ?? field(gnss, "speed"),
          device_timestamp: new Date(field(gnss, "positionDateTime") || field(p, "createdDateTime")),
          source: "telematics",
          external_ref: externalRef
        }
      },
      { upsert: true }
    );
  }
  return positions.length;
}

// Copies each truck's newest totals onto its Vehicle document, so the rest
// of the app reads odometer / hours / fuel without touching status history.
async function refreshVehicleTotals(projectId, vehicles) {
  const Vehicle = getProjectModel(projectId, "Vehicle");
  const VehicleStatus = getProjectModel(projectId, "VehicleStatus");
  for (const v of vehicles) {
    const s = await VehicleStatus.findOne({ vehicle_id: v.vehicle_id }).sort({ created_at_vehicle: -1 }).lean();
    if (!s) continue;
    await Vehicle.updateOne(
      { vehicle_id: v.vehicle_id },
      {
        $set: {
          ...(s.odometer_km != null && { total_odometer_km: Math.round(s.odometer_km) }),
          ...(s.engine_hours != null && { total_engine_hours: Math.round(s.engine_hours * 10) / 10 }),
          ...(s.total_fuel_used_liters != null && { total_fuel_used_liters: Math.round(s.total_fuel_used_liters) })
        }
      }
    );
  }
}

async function pollVolvo() {
  for (const { projectId, vehicles } of await getVolvoVehiclesByProject()) {
    const byVin = new Map(vehicles.map((v) => [v.chassis_number, v]));
    try {
      const { fetched, stored } = await ingestStatuses(projectId, byVin);
      const positions = await ingestPositions(projectId, byVin);
      await refreshVehicleTotals(projectId, vehicles);
      console.log(
        `[Volvo] ${projectId}: ${fetched} status report(s) fetched, ${stored} new; ${positions} position(s)`
      );
    } catch (error) {
      console.error(`[Volvo] ${projectId} poll failed:`, error.message);
    }
  }
}

let started = false;

// Inert unless Volvo credentials are set and at least one vehicle has
// data_source "volvo_live" — safe to call unconditionally from index.js.
export async function startVolvoPoller() {
  if (started) return;
  if (!isVolvoConfigured()) {
    console.log("[Volvo] VOLVO_API_USERNAME/PASSWORD not set — Volvo poller stays off.");
    return;
  }
  const groups = await getVolvoVehiclesByProject();
  const count = groups.reduce((sum, g) => sum + g.vehicles.length, 0);
  if (count === 0) {
    console.log('[Volvo] No vehicles with data_source "volvo_live" yet — Volvo poller stays off.');
    return;
  }

  started = true;
  console.log(`[Volvo] Starting poller for ${count} truck(s), every ${POLL_INTERVAL_MS / 60000} min.`);

  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await pollVolvo();
    } finally {
      running = false;
    }
  };
  tick();
  setInterval(tick, POLL_INTERVAL_MS);
}
