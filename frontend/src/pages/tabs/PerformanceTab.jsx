import { useState } from "react";
import { ChevronRight, Clock, Droplets, Fuel, Gauge, Hammer, Info, Loader2, Route } from "lucide-react";
import useFetch from "../../hooks/useFetch.js";
import api from "../../services/api.js";
import StateBlock from "../../components/common/StateBlock.jsx";
import KPICard from "../../components/common/KPICard.jsx";
import DateRangePicker, { rangeLabel, todayIst } from "../../components/common/DateRangePicker.jsx";
import VehicleDetailPanel from "../../components/fleet/VehicleDetailPanel.jsx";

const DASH = "—";
// Totals over long ranges run into thousands — drop decimals there so the
// numbers stay readable (and fit their cards).
const fmt = (v, unit = "") => {
  if (v == null) return DASH;
  const n = Math.abs(v) >= 1000 ? Math.round(v) : v;
  return `${n.toLocaleString("en-IN")}${unit}`;
};

export default function PerformanceTab() {
  const [range, setRange] = useState(() => ({ from: todayIst(), to: todayIst() }));
  const [selected, setSelected] = useState(null);
  const { data, loading, error } = useFetch(
    () => api.get(`/analytics/performance?from=${range.from}&to=${range.to}`),
    [range.from, range.to]
  );
  const label = rangeLabel(range);

  const columns = [
    ["Fuel Used", (v) => fmt(v.fuel_used_l, " L")],
    ["Distance", (v) => fmt(v.distance_km, " km")],
    ["Engine Hrs", (v) => fmt(v.engine_hours)],
    ["Avg L/hr", (v) => fmt(v.avg_fuel_l_per_hour)],
    ["km/L", (v) => fmt(v.km_per_l)],
    ["Idle", (v) => (v.idle_hours == null ? DASH : `${fmt(v.idle_hours)} h (${v.idle_pct}%)`)],
    ["Idle Fuel", (v) => fmt(v.idle_fuel_l, " L")],
    ["Avg Speed", (v) => fmt(v.avg_moving_speed_kmh, " km/h")],
    ["Tipping", (v) => (v.tipping_hours == null ? DASH : `${fmt(v.tipping_hours)} h`)],
    ["Harsh Brake", (v) => (v.harsh_braking_sec == null ? DASH : `${fmt(Math.round(v.harsh_braking_sec / 60))} min`)],
    ["Harsh Accel", (v) => (v.harsh_accel_sec == null ? DASH : `${fmt(Math.round(v.harsh_accel_sec / 60))} min`)],
    [`>${data?.thresholds?.overspeedKmh ?? 60} km/h`, (v) => fmt(v.overspeed_min, " min")],
    [`>${data?.thresholds?.highRpm ?? 2000} rpm`, (v) => fmt(v.high_rpm_min, " min")]
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted">
          Fleet fuel and driving data for <b className="text-text">{label}</b>, from each truck's own sensors. Click a
          truck for its current readings and last 2 / 24 hours.
        </p>
        <div className="flex items-center gap-3">
          {loading && data && (
            <span className="inline-flex items-center gap-1.5 text-sm text-muted">
              <Loader2 size={15} className="animate-spin" /> Updating…
            </span>
          )}
          <DateRangePicker value={range} onChange={setRange} />
        </div>
      </div>

      {data?.data_since && range.from < data.data_since && (
        <div className="flex items-start gap-2 rounded-lg border border-info/20 bg-info/5 px-4 py-3 text-sm text-text">
          <Info size={16} className="mt-0.5 shrink-0 text-info" />
          <span>
            Telematics data starts on <b>{new Date(`${data.data_since}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}</b>.
            The part of this range before that has no readings, so any range starting earlier shows the same totals.
          </span>
        </div>
      )}

      <StateBlock loading={loading && !data} error={error}>
        {data && (
          <div className={`flex flex-col gap-6 transition-opacity ${loading ? "pointer-events-none opacity-50" : ""}`}>
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <KPICard label="Fuel Used" value={fmt(data.totals.fuel_used_l, " L")} icon={Fuel} accent="bad" />
              <KPICard label="Distance" value={fmt(data.totals.distance_km, " km")} icon={Route} accent="info" />
              <KPICard label="Engine Hours" value={fmt(data.totals.engine_hours)} icon={Clock} accent="accent" />
              <KPICard label="Avg Fuel / Hour" value={fmt(data.totals.avg_fuel_l_per_hour, " L")} icon={Gauge} accent="warn" />
              <KPICard label="Idle Fuel" value={fmt(data.totals.idle_fuel_l, " L")} icon={Droplets} accent="idle" />
              <KPICard label="Tipping Time" value={fmt(data.totals.tipping_hours, " h")} icon={Hammer} accent="ok" />
            </div>

            <div className="overflow-x-auto rounded-xl border border-border bg-panel shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-slate-50 text-left text-xs uppercase tracking-wide text-muted">
                    <th className="px-3 py-3">Vehicle</th>
                    <th className="px-3 py-3">OEM</th>
                    {columns.map(([label]) => (
                      <th key={label} className="px-3 py-3 whitespace-nowrap">
                        {label}
                      </th>
                    ))}
                    <th className="px-3 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {data.vehicles.map((v) => (
                    <tr
                      key={v.vehicle_id}
                      onClick={() => setSelected(v)}
                      className="cursor-pointer border-b border-border/60 last:border-0 hover:bg-accent/5"
                    >
                      <td className="px-3 py-3 font-medium text-accent whitespace-nowrap">{v.vehicle_number}</td>
                      <td className="px-3 py-3 text-muted">{v.oem}</td>
                      {columns.map(([label, render]) => (
                        <td key={label} className="px-3 py-3 text-muted whitespace-nowrap">
                          {render(v)}
                        </td>
                      ))}
                      <td className="px-3 py-3 text-muted">
                        <ChevronRight size={16} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-xs text-muted">
              Volvo: full metrics · Eicher: fuel, distance and engine hours. Harsh braking / acceleration = time spent
              decelerating or accelerating faster than 1.1 m/s². Tipping = PTO (body hydraulics) running while
              stationary. "—" = not reported by that truck in this period.
            </p>
          </div>
        )}
      </StateBlock>

      {selected && (
        <VehicleDetailPanel vehicle={selected} period={selected} periodLabel={label} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
