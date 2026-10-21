import { getProjectModel } from "../../model/index.js";
import { listProjects, getProjectConfig } from "../../projects/index.js";

/**
 * Detects haul trips from GPS by geofence: a truck last seen inside the
 * LOADING zone and next seen inside the DUMP zone has done one loaded trip.
 *
 *  - loading_minutes   = first → last GPS point inside the loading zone
 *  - start_time        = last point inside the loading zone (departure)
 *  - end_time          = first point inside the dump zone (arrival)
 *  - haul_minutes      = departure → arrival (loaded leg)
 *  - unloading_minutes = first → last point inside the dump zone
 *  - return_minutes    = leaving the dump → next arrival at loading
 *  - cycle_time        = this departure → the truck's next departure
 *  - distance_km       = odometer difference over the loaded leg
 *
 * Resting in the loading zone (shift change, breaks) never creates a trip —
 * only reaching the dump does. Runs over a rolling window and upserts by a
 * stable external_ref, so re-running never duplicates trips.
 *
 * Limitation: GPS arrives roughly once a minute (Eicher). A truck that spends
 * less time inside a zone than the gap between two GPS points can be missed —
 * widen the zone radius in the project config if trips go uncounted.
 */
const RUN_INTERVAL_MS = 2 * 60 * 1000;
const WINDOW_MS = 48 * 60 * 60 * 1000;
// A loaded leg longer than this means the device went silent in between
// (e.g. 16:15 in loading → 19:43 at the dump, 42 km on the odometer = ~7 real
// trips, not one) — such a pair is a data gap, not a trip. The haul road is
// ~2.8 km, so real loaded legs are well inside both limits.
const MAX_HAUL_MINUTES = 45;
const MAX_HAUL_KM = 8;
// Longer than this between departures = a break or a data gap, not a cycle.
const MAX_CYCLE_MINUTES = 120;

function distanceMeters(lat1, lng1, lat2, lng2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

// The project config is the source of truth for geofences; mirror it into
// the Geofence collection so the map and API serve the same zones.
export async function syncGeofences(projectId) {
  const config = getProjectConfig(projectId);
  const Geofence = getProjectModel(projectId, "Geofence");
  const ids = [];
  for (const g of config.geofences || []) {
    ids.push(g.id);
    await Geofence.updateOne(
      { geofence_id: g.id },
      {
        $set: {
          name: g.name,
          zone_type: g.zoneType,
          latitude: g.center.lat,
          longitude: g.center.lng,
          radius_meters: g.radiusMeters,
          status: "active"
        }
      },
      { upsert: true }
    );
  }
  await Geofence.updateMany({ geofence_id: { $nin: ids } }, { $set: { status: "inactive" } });
}

function zoneOf(point, zones) {
  for (const z of zones) {
    if (distanceMeters(point.latitude, point.longitude, z.latitude, z.longitude) <= z.radius_meters) return z;
  }
  return null;
}

const minutesBetween = (a, b) => Math.round(((b - a) / 60000) * 10) / 10;

// Collapses a GPS track into zone visits: consecutive points inside the same
// zone form one visit (entered = first point, left = last point). A visit is
// "open" while the truck's newest point is still inside the zone.
function zoneVisits(points, zones) {
  const visits = [];
  let current = null;
  for (const p of points) {
    const zone = zoneOf(p, zones);
    if (current && zone === current.zone) {
      current.last = p;
      continue;
    }
    if (current) current.open = false;
    current = zone ? { zone, first: p, last: p, open: true } : null;
    if (current) visits.push(current);
  }
  return visits;
}

async function detectForVehicle(projectId, vehicle, loading, dump) {
  const GPSLog = getProjectModel(projectId, "GPSLog");
  const Trip = getProjectModel(projectId, "Trip");

  const since = new Date(Date.now() - WINDOW_MS);
  const points = await GPSLog.find(
    { vehicle_id: vehicle.vehicle_id, device_timestamp: { $gte: since } },
    { latitude: 1, longitude: 1, device_timestamp: 1, odometer_km: 1 }
  )
    .sort({ device_timestamp: 1 })
    .lean();

  const visits = zoneVisits(points, [loading, dump]);
  const validRefs = [];
  let found = 0;

  // A trip = a loading visit immediately followed by a dump visit. Two
  // loading visits in a row (left the zone and came back without dumping)
  // only count the later one.
  for (let i = 0; i < visits.length - 1; i++) {
    const load = visits[i];
    const dumpVisit = visits[i + 1];
    if (load.zone !== loading || dumpVisit.zone !== dump || load.open) continue;

    const leftLoading = load.last.device_timestamp;
    const reachedDump = dumpVisit.first.device_timestamp;
    const leftDump = dumpVisit.open ? null : dumpVisit.last.device_timestamp;
    const nextLoad = visits[i + 2]?.zone === loading ? visits[i + 2] : null;
    const externalRef = `${vehicle.vehicle_id}:${leftLoading.toISOString()}`;
    const odoStart = load.last.odometer_km;
    const odoEnd = dumpVisit.first.odometer_km;
    const legKm = odoStart != null && odoEnd != null ? odoEnd - odoStart : null;
    if (minutesBetween(leftLoading, reachedDump) > MAX_HAUL_MINUTES || (legKm != null && legKm > MAX_HAUL_KM)) {
      continue; // data gap, not a trip
    }
    validRefs.push(externalRef);

    await Trip.updateOne(
      { external_ref: externalRef },
      {
        $set: {
          trip_id: externalRef,
          vehicle_id: vehicle.vehicle_id,
          start_geofence_id: loading.geofence_id,
          end_geofence_id: dump.geofence_id,
          loading_entered_at: load.first.device_timestamp,
          loading_minutes: minutesBetween(load.first.device_timestamp, leftLoading),
          start_time: leftLoading,
          end_time: reachedDump,
          haul_minutes: minutesBetween(leftLoading, reachedDump),
          duration_minutes: minutesBetween(leftLoading, reachedDump),
          dump_left_at: leftDump,
          unloading_minutes: leftDump ? minutesBetween(reachedDump, leftDump) : null,
          return_minutes:
            leftDump && nextLoad && minutesBetween(leftDump, nextLoad.first.device_timestamp) <= MAX_CYCLE_MINUTES
              ? minutesBetween(leftDump, nextLoad.first.device_timestamp)
              : null,
          distance_km:
            odoStart != null && odoEnd != null && odoEnd >= odoStart
              ? Math.round((odoEnd - odoStart) * 10) / 10
              : undefined,
          status: "COMPLETED",
          material_type: "Overburden",
          source: "telematics",
          external_ref: externalRef
        }
      },
      { upsert: true }
    );
    found++;
  }

  // Trips in the window that no longer qualify (e.g. created before the
  // data-gap rule) are removed, so the count always matches the GPS track.
  await Trip.deleteMany({
    vehicle_id: vehicle.vehicle_id,
    source: "telematics",
    start_time: { $gte: since },
    external_ref: { $nin: validRefs }
  });

  // Cycle time = gap between consecutive departures from the loading zone.
  const trips = await Trip.find({ vehicle_id: vehicle.vehicle_id, source: "telematics" })
    .sort({ start_time: 1 })
    .lean();
  for (let i = 0; i < trips.length - 1; i++) {
    const gap = minutesBetween(trips[i].start_time, trips[i + 1].start_time);
    const cycle = gap <= MAX_CYCLE_MINUTES ? gap : null;
    if (trips[i].cycle_time_minutes !== cycle) {
      await Trip.updateOne({ _id: trips[i]._id }, { $set: { cycle_time_minutes: cycle } });
    }
  }
  return found;
}

export async function detectTrips(projectId) {
  const config = getProjectConfig(projectId);
  const phase = config.haulOperation?.phases?.[config.haulOperation.current];
  if (!phase) return;

  const Geofence = getProjectModel(projectId, "Geofence");
  const loading = await Geofence.findOne({ geofence_id: phase.fromGeofenceId, status: "active" }).lean();
  const dump = await Geofence.findOne({ geofence_id: phase.toGeofenceId, status: "active" }).lean();
  if (!loading || !dump) return;

  const Vehicle = getProjectModel(projectId, "Vehicle");
  const vehicles = await Vehicle.find({
    data_source: { $in: ["vecv_live", "volvo_live"] },
    status: { $ne: "inactive" }
  }).lean();

  let total = 0;
  for (const v of vehicles) total += await detectForVehicle(projectId, v, loading, dump);
  return total;
}

let started = false;

export async function startTripDetector() {
  if (started) return;
  started = true;

  for (const p of listProjects()) await syncGeofences(p.projectId);
  console.log("[Trips] Geofences synced; trip detection runs every 2 min.");

  const run = async () => {
    for (const p of listProjects()) {
      try {
        await detectTrips(p.projectId);
      } catch (error) {
        console.error(`[Trips] ${p.projectId} detection failed:`, error.message);
      }
    }
  };
  run();
  setInterval(run, RUN_INTERVAL_MS);
}
