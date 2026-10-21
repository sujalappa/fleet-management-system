import { useEffect, useState } from "react";
import { Route, Timer, ArrowDownToLine, ArrowUpFromLine, RefreshCw } from "lucide-react";
import useFetch from "../../hooks/useFetch.js";
import api from "../../services/api.js";
import StateBlock from "../../components/common/StateBlock.jsx";
import KPICard from "../../components/common/KPICard.jsx";

const DASH = "—";
const IST_MS = 5.5 * 60 * 60 * 1000;

// Mine shifts (IST). Shift III crosses midnight into the next day.
const SHIFTS = [
  { id: "I", label: "Shift I · 06:00–14:00", start: "06:00", hours: 8 },
  { id: "II", label: "Shift II · 14:00–22:00", start: "14:00", hours: 8 },
  { id: "III", label: "Shift III · 22:00–06:00", start: "22:00", hours: 8 },
  { id: "DAY", label: "Full day · 00:00–24:00", start: "00:00", hours: 24 }
];

const todayIst = () => new Date(Date.now() + IST_MS).toISOString().slice(0, 10);
const timeIst = (d) =>
  d ? new Date(d).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false }) : DASH;
const min = (v) => (v == null ? DASH : `${v} min`);
const avg = (list, key) => {
  const vals = list.map((t) => t[key]).filter((v) => v != null);
  return vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : null;
};

// Picks the shift that's running right now, so the page opens on it.
function currentShift() {
  const hour = new Date(Date.now() + IST_MS).getUTCHours();
  if (hour >= 6 && hour < 14) return "I";
  if (hour >= 14 && hour < 22) return "II";
  return "III";
}

export default function TripsTab() {
  const [date, setDate] = useState(() => {
    // Between midnight and 06:00 the running Shift III started yesterday.
    const hour = new Date(Date.now() + IST_MS).getUTCHours();
    return hour < 6 ? new Date(Date.now() + IST_MS - 864e5).toISOString().slice(0, 10) : todayIst();
  });
  const [shiftId, setShiftId] = useState(currentShift);
  const shift = SHIFTS.find((s) => s.id === shiftId);
  const from = new Date(`${date}T${shift.start}:00+05:30`);
  const to = new Date(from.getTime() + shift.hours * 3600e3);

  const { data: trips, loading, error, refetch } = useFetch(
    () => api.get(`/trips?from=${from.toISOString()}&to=${to.toISOString()}&limit=500`),
    [date, shiftId]
  );
  const { data: fleet } = useFetch(() => api.get("/fleet/live"), []);

  // Trips are detected every 2 minutes — keep the open shift fresh.
  useEffect(() => {
    const id = setInterval(refetch, 120000);
    return () => clearInterval(id);
  }, [refetch]);

  const nameOf = new Map((fleet?.fleet || []).map((v) => [v.vehicle_id, v.vehicle_number]));
  const detected = (trips || []).filter((t) => t.source === "telematics");
  const ordered = [...detected].sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
  const perTruck = [...ordered.reduce((m, t) => m.set(t.vehicle_id, [...(m.get(t.vehicle_id) || []), t]), new Map())];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted">
          A trip is counted when a truck leaves the <b>loading zone</b> and reaches the <b>dumping yard</b>. Times come
          from GPS entering and leaving each 200 m zone; updated every 2 minutes.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={date}
            max={todayIst()}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg border border-border bg-panel px-3 py-2 text-sm text-text shadow-sm"
          />
          <select
            value={shiftId}
            onChange={(e) => setShiftId(e.target.value)}
            className="rounded-lg border border-border bg-panel px-3 py-2 text-sm text-text shadow-sm"
          >
            {SHIFTS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          <button
            onClick={refetch}
            title="Refresh"
            className="rounded-lg border border-border bg-panel p-2 text-muted shadow-sm transition hover:text-text"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      <StateBlock loading={loading && !trips} error={error}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <KPICard label="Trips" value={detected.length} icon={Route} accent="accent" />
          <KPICard label="Avg Loading" value={min(avg(detected, "loading_minutes"))} icon={ArrowDownToLine} accent="info" />
          <KPICard label="Avg Haul" value={min(avg(detected, "haul_minutes"))} icon={Route} accent="warn" />
          <KPICard label="Avg Unloading" value={min(avg(detected, "unloading_minutes"))} icon={ArrowUpFromLine} accent="ok" />
          <KPICard label="Avg Cycle" value={min(avg(detected, "cycle_time_minutes"))} icon={Timer} accent="bad" />
        </div>

        {perTruck.length > 0 && (
          <div className="flex flex-wrap gap-3">
            {perTruck.map(([vehicleId, list]) => (
              <div key={vehicleId} className="rounded-xl border border-border bg-panel px-4 py-3 shadow-sm">
                <div className="text-xs font-medium uppercase tracking-wide text-muted">{nameOf.get(vehicleId) || vehicleId}</div>
                <div className="mt-0.5 text-xl font-semibold text-text">
                  {list.length} <span className="text-sm font-normal text-muted">trip{list.length === 1 ? "" : "s"}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="overflow-x-auto rounded-xl border border-border bg-panel shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-slate-50 text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Truck</th>
                <th className="px-4 py-3">Loading In → Out</th>
                <th className="px-4 py-3">Loading</th>
                <th className="px-4 py-3">Haul</th>
                <th className="px-4 py-3">Dump In → Out</th>
                <th className="px-4 py-3">Unloading</th>
                <th className="px-4 py-3">Return</th>
                <th className="px-4 py-3">Cycle</th>
                <th className="px-4 py-3">Distance</th>
              </tr>
            </thead>
            <tbody>
              {ordered.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-muted">
                    No trips detected in this shift yet.
                  </td>
                </tr>
              )}
              {ordered.map((t, i) => (
                <tr key={t._id} className="border-b border-border/60 last:border-0 hover:bg-panel-hover">
                  <td className="px-4 py-3 text-muted">{i + 1}</td>
                  <td className="px-4 py-3 font-medium text-text whitespace-nowrap">{nameOf.get(t.vehicle_id) || t.vehicle_id}</td>
                  <td className="px-4 py-3 text-muted whitespace-nowrap">
                    {timeIst(t.loading_entered_at)} → {timeIst(t.start_time)}
                  </td>
                  <td className="px-4 py-3 text-muted">{min(t.loading_minutes)}</td>
                  <td className="px-4 py-3 text-muted">{min(t.haul_minutes)}</td>
                  <td className="px-4 py-3 text-muted whitespace-nowrap">
                    {timeIst(t.end_time)} → {t.dump_left_at ? timeIst(t.dump_left_at) : "at dump"}
                  </td>
                  <td className="px-4 py-3 text-muted">{min(t.unloading_minutes)}</td>
                  <td className="px-4 py-3 text-muted">{min(t.return_minutes)}</td>
                  <td className="px-4 py-3 text-muted">{min(t.cycle_time_minutes)}</td>
                  <td className="px-4 py-3 text-muted">{t.distance_km != null ? `${t.distance_km} km` : DASH}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </StateBlock>
    </div>
  );
}
