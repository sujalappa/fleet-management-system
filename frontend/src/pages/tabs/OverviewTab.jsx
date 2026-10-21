import { Fuel, Gauge, IndianRupee, Route, TrendingUp } from "lucide-react";
import useFetch from "../../hooks/useFetch.js";
import api from "../../services/api.js";
import StateBlock from "../../components/common/StateBlock.jsx";
import KPICard from "../../components/common/KPICard.jsx";
import LiveFleetMapSection from "../../components/map/LiveFleetMapSection.jsx";
import EquipmentVolumeChart from "../../components/charts/EquipmentVolumeChart.jsx";
import ProductionTrendChart from "../../components/charts/ProductionTrendChart.jsx";

// Anything not measured yet comes back null from the API and shows as "—",
// so it's never mistaken for a real zero.
const DASH = "—";
const inr = (value) => (value == null ? DASH : `₹${(value / 100000).toFixed(2)}L`);
const num = (value, unit = "") => (value == null ? DASH : `${value.toLocaleString()}${unit}`);

export default function OverviewTab() {
  const { data: overview, loading, error } = useFetch(() => api.get("/analytics/overview"), []);
  const { data: equipmentVolume, loading: volLoading } = useFetch(
    () => api.get("/analytics/equipment-volume"),
    []
  );
  const { data: dailyTrend, loading: trendLoading } = useFetch(
    () => api.get("/analytics/daily-trend"),
    []
  );

  return (
    <StateBlock loading={loading} error={error}>
      {overview && (
        <div className="flex flex-col gap-6">
          {/* Top KPI row */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KPICard
              label="Total OB Moved"
              value={num(overview.total_ob_moved_cum, " cum")}
              sub={
                overview.achievement_pct != null
                  ? `${overview.achievement_pct}% of ${overview.cumulative_target_cum?.toLocaleString()} cum target`
                  : undefined
              }
              icon={TrendingUp}
              accent="ok"
            />
            <KPICard
              label="Total Revenue"
              value={inr(overview.total_revenue_inr)}
              sub={overview.net_operating_margin_inr != null ? `Margin ${inr(overview.net_operating_margin_inr)}` : undefined}
              icon={IndianRupee}
              accent="accent"
            />
            <KPICard
              label="Total Cost"
              value={inr(overview.total_operating_cost_inr)}
              sub={overview.total_diesel_liters != null ? `Diesel ${num(overview.total_diesel_liters, " L")}` : undefined}
              icon={Fuel}
              accent="bad"
            />
            <KPICard
              label="Total Trips"
              value={num(overview.total_trips)}
              sub={
                overview.avg_cycle_time_minutes != null
                  ? `Avg cycle ${overview.avg_cycle_time_minutes} min`
                  : overview.avg_payload_cum != null
                    ? `Avg payload ${overview.avg_payload_cum} cum/trip`
                    : undefined
              }
              icon={Route}
              accent="info"
            />
          </div>

          <LiveFleetMapSection />

          {/* Below-map KPI row */}
          <div className="grid gap-3 sm:grid-cols-2">
            <KPICard
              label="Avg Trips / Day"
              value={num(overview.avg_trips_per_day)}
              sub={overview.days_span ? `Across ${overview.days_span} days` : undefined}
              icon={Route}
              accent="info"
            />
            <KPICard
              label="Daily Avg Production"
              value={num(overview.avg_daily_production_cum, " cum")}
              sub={overview.avg_breakdown_response_minutes != null ? `${overview.breakdown_count} breakdowns, avg ${overview.avg_breakdown_response_minutes} min downtime` : undefined}
              icon={Gauge}
              accent="warn"
            />
          </div>

          {/* Analysis: multiple chart types */}
          <div>
            <h2 className="mb-3 text-sm font-semibold text-text">Analysis</h2>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-border bg-panel p-4 shadow-sm">
                <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted">
                  {equipmentVolume?.some((d) => d.total_volume_cum > 0) ? "Volume per Vehicle" : "Trips per Vehicle"}
                </h3>
                <StateBlock loading={volLoading} empty={equipmentVolume?.length === 0}>
                  {equipmentVolume && <EquipmentVolumeChart data={equipmentVolume} />}
                </StateBlock>
              </div>
              <div className="rounded-xl border border-border bg-panel p-4 shadow-sm">
                <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted">
                  {dailyTrend?.some((d) => d.total_volume_cum > 0) ? "Daily Production Trend" : "Daily Trips"}
                </h3>
                <StateBlock loading={trendLoading} empty={dailyTrend?.length === 0}>
                  {dailyTrend && <ProductionTrendChart data={dailyTrend} />}
                </StateBlock>
              </div>
            </div>
          </div>
        </div>
      )}
    </StateBlock>
  );
}
