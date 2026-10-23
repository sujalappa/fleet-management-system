import { getProjectModel } from "../model/index.js";
import { getProjectConfig } from "../projects/index.js";

/**
 * GET /api/analytics/performance?from=YYYY-MM-DD&to=YYYY-MM-DD   (IST days, inclusive)
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

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

// IST calendar days, inclusive: ?from=YYYY-MM-DD&to=YYYY-MM-DD, or the older
// single-day ?date=YYYY-MM-DD. Defaults to today; never extends past now.
function istRange({ from, to, date }) {
  const today = new Date(Date.now() + IST_OFFSET_MS).toISOString().slice(0, 10);
  const fromDay = ISO_DAY.test(from || "") ? from : ISO_DAY.test(date || "") ? date : today;
  const toDay = ISO_DAY.test(to || "") ? to : fromDay;
  const [a, b] = fromDay <= toDay ? [fromDay, toDay] : [toDay, fromDay];
  const start = new Date(`${a}T00:00:00+05:30`);
  const end = new Date(Math.min(new Date(`${b}T00:00:00+05:30`).getTime() + 24 * 60 * 60 * 1000, Date.now()));
  return { from: a, to: b, start, end };
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
// maxBaselineGapMs: how far before the window the baseline reading may be.
// Short windows ("last 2 hours") need a tight limit, or a truck that was
// silent before the window would have hours of earlier usage counted in it.
async function bracket(Model, filter, timeField, start, end, maxBaselineGapMs = BASELINE_LOOKBACK_MS) {
  const before = await Model.findOne({
    ...filter,
    [timeField]: { $lt: start, $gte: new Date(start - maxBaselineGapMs) }
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
    const { from, to, start, end } = istRange(req.query);

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

    res.status(200).json({ success: true, data: { from, to, date: from, thresholds: perf, totals, vehicles: rows } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const WINDOWS = [
  { key: "last_2h", hours: 2, maxBaselineGapMs: 30 * 60 * 1000 },
  { key: "last_24h", hours: 24, maxBaselineGapMs: 60 * 60 * 1000 }
];

// GET /api/analytics/vehicle/:vehicleId/summary
// Current readings plus usage over the last 2 and 24 hours — the same cards
// the Eicher app shows (distance, fuel used, km/L, ignition time).
export const getVehicleSummary = async (req, res) => {
  try {
    const Vehicle = getProjectModel(req.projectId, "Vehicle");
    const vehicle = await Vehicle.findOne({ vehicle_id: req.params.vehicleId }).lean();
    if (!vehicle) return res.status(404).json({ success: false, message: "Vehicle not found" });

    const isVolvo = vehicle.data_source === "volvo_live";
    const Model = getProjectModel(req.projectId, isVolvo ? "VehicleStatus" : "Fuel");
    const timeField = isVolvo ? "created_at_vehicle" : "device_timestamp";
    const filter = isVolvo ? { vehicle_id: vehicle.vehicle_id } : { vehicle_id: vehicle.vehicle_id, source: "telematics" };

    const latest = await Model.findOne(filter).sort({ [timeField]: -1 }).lean();
    const current = latest
      ? {
          updated_at: latest[timeField],
          fuel_level_l: isVolvo ? null : round(latest.fuel_level_liters),
          fuel_level_pct: isVolvo ? null : round(latest.fuel_percentage, 0),
          def_level_l: isVolvo ? null : round(latest.def_level_liters),
          odometer_km: round(latest.odometer_km, 0),
          engine_hours: round(latest.engine_hours, 1),
          lifetime_fuel_l: round(isVolvo ? latest.total_fuel_used_liters : latest.lifetime_fuel_consumption, 0)
        }
      : null;

    const now = new Date();
    const windows = {};
    for (const w of WINDOWS) {
      const start = new Date(now - w.hours * 3600e3);
      const b = await bracket(Model, filter, timeField, start, now, w.maxBaselineGapMs);
      if (!b) {
        windows[w.key] = { since: start, data_from: null };
        continue;
      }
      const fuelKey = isVolvo ? "total_fuel_used_liters" : "lifetime_fuel_consumption";
      const km = delta(b.last.odometer_km, b.first.odometer_km);
      const fuel = delta(b.last[fuelKey], b.first[fuelKey]);
      const hours = delta(b.last.engine_hours, b.first.engine_hours);
      windows[w.key] = {
        since: start,
        // Actual span the numbers cover — may start later than `since`
        // when the truck had no readings at the start of the window.
        data_from: b.first[timeField],
        data_to: b.last[timeField],
        distance_km: round(km),
        fuel_used_l: round(fuel),
        km_per_l: round(div(km, fuel), 2),
        ignition_hours: round(hours, 2)
      };
    }

    res.status(200).json({
      success: true,
      data: {
        vehicle_id: vehicle.vehicle_id,
        vehicle_number: vehicle.vehicle_number,
        oem: isVolvo ? "Volvo" : "Eicher",
        model: vehicle.model || null,
        chassis_number: vehicle.chassis_number,
        current,
        ...windows
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
