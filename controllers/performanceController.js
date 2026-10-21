import { getProjectModel } from "../model/index.js";
import { getProjectConfig } from "../projects/index.js";

/**
 * GET /api/analytics/performance?date=YYYY-MM-DD   (IST calendar day)
 *
 * Per-truck fuel & driving metrics for one day. Telematics counters are
 * life-of-vehicle totals, so a day's usage = (last reading of the day) −
 * (last reading before the day started). Anything a truck doesn't report
 * comes back null ("—" in the UI), never as a fake zero.
 */
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const BASELINE_LOOKBACK_MS = 3 * 24 * 60 * 60 * 1000;

const round = (v, dp = 1) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 10 ** dp) / 10 ** dp);
const div = (a, b) => (a == null || !b ? null : a / b);

function istDayRange(dateStr) {
  const today = new Date(Date.now() + IST_OFFSET_MS).toISOString().slice(0, 10);
  const day = /^\d{4}-\d{2}-\d{2}$/.test(dateStr || "") ? dateStr : today;
  const start = new Date(`${day}T00:00:00+05:30`);
  const end = new Date(Math.min(start.getTime() + 24 * 60 * 60 * 1000, Date.now()));
  return { day, start, end };
}

// Sum of one histogram's bands matching `pick`, for a given measure.
function bandTotal(raw, className, pick, measure = "Seconds") {
  const bands = raw?.AccumulatedData?.[className]?.Value;
  if (!Array.isArray(bands)) return null;
  return bands.filter(pick).reduce((sum, b) => sum + (b[measure] || 0), 0);
}

function delta(endVal, startVal) {
  if (endVal == null || startVal == null) return null;
  const d = endVal - startVal;
  return d >= 0 ? d : null; // a counter going backwards means a reset — unusable
}

function volvoMetrics(first, last, perf) {
  const fuel = delta(last.total_fuel_used_liters, first.total_fuel_used_liters);
  const km = delta(last.odometer_km, first.odometer_km);
  const hours = delta(last.engine_hours, first.engine_hours);
  const idleH = div(delta(last.idle_seconds, first.idle_seconds), 3600);
  const idleFuel = delta(last.idle_fuel_liters, first.idle_fuel_liters);
  const movingH = div(delta(last.moving_seconds, first.moving_seconds), 3600);

  const hist = (cls, pick, measure) =>
    delta(bandTotal(last.raw_data, cls, pick, measure), bandTotal(first.raw_data, cls, pick, measure));
  const ptoStanding = (b) => /=0/.test(b.Label || "");

  return {
    fuel_used_l: round(fuel),
    distance_km: round(km),
    engine_hours: round(hours, 2),
    avg_fuel_l_per_hour: round(div(fuel, hours)),
    km_per_l: round(div(km, fuel), 2),
    idle_hours: round(idleH, 2),
    idle_pct: round(div(idleH, hours) * 100, 0),
    idle_fuel_l: round(idleFuel),
    moving_hours: round(movingH, 2),
    avg_moving_speed_kmh: round(div(km, movingH)),
    tipping_hours: round(div(hist("PtoActiveClass", ptoStanding), 3600), 2),
    tipping_fuel_l: round(div(hist("PtoActiveClass", ptoStanding, "MilliLitres"), 1000)),
    harsh_braking_sec: round(hist("AccelerationClass", (b) => b.To <= -1.1), 0),
    harsh_accel_sec: round(hist("AccelerationClass", (b) => b.From >= 1.1), 0),
    overspeed_min: round(div(hist("VehicleSpeedClass", (b) => b.From >= perf.overspeedKmh), 60)),
    high_rpm_min: round(div(hist("EngineSpeedClass", (b) => b.From >= perf.highRpm), 60))
  };
}

// Eicher's Fuel API gives lifetime fuel, engine hours and odometer — enough
// for the core fuel metrics, not the driving-behaviour ones.
function eicherMetrics(first, last) {
  const fuel = delta(last.lifetime_fuel_consumption, first.lifetime_fuel_consumption);
  const km = delta(last.odometer_km, first.odometer_km);
  const hours = delta(last.engine_hours, first.engine_hours);
  return {
    fuel_used_l: round(fuel),
    distance_km: round(km),
    engine_hours: round(hours, 2),
    avg_fuel_l_per_hour: round(div(fuel, hours)),
    km_per_l: round(div(km, fuel), 2)
  };
}

// Baseline = last reading before the day (so the whole day is counted);
// falls back to the day's first reading when there's no earlier one.
async function bracket(Model, filter, timeField, start, end) {
  const before = await Model.findOne({
    ...filter,
    [timeField]: { $lt: start, $gte: new Date(start - BASELINE_LOOKBACK_MS) }
  })
    .sort({ [timeField]: -1 })
    .lean();
  const firstInDay = await Model.findOne({ ...filter, [timeField]: { $gte: start, $lt: end } })
    .sort({ [timeField]: 1 })
    .lean();
  const last = await Model.findOne({ ...filter, [timeField]: { $gte: start, $lt: end } })
    .sort({ [timeField]: -1 })
    .lean();
  const first = before || firstInDay;
  return first && last && String(first._id) !== String(last._id) ? { first, last } : null;
}

export const getPerformance = async (req, res) => {
  try {
    const config = getProjectConfig(req.projectId);
    const perf = { overspeedKmh: 60, highRpm: 2000, ...config.performance };
    const { day, start, end } = istDayRange(req.query.date);

    const Vehicle = getProjectModel(req.projectId, "Vehicle");
    const VehicleStatus = getProjectModel(req.projectId, "VehicleStatus");
    const FuelLog = getProjectModel(req.projectId, "Fuel");

    const vehicles = await Vehicle.find({
      data_source: { $in: ["vecv_live", "volvo_live"] },
      status: { $ne: "inactive" }
    })
      .sort({ data_source: 1, vehicle_number: 1 })
      .lean();

    const rows = [];
    for (const v of vehicles) {
      const base = {
        vehicle_id: v.vehicle_id,
        vehicle_number: v.vehicle_number,
        oem: v.data_source === "volvo_live" ? "Volvo" : "Eicher"
      };
      if (v.data_source === "volvo_live") {
        const b = await bracket(VehicleStatus, { vehicle_id: v.vehicle_id }, "created_at_vehicle", start, end);
        rows.push({ ...base, ...(b ? volvoMetrics(b.first, b.last, perf) : {}) });
      } else {
        const b = await bracket(
          FuelLog,
          { vehicle_id: v.vehicle_id, source: "telematics" },
          "device_timestamp",
          start,
          end
        );
        rows.push({ ...base, ...(b ? eicherMetrics(b.first, b.last) : {}) });
      }
    }

    // Fleet totals over trucks that reported.
    const sum = (k) => {
      const vals = rows.map((r) => r[k]).filter((x) => x != null);
      return vals.length ? vals.reduce((a, b) => a + b, 0) : null;
    };
    const totals = {
      fuel_used_l: round(sum("fuel_used_l")),
      distance_km: round(sum("distance_km")),
      engine_hours: round(sum("engine_hours"), 1),
      idle_fuel_l: round(sum("idle_fuel_l")),
      tipping_hours: round(sum("tipping_hours"), 1)
    };
    totals.avg_fuel_l_per_hour = round(div(totals.fuel_used_l, totals.engine_hours));

    res.status(200).json({ success: true, data: { date: day, thresholds: perf, totals, vehicles: rows } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
