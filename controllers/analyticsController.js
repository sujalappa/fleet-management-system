import { getProjectModel } from "../model/index.js";
import { getProjectConfig } from "../projects/index.js";

// GET /api/analytics/overview?from=&to=
// Aggregated KPIs mirroring the Kamptee OC Power BI daily reporting sheet:
// total OB moved, achievement vs target, trips, diesel, cycle time, revenue.
export const getOverview = async (req, res) => {
  try {
    const Trip = getProjectModel(req.projectId, "Trip");
    const Maintenance = getProjectModel(req.projectId, "Maintenance");
    const config = getProjectConfig(req.projectId);

    const { from, to } = req.query;
    const dateFilter = {};
    if (from || to) {
      dateFilter.start_time = {};
      if (from) dateFilter.start_time.$gte = new Date(from);
      if (to) dateFilter.start_time.$lte = new Date(to);
    }

    const [tripStats] = await Trip.aggregate([
      { $match: { status: "COMPLETED", ...dateFilter } },
      {
        $group: {
          _id: null,
          total_trips: { $sum: 1 },
          total_volume_cum: { $sum: "$volume_cum" },
          total_diesel_liters: { $sum: "$diesel_consumed_liters" },
          total_distance_km: { $sum: "$distance_km" },
          total_revenue_inr: { $sum: "$revenue_inr" },
          avg_cycle_time_minutes: { $avg: "$cycle_time_minutes" },
          avg_payload_cum: { $avg: "$volume_cum" },
          // How many trips actually carry each measurement — trips detected
          // from GPS have no payload/revenue/diesel until those are measured.
          volume_count: { $sum: { $cond: [{ $gt: ["$volume_cum", null] }, 1, 0] } },
          revenue_count: { $sum: { $cond: [{ $gt: ["$revenue_inr", null] }, 1, 0] } },
          diesel_count: { $sum: { $cond: [{ $gt: ["$diesel_consumed_liters", null] }, 1, 0] } },
          earliest_trip: { $min: "$start_time" },
          latest_trip: { $max: "$start_time" }
        }
      }
    ]);

    const [maintenanceStats] = await Maintenance.aggregate([
      { $match: { status: { $in: ["completed", "in_progress"] } } },
      {
        $group: {
          _id: null,
          breakdown_count: { $sum: 1 },
          total_maintenance_cost_inr: { $sum: "$cost_inr" },
          total_response_minutes: { $sum: "$response_time_minutes" }
        }
      }
    ]);

    // Nothing measured yet must read as "not counted" (null → "—" in the
    // UI), never as a real zero — so no zero-filled defaults here.
    const t = tripStats;
    const m = maintenanceStats;

    const cumulativeTarget = config.benchmarks?.targetCumPerDay
      ? config.benchmarks.targetCumPerDay * 31
      : null;

    const hasVolume = !!t?.volume_count;
    const hasRevenue = !!t?.revenue_count;
    const hasDiesel = !!t?.diesel_count;
    const dieselCost = hasDiesel ? t.total_diesel_liters * config.financials.dieselRatePerLiterINR : null;
    const operatingCost =
      hasDiesel || m ? (dieselCost || 0) + (m?.total_maintenance_cost_inr || 0) : null;

    const daysSpan =
      t?.earliest_trip && t?.latest_trip
        ? Math.max(1, Math.round((t.latest_trip - t.earliest_trip) / 86400000) + 1)
        : null;

    res.status(200).json({
      success: true,
      data: {
        project: config.name,
        is_dummy_data: !!config.isDummyData,
        total_ob_moved_cum: hasVolume ? round2(t.total_volume_cum) : null,
        cumulative_target_cum: cumulativeTarget,
        achievement_pct:
          hasVolume && cumulativeTarget ? round2((t.total_volume_cum / cumulativeTarget) * 100) : null,
        total_trips: t ? t.total_trips : null,
        avg_payload_cum: hasVolume ? round2(t.avg_payload_cum) : null,
        avg_cycle_time_minutes: t?.avg_cycle_time_minutes != null ? round2(t.avg_cycle_time_minutes) : null,
        total_diesel_liters: hasDiesel ? round2(t.total_diesel_liters) : null,
        fuel_efficiency_l_per_cum: hasVolume && hasDiesel && t.total_volume_cum
          ? round2(t.total_diesel_liters / t.total_volume_cum)
          : null,
        fuel_efficiency_l_per_km: hasDiesel && t.total_distance_km
          ? round2(t.total_diesel_liters / t.total_distance_km)
          : null,
        total_revenue_inr: hasRevenue ? round2(t.total_revenue_inr) : null,
        total_operating_cost_inr: round2(operatingCost),
        net_operating_margin_inr: hasRevenue && operatingCost != null ? round2(t.total_revenue_inr - operatingCost) : null,
        breakdown_count: m ? m.breakdown_count : null,
        avg_breakdown_response_minutes: m?.breakdown_count
          ? round2(m.total_response_minutes / m.breakdown_count)
          : null,
        days_span: daysSpan,
        avg_trips_per_day: daysSpan ? round2(t.total_trips / daysSpan) : null,
        avg_daily_production_cum: daysSpan && hasVolume ? round2(t.total_volume_cum / daysSpan) : null
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/analytics/equipment-volume — per-vehicle volume distribution
// (feeds the "Equipment Volume Distribution" chart on the Overview tab)
export const getEquipmentVolume = async (req, res) => {
  try {
    const Trip = getProjectModel(req.projectId, "Trip");

    const rows = await Trip.aggregate([
      { $match: { status: "COMPLETED" } },
      {
        $group: {
          _id: "$vehicle_id",
          total_volume_cum: { $sum: "$volume_cum" },
          total_trips: { $sum: 1 }
        }
      },
      { $sort: { total_volume_cum: -1 } }
    ]);

    res.status(200).json({
      success: true,
      data: rows.map((r) => ({
        vehicle_id: r._id,
        total_volume_cum: round2(r.total_volume_cum),
        total_trips: r.total_trips
      }))
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/analytics/daily-trend — production & trips per calendar day
// (feeds the trend chart in the Overview's Analysis section)
export const getDailyTrend = async (req, res) => {
  try {
    const Trip = getProjectModel(req.projectId, "Trip");

    const rows = await Trip.aggregate([
      { $match: { status: "COMPLETED" } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$start_time", timezone: "Asia/Kolkata" } },
          total_volume_cum: { $sum: "$volume_cum" },
          total_trips: { $sum: 1 },
          total_diesel_liters: { $sum: "$diesel_consumed_liters" }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.status(200).json({
      success: true,
      data: rows.map((r) => ({
        date: r._id,
        total_volume_cum: round2(r.total_volume_cum),
        total_trips: r.total_trips,
        total_diesel_liters: round2(r.total_diesel_liters)
      }))
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

function round2(value) {
  return typeof value === "number" ? Math.round(value * 100) / 100 : value;
}
