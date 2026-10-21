import { useState } from "react";
import { Clock, Droplets, Fuel, Gauge, Hammer, Route } from "lucide-react";
import useFetch from "../../hooks/useFetch.js";
import api from "../../services/api.js";
import StateBlock from "../../components/common/StateBlock.jsx";
import KPICard from "../../components/common/KPICard.jsx";

const DASH = "—";
const fmt = (v, unit = "") => (v == null ? DASH : `${v.toLocaleString()}${unit}`);

// Today's date in IST, as YYYY-MM-DD for the date input.
function todayIst() {
  return new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export default function PerformanceTab() {
  const [date, setDate] = useState(todayIst());
  const { data, loading, error } = useFetch(() => api.get(`/analytics/performance?date=${date}`), [date]);

  const columns = [
    ["Fuel Used", (v) => fmt(v.fuel_used_l, " L")],
    ["Distance", (v) => fmt(v.distance_km, " km")],
    ["Engine Hrs", (v) => fmt(v.engine_hours)],
    ["Avg L/hr", (v) => fmt(v.avg_fuel_l_per_hour)],
    ["km/L", (v) => fmt(v.km_per_l)],
    ["Idle", (v) => (v.idle_hours == null ? DASH : `${v.idle_hours} h (${v.idle_pct}%)`)],
    ["Idle Fuel", (v) => fmt(v.idle_fuel_l, " L")],
    ["Avg Speed", (v) => fmt(v.avg_moving_speed_kmh, " km/h")],
    ["Tipping", (v) => (v.tipping_hours == null ? DASH : `${v.tipping_hours} h`)],
    ["Harsh Brake", (v) => (v.harsh_braking_sec == null ? DASH : `${Math.round(v.harsh_braking_sec / 60)} min`)],
    ["Harsh Accel", (v) => (v.harsh_accel_sec == null ? DASH : `${Math.round(v.harsh_accel_sec / 60)} min`)],
    [`>${data?.thresholds?.overspeedKmh ?? 60} km/h`, (v) => fmt(v.overspeed_min, " min")],
    [`>${data?.thresholds?.highRpm ?? 2000} rpm`, (v) => fmt(v.high_rpm_min, " min")]
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-text">Fuel & Performance</h2>
          <p className="text-xs text-muted">
            Per-truck usage for one day (IST), from each truck's own sensors. Volvo: full metrics · Eicher: fuel,
            distance and engine hours.
          </p>
        </div>
        <input
          type="date"
          value={date}
          max={todayIst()}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-lg border border-border bg-panel px-3 py-1.5 text-sm text-text"
        />
      </div>

      <StateBlock loading={loading && !data} error={error}>
        {data && (
          <>
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
                  </tr>
                </thead>
                <tbody>
                  {data.vehicles.map((v) => (
                    <tr key={v.vehicle_id} className="border-b border-border/60 last:border-0 hover:bg-panel-hover">
                      <td className="px-3 py-3 font-medium text-text whitespace-nowrap">{v.vehicle_number}</td>
                      <td className="px-3 py-3 text-muted">{v.oem}</td>
                      {columns.map(([label, render]) => (
                        <td key={label} className="px-3 py-3 text-muted whitespace-nowrap">
                          {render(v)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-xs text-muted">
              Harsh braking / acceleration = time spent decelerating or accelerating faster than 1.1 m/s². Tipping
              = PTO (body hydraulics) running while stationary. "—" = not reported by that truck for this day.
            </p>
          </>
        )}
      </StateBlock>
    </div>
  );
}
