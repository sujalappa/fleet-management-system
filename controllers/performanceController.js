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
  // The three lookups are independent — run them together.
  const [before, firstInDay, last] = await Promise.all([
    Model.findOne({ ...filter, [timeField]: { $lt: start, $gte: new Date(start - maxBaselineGapMs) } })
      .sort({ [timeField]: -1 })
      .lean(),
    Model.findOne({ ...filter, [timeField]: { $gte: start, $lt: end } })
      .sort({ [timeField]: 1 })
      .lean(),
    Model.findOne({ ...filter, [timeField]: { $gte: start, $lt: end } })
      .sort({ [timeField]: -1 })
      .lean()
  ]);
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

    // All trucks in parallel — done one after another this took ~12 s per
    // filter change, during which the page still showed the old numbers.
    const rows = await Promise.all(
      vehicles.map(async (v) => {
        const base = {
          vehicle_id: v.vehicle_id,
          vehicle_number: v.vehicle_number,
          oem: v.data_source === "volvo_live" ? "Volvo" : "Eicher"
        };
        if (v.data_source === "volvo_live") {
          const b = await bracket(VehicleStatus, { vehicle_id: v.vehicle_id }, "created_at_vehicle", start, end);
          return { ...base, ...(b ? volvoMetrics(b.first, b.last, perf) : {}) };
        }
        const b = await bracket(
          FuelLog,
          { vehicle_id: v.vehicle_id, source: "telematics" },
          "device_timestamp",
          start,
          end
        );
        return { ...base, ...(b ? eicherMetrics(b.first, b.last) : {}) };
      })
    );

    // Earliest telematics reading we hold, so the page can tell the user
    // when a selected range starts before there was any data.
    // Only trucks currently on the dashboard — retired trucks' older history
    // would make data look like it goes back further than it does.
    const activeIds = vehicles.map((v) => v.vehicle_id);
    const [firstVolvo, firstEicher] = await Promise.all([
      VehicleStatus.findOne({ vehicle_id: { $in: activeIds } }, { created_at_vehicle: 1 }).sort({ created_at_vehicle: 1 }).lean(),
      FuelLog.findOne({ vehicle_id: { $in: activeIds }, source: "telematics" }, { device_timestamp: 1 }).sort({ device_timestamp: 1 }).lean()
    ]);
    const firstReading = [firstVolvo?.created_at_vehicle, firstEicher?.device_timestamp].filter(Boolean).sort((a, b) => a - b)[0];
    const dataSince = firstReading ? new Date(new Date(firstReading).getTime() + IST_OFFSET_MS).toISOString().slice(0, 10) : null;

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

    res.status(200).json({ success: true, data: { from, to, date: from, data_since: dataSince, thresholds: perf, totals, vehicles: rows } });
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

const SHIFT_OPENING_GRACE_MS = 30 * 60 * 1000;

// Telematics source for a vehicle: which collection, time field and fuel
// counter hold its odometer / engine-hours readings.
function readingSource(projectId, vehicle) {
  const isVolvo = vehicle.data_source === "volvo_live";
  return {
    Model: getProjectModel(projectId, isVolvo ? "VehicleStatus" : "Fuel"),
    timeField: isVolvo ? "created_at_vehicle" : "device_timestamp",
    fuelField: isVolvo ? "total_fuel_used_liters" : "lifetime_fuel_consumption",
    filter: isVolvo ? { vehicle_id: vehicle.vehicle_id } : { vehicle_id: vehicle.vehicle_id, source: "telematics" }
  };
}

// GET /api/analytics/shift-log?date=YYYY-MM-DD   (IST; Shift III runs into the next morning)
// Automatic shift logbook: per truck, the opening and closing odometer /
// engine-hours readings of each shift and the usage between them.
//  - Opening = reading at shift start: the last one up to 30 min before the
//    start (truck already running), else the first reading in the shift.
//  - Closing = last reading before the shift ends — so a truck switched off at
//    13:30 in a 06:00–14:00 shift closes at its 13:30 reading.
export const getShiftLog = async (req, res) => {
  try {
    const config = getProjectConfig(req.projectId);
    const today = new Date(Date.now() + IST_OFFSET_MS).toISOString().slice(0, 10);
    const date = ISO_DAY.test(req.query.date || "") ? req.query.date : today;

    const Vehicle = getProjectModel(req.projectId, "Vehicle");
    const vehicles = await Vehicle.find({
      data_source: { $in: ["vecv_live", "volvo_live"] },
      status: { $ne: "inactive" }
    })
      .sort({ data_source: 1, vehicle_number: 1 })
      .lean();

    const now = Date.now();
    const windows = (config.shifts || []).map((shift) => {
      const start = new Date(`${date}T${shift.startTime}:00+05:30`);
      let end = new Date(`${date}T${shift.endTime}:00+05:30`);
      if (end <= start) end = new Date(end.getTime() + 24 * 60 * 60 * 1000); // night shift
      return { shift, start, end };
    });

    // One query per telematics source for the whole day (plus the opening
    // grace before the first shift) — shifts are then worked out in memory.
    // Querying per truck per shift meant ~150 round trips and a slow page.
    const dayFrom = new Date(Math.min(...windows.map((w) => w.start)) - SHIFT_OPENING_GRACE_MS);
    const dayTo = new Date(Math.min(Math.max(...windows.map((w) => w.end)), now));
    const readingsByVehicle = new Map();
    for (const isVolvo of [false, true]) {
      const ids = vehicles.filter((v) => (v.data_source === "volvo_live") === isVolvo).map((v) => v.vehicle_id);
      if (!ids.length) continue;
      const { Model, timeField, fuelField } = readingSource(req.projectId, { data_source: isVolvo ? "volvo_live" : "vecv_live" });
      const docs = await Model.find(
        {
          vehicle_id: { $in: ids },
          ...(isVolvo ? {} : { source: "telematics" }),
          [timeField]: { $gte: dayFrom, $lt: dayTo }
        },
        { vehicle_id: 1, [timeField]: 1, odometer_km: 1, engine_hours: 1, [fuelField]: 1, trigger_type: 1, vehicle_status: 1 }
      )
        .sort({ [timeField]: 1 })
        .lean();
      for (const d of docs) {
        const at = d[timeField];
        if (!readingsByVehicle.has(d.vehicle_id)) readingsByVehicle.set(d.vehicle_id, []);
        readingsByVehicle.get(d.vehicle_id).push({ ...d, at, fuel: d[fuelField] });
      }
    }

    const shifts = [];
    for (const { shift, start, end } of windows) {
      const status = start.getTime() > now ? "upcoming" : end.getTime() > now ? "in_progress" : "closed";
      const rows = [];
      if (status !== "upcoming") {
        const until = new Date(Math.min(end.getTime(), now));
        for (const v of vehicles) {
          const readings = readingsByVehicle.get(v.vehicle_id) || [];
          const before = readings.filter((r) => r.at <= start && r.at >= start - SHIFT_OPENING_GRACE_MS);
          const inShift = readings.filter((r) => r.at > start && r.at < until);
          const opening = before.at(-1) || inShift[0];
          const closing = inShift.at(-1);
          const isVolvo = v.data_source === "volvo_live";
          const base = { vehicle_id: v.vehicle_id, vehicle_number: v.vehicle_number, oem: isVolvo ? "Volvo" : "Eicher" };
          if (!opening || !closing) {
            rows.push({ ...base, operated: false });
            continue;
          }
          const kmRun = delta(closing.odometer_km, opening.odometer_km);
          const hours = delta(closing.engine_hours, opening.engine_hours);
          const fuel = delta(closing.fuel, opening.fuel);
          // Truck stopped before the shift ended (e.g. switched off at 13:30).
          // Volvo reports hourly, so its last report can be up to an hour
          // early without the truck stopping — only an IGNITION_OFF report
          // counts. Eicher reports every 1–4 min while running, so a silence
          // over 15 min before the end means it stopped or went offline.
          let closedEarly = null;
          if (status === "closed") {
            const early = Math.round((end - closing.at) / 60000);
            const stopped = isVolvo ? closing.trigger_type === "IGNITION_OFF" : early > 15;
            closedEarly = stopped && early > 0 ? early : null;
          }
          rows.push({
            ...base,
            operated: (kmRun ?? 0) > 0 || (hours ?? 0) > 0,
            opening: { at: opening.at, odometer_km: round(opening.odometer_km), engine_hours: round(opening.engine_hours, 1) },
            closing: { at: closing.at, odometer_km: round(closing.odometer_km), engine_hours: round(closing.engine_hours, 1) },
            closed_early_min: closedEarly,
            closing_event: isVolvo ? closing.trigger_type : closing.vehicle_status,
            distance_km: round(kmRun),
            engine_hours: round(hours, 1),
            fuel_used_l: round(fuel),
            km_per_l: round(div(kmRun, fuel), 2)
          });
        }
      }

      const operated = rows.filter((r) => r.operated);
      const sum = (k) => {
        const vals = operated.map((r) => r[k]).filter((x) => x != null);
        return vals.length ? round(vals.reduce((a, b) => a + b, 0)) : null;
      };
      shifts.push({
        id: shift.id,
        name: shift.name,
        start,
        end,
        status,
        trucks_operated: operated.length,
        totals: { distance_km: sum("distance_km"), engine_hours: sum("engine_hours"), fuel_used_l: sum("fuel_used_l") },
        vehicles: rows
      });
    }

    res.status(200).json({ success: true, data: { date, shifts } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
