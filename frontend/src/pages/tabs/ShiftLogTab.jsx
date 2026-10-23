import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import useFetch from "../../hooks/useFetch.js";
import api from "../../services/api.js";
import StateBlock from "../../components/common/StateBlock.jsx";
import Badge from "../../components/common/Badge.jsx";
import { todayIst } from "../../components/common/DateRangePicker.jsx";

const DASH = "—";
const IST_MS = 5.5 * 60 * 60 * 1000;
const time = (d) =>
  d ? new Date(d).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false }) : DASH;
const km = (v) => (v == null ? DASH : `${Math.round(v).toLocaleString("en-IN")} km`);
const n = (v, unit = "") => (v == null ? DASH : `${v.toLocaleString("en-IN")}${unit}`);
const shiftDay = (s, days) => new Date(new Date(`${s}T00:00:00Z`).getTime() + days * 864e5).toISOString().slice(0, 10);

const STATUS = {
  closed: { tone: "neutral", label: "Closed" },
  in_progress: { tone: "ok", label: "In progress" },
  upcoming: { tone: "info", label: "Upcoming" }
};

// Explains how a truck's shift ended, when that's worth flagging.
function closingNote(r) {
  if (!r.operated) return <span className="text-muted">Not operated</span>;
  if (r.oem === "Eicher" && r.closing_event === "MOVING" && r.closed_early_min) {
    return <span className="text-warn">No data after {time(r.closing.at)}</span>;
  }
  if (r.closed_early_min) return <span className="text-idle">Switched off {r.closed_early_min} min early</span>;
  return null;
}

function ShiftCard({ shift }) {
  const operated = shift.vehicles.filter((r) => r.operated);
  const kmPerL =
    shift.totals.distance_km && shift.totals.fuel_used_l
      ? Math.round((shift.totals.distance_km / shift.totals.fuel_used_l) * 100) / 100
      : null;

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-panel shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div className="flex items-center gap-3">
          <h3 className="text-base font-semibold text-text">{shift.name}</h3>
          <span className="text-sm text-muted">
            {time(shift.start)} – {time(shift.end)}
          </span>
          <Badge tone={STATUS[shift.status].tone}>{STATUS[shift.status].label}</Badge>
        </div>
        {shift.status !== "upcoming" && (
          <div className="flex flex-wrap gap-5 text-sm">
            <Metric label="Trucks" value={`${shift.trucks_operated} / ${shift.vehicles.length}`} />
            <Metric label="Distance" value={km(shift.totals.distance_km)} />
            <Metric label="Engine hrs" value={n(shift.totals.engine_hours)} />
            <Metric label="Fuel" value={n(shift.totals.fuel_used_l, " L")} />
            <Metric label="Fleet km/L" value={n(kmPerL)} />
          </div>
        )}
      </header>

      {shift.status === "upcoming" ? (
        <p className="px-5 py-8 text-center text-sm text-muted">This shift hasn't started yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-slate-50 text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-2.5">Truck</th>
                <th className="px-4 py-2.5">OEM</th>
                <th className="px-4 py-2.5">Opening</th>
                <th className="px-4 py-2.5">Closing</th>
                <th className="px-4 py-2.5">Distance</th>
                <th className="px-4 py-2.5">Engine hrs</th>
                <th className="px-4 py-2.5">Fuel</th>
                <th className="px-4 py-2.5">km/L</th>
                <th className="px-4 py-2.5">Note</th>
              </tr>
            </thead>
            <tbody>
              {[...operated, ...shift.vehicles.filter((r) => !r.operated)].map((r) => (
                <tr key={r.vehicle_id} className={`border-b border-border/60 last:border-0 ${r.operated ? "" : "opacity-60"}`}>
                  <td className="px-4 py-2.5 font-medium text-text whitespace-nowrap">{r.vehicle_number}</td>
                  <td className="px-4 py-2.5 text-muted">{r.oem}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    {r.opening ? (
                      <>
                        <span className="text-text">{km(r.opening.odometer_km)}</span>{" "}
                        <span className="text-xs text-muted">@ {time(r.opening.at)}</span>
                      </>
                    ) : (
                      DASH
                    )}
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    {r.closing ? (
                      <>
                        <span className="text-text">{km(r.closing.odometer_km)}</span>{" "}
                        <span className="text-xs text-muted">@ {time(r.closing.at)}</span>
                      </>
                    ) : (
                      DASH
                    )}
                  </td>
                  <td className="px-4 py-2.5 font-medium text-text">{r.operated ? km(r.distance_km) : DASH}</td>
                  <td className="px-4 py-2.5 text-muted">{r.operated ? n(r.engine_hours) : DASH}</td>
                  <td className="px-4 py-2.5 text-muted">{r.operated ? n(r.fuel_used_l, " L") : DASH}</td>
                  <td className="px-4 py-2.5 text-muted">{r.operated ? n(r.km_per_l) : DASH}</td>
                  <td className="px-4 py-2.5 text-xs whitespace-nowrap">{closingNote(r)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Metric({ label, value }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-muted">{label}</div>
      <div className="font-semibold text-text">{value}</div>
    </div>
  );
}

export default function ShiftLogTab() {
  // Before 06:00 the running shift (III) belongs to yesterday's date.
  const [date, setDate] = useState(() =>
    new Date(Date.now() + IST_MS).getUTCHours() < 6 ? shiftDay(todayIst(), -1) : todayIst()
  );
  const { data, loading, error } = useFetch(() => api.get(`/analytics/shift-log?date=${date}`), [date]);
  const today = todayIst();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted">
          Automatic shift logbook: each truck's <b className="text-text">opening</b> odometer at shift start and{" "}
          <b className="text-text">closing</b> odometer at its last reading in the shift — if a truck switches off
          before the shift ends, that's its closing reading.
        </p>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setDate(shiftDay(date, -1))}
            className="rounded-lg border border-border bg-panel p-2 text-muted shadow-sm hover:text-text"
          >
            <ChevronLeft size={16} />
          </button>
          <input
            type="date"
            value={date}
            max={today}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            className="rounded-lg border border-border bg-panel px-3 py-1.5 text-sm text-text shadow-sm"
          />
          <button
            onClick={() => setDate(shiftDay(date, 1))}
            disabled={date >= today}
            className="rounded-lg border border-border bg-panel p-2 text-muted shadow-sm hover:text-text disabled:opacity-40"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <StateBlock loading={loading && !data} error={error}>
        {data && data.shifts.map((s) => <ShiftCard key={s.id} shift={s} />)}
      </StateBlock>

      <p className="text-xs text-muted">
        Shift III runs overnight into the next morning. Volvo trucks report hourly and on ignition on/off, so their
        readings fall on those events. "No data after" = the truck's device stopped sending (not necessarily switched
        off).
      </p>
    </div>
  );
}
