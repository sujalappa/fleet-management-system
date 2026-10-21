import { getProjectModel } from "../../model/index.js";
import { listProjects } from "../../projects/index.js";
import { isConfigured, DEFAULT_KEY_ENV } from "./tokenManager.js";
import { VecvRateLimitError, VecvUnauthorizedError } from "./client.js";
import { getFuelData } from "./fuel.js";
import { getServiceHistory } from "./serviceHistory.js";
import { getAlertLogs } from "./alerts.js";

// VECV allows 1 data call per minute per key across all endpoints, so the
// poller spends its budget carefully: the Fuel API already returns lat/lng,
// status, speed and odometer, so Fuel calls feed both the live map (GPSLog)
// and fuel tracking (FuelLog) — no separate Location call needed. A feed
// that keeps returning 401 auto-disables (see handlePollError).
const FUEL_INTERVAL_MS = 60 * 1000;
// Each key allows only 1 request/min shared by all endpoints, and every
// alerts call costs a GPS reading — so alerts are checked every 15 min.
const ALERTS_INTERVAL_MS = 15 * 60 * 1000;
const ALERTS_LOOKBACK_MS = 30 * 60 * 1000; // overlap, caseId dedupes
const SERVICE_HISTORY_INTERVAL_MS = 24 * 60 * 60 * 1000;
// VECV rejects ranges over 48h (undocumented, verified live); polled daily,
// so 47h still overlaps every day.
const SERVICE_HISTORY_LOOKBACK_MS = 47 * 60 * 60 * 1000;
// Daily feeds that lose to the rate limit retry soon, not a day later.
const RATE_LIMIT_RETRY_MS = 5 * 60 * 1000;

// Feeds VECV has rejected with a persistent 401 (not subscribed on this
// key) — skipped until the backend restarts, instead of wasting rate-limit
// slots on calls that will never succeed.
const disabledFeeds = new Set();

// A vehicle is polled once it has a chassis_number, data_source
// "vecv_live" and isn't marked inactive. Vehicles are grouped per API key
// (api_key_env), because each key only sees its own trucks and has its own
// rate limit.
async function getLiveVehiclesByProject() {
  const groups = [];
  for (const project of listProjects()) {
    const Vehicle = getProjectModel(project.projectId, "Vehicle");
    const vehicles = await Vehicle.find({
      data_source: "vecv_live",
      status: { $ne: "inactive" },
      chassis_number: { $exists: true, $ne: null }
    }).lean();
    const byKey = new Map();
    for (const v of vehicles) {
      const keyEnv = v.api_key_env || DEFAULT_KEY_ENV;
      if (!byKey.has(keyEnv)) byKey.set(keyEnv, []);
      byKey.get(keyEnv).push(v);
    }
    for (const [keyEnv, list] of byKey) groups.push({ projectId: project.projectId, keyEnv, vehicles: list });
  }
  return groups;
}

async function pollFuelAndPosition() {
  const groups = await getLiveVehiclesByProject();

  for (const { projectId, keyEnv, vehicles } of groups) {
    const vehicleByChassis = new Map(vehicles.map((v) => [v.chassis_number, v]));
    const GPSLog = getProjectModel(projectId, "GPSLog");
    const FuelLog = getProjectModel(projectId, "Fuel");

    try {
      const rows = await getFuelData([...vehicleByChassis.keys()], keyEnv);
      for (const row of rows) {
        const vehicle = vehicleByChassis.get(row.chassisNo);
        if (!vehicle || !row.epochTime) continue;

        const externalRef = `${row.chassisNo}:${row.epochTime}`;
        const deviceTimestamp = row.deviceTimestamp || new Date();

        if (row.latitude && row.longitude) {
          await GPSLog.updateOne(
            { external_ref: externalRef },
            {
              $setOnInsert: {
                vehicle_id: vehicle.vehicle_id,
                gps_device_id: vehicle.gps_device_id,
                chassis_number: row.chassisNo,
                latitude: row.latitude,
                longitude: row.longitude,
                speed: row.vehicleSpeed,
                odometer_km: row.odometerKm,
                vehicle_status: row.vehicleStatus,
                device_timestamp: deviceTimestamp,
                raw_data: row.raw,
                source: "telematics",
                external_ref: externalRef
              }
            },
            { upsert: true }
          );
        }

        await FuelLog.updateOne(
          { external_ref: externalRef },
          {
            $setOnInsert: {
              vehicle_id: vehicle.vehicle_id,
              gps_device_id: vehicle.gps_device_id,
              chassis_number: row.chassisNo,
              fuel_level_liters: row.fuelLevelInLtr,
              fuel_percentage: row.fuelLevelInPer,
              engine_hours: row.engineOperatingHours,
              odometer_km: row.odometerKm,
              vehicle_status: row.vehicleStatus,
              fuel_type: row.fuelType,
              def_level_liters: row.defLevelInLtr,
              lifetime_fuel_consumption:
                row.lifeTimeFuelConsumption != null ? Number(row.lifeTimeFuelConsumption) : undefined,
              soc_level: row.socLevel,
              battery_temperature_c: row.batteryTemperature,
              co2_saving_kg: row.co2Saving,
              device_timestamp: deviceTimestamp,
              raw_data: row.raw,
              source: "telematics",
              external_ref: externalRef
            }
          },
          { upsert: true }
        );

        // Keep the vehicle's running totals current for the rest of the app.
        const Vehicle = getProjectModel(projectId, "Vehicle");
        await Vehicle.updateOne(
          { vehicle_id: vehicle.vehicle_id },
          {
            $set: {
              ...(row.odometerKm != null && { total_odometer_km: row.odometerKm }),
              ...(row.engineOperatingHours != null && { total_engine_hours: row.engineOperatingHours })
            }
          }
        );
      }
    } catch (error) {
      handlePollError("fuel", projectId, error, keyEnv);
    }
  }
}

async function pollAlerts() {
  const groups = await getLiveVehiclesByProject();
  const now = new Date();
  const start = new Date(now.getTime() - ALERTS_LOOKBACK_MS);

  for (const { projectId, keyEnv, vehicles } of groups) {
    if (disabledFeeds.has(`alerts:${keyEnv}`)) continue;
    const vehicleByChassis = new Map(vehicles.map((v) => [v.chassis_number, v]));
    const Alert = getProjectModel(projectId, "Alert");

    try {
      const alerts = await getAlertLogs([...vehicleByChassis.keys()], start, now, keyEnv);
      for (const alert of alerts) {
        if (!alert.caseId) continue;
        const vehicle = vehicleByChassis.get(alert.chassisNumber);

        await Alert.updateOne(
          { external_ref: alert.caseId },
          {
            $setOnInsert: {
              alert_id: alert.caseId,
              alert_type: alert.alertType,
              external_alert_type: alert.externalAlertType,
              alert_sub_type: alert.alertSubType,
              external_alert_sub_type_id: alert.alertSubTypeId,
              alert_value: alert.alertValue,
              alert_unit: alert.alertUnit,
              severity: alert.severity,
              vehicle_id: vehicle?.vehicle_id,
              registration_number: alert.registrationNumber,
              odometer_km: alert.odometerKm,
              alert_time: alert.alertTime,
              message: alert.faultName || alert.caseDescription || "VECV alert",
              latitude: alert.latitude,
              longitude: alert.longitude,
              fault_name: alert.faultName,
              case_description: alert.caseDescription,
              solution_recommended: alert.solutionRecommended,
              raw_data: alert.raw,
              source: "telematics",
              external_ref: alert.caseId
            }
          },
          { upsert: true }
        );
      }
    } catch (error) {
      handlePollError("alerts", projectId, error, keyEnv);
    }
  }
}

async function pollServiceHistory() {
  const groups = await getLiveVehiclesByProject();
  const now = new Date();
  const start = new Date(now.getTime() - SERVICE_HISTORY_LOOKBACK_MS);

  for (const { projectId, keyEnv, vehicles } of groups) {
    if (disabledFeeds.has(`serviceHistory:${keyEnv}`)) continue;
    const vehicleByChassis = new Map(vehicles.map((v) => [v.chassis_number, v]));
    const ServiceHistory = getProjectModel(projectId, "ServiceHistory");

    try {
      const records = await getServiceHistory([...vehicleByChassis.keys()], start, now, keyEnv);
      for (const record of records) {
        if (!record.jobCardNumber) continue;
        const vehicle = vehicleByChassis.get(record.chassisNumber);

        await ServiceHistory.updateOne(
          { external_ref: record.jobCardNumber },
          {
            $setOnInsert: {
              vehicle_id: vehicle?.vehicle_id,
              chassis_number: record.chassisNumber,
              registration_number: record.registrationNumber,
              job_card_number: record.jobCardNumber,
              dealer_name: record.dealerName,
              model_description: record.modelDescription,
              order_type_description: record.orderTypeDescription,
              invoice_number: record.invoiceNumber,
              odometer_km: record.odometerKm,
              lube_tran_value: record.lubeTranValue,
              labour_tran_value: record.labourTranValue,
              parts_value_amount: record.partsValueAmount,
              total_cost_cust: record.totalCostCust,
              job_card_open_date: record.jobCardOpenDate,
              job_card_line_items: record.jobCardLineItems,
              raw_data: record.raw,
              source: "telematics",
              external_ref: record.jobCardNumber
            }
          },
          { upsert: true }
        );
      }
    } catch (error) {
      handlePollError("serviceHistory", projectId, error, keyEnv);
      if (error instanceof VecvRateLimitError) {
        setTimeout(
          () => pollServiceHistory().catch((e) => console.error("[VECV] serviceHistory retry failed:", e.message)),
          RATE_LIMIT_RETRY_MS
        );
      }
    }
  }
}

function handlePollError(feed, projectId, error, keyEnv) {
  if (error instanceof VecvUnauthorizedError) {
    disabledFeeds.add(`${feed}:${keyEnv}`);
    console.warn(`[VECV] ${feed} is not enabled for ${keyEnv} — disabling it until restart.`);
  } else if (error instanceof VecvRateLimitError) {
    console.warn(`[VECV] ${feed} (${projectId}) rate-limited, will retry`);
  } else {
    console.error(`[VECV] ${feed} (${projectId}) poll failed:`, error.message);
  }
}

// Skips a tick if the previous run is still waiting in the rate-limit
// queue, so a too-optimistic VECV_REQUESTS_PER_MINUTE can't pile up calls.
function every(intervalMs, name, fn) {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await fn();
    } catch (e) {
      console.error(`[VECV] ${name} tick failed:`, e.message);
    } finally {
      running = false;
    }
  };
  tick();
  setInterval(tick, intervalMs);
}

let started = false;

// Inert unless VECV_API_KEY is set AND at least one vehicle is onboarded —
// safe to call unconditionally from index.js after connectDB().
export async function startVecvPoller() {
  if (started) return;
  if (!isConfigured()) {
    console.log("[VECV] VECV_API_KEY not set — telematics poller stays off (simulated data only).");
    return;
  }

  const groups = await getLiveVehiclesByProject();
  const liveCount = groups.reduce((sum, g) => sum + g.vehicles.length, 0);
  if (liveCount === 0) {
    console.log('[VECV] No vehicles with data_source: "vecv_live" yet — telematics poller stays off.');
    return;
  }

  started = true;
  console.log(`[VECV] Starting telematics poller for ${liveCount} onboarded vehicle(s).`);

  // All calls share one rate-limited queue (rateLimiter.js), so these
  // timers can't collide into 429s — they just wait their turn.
  every(FUEL_INTERVAL_MS, "fuel", pollFuelAndPosition);
  every(ALERTS_INTERVAL_MS, "alerts", pollAlerts);
  every(SERVICE_HISTORY_INTERVAL_MS, "serviceHistory", pollServiceHistory);
}
