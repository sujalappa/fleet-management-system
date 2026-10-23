import { useEffect } from "react";
import { X, Fuel, Gauge, Clock, Droplet, Route } from "lucide-react";
import useFetch from "../../hooks/useFetch.js";
import api from "../../services/api.js";
import StateBlock from "../common/StateBlock.jsx";

const DASH = "—";
const num = (v, unit = "", dp) =>
  v == null ? DASH : `${dp != null ? Number(v).toFixed(dp) : Number(v).toLocaleString("en-IN")}${unit}`;
const when = (d) =>
  d
    ? new Date(d).toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit"
      })
    : DASH;

// 1.15 h → "1 h 9 min"
function duration(hours) {
  if (hours == null) return DASH;
  const total = Math.round(hours * 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h ? `${h} h ${m} min` : `${m} min`;
}

function Stat({ label, value, icon: Icon }) {
  return (
    <div className="rounded-lg border border-border bg-panel p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted">
        {Icon && <Icon size={13} />}
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold tracking-tight text-text">{value}</div>
    </div>
  );
}

function UsageSection({ title, since, usage }) {
  const partial = usage?.data_from && since && new Date(usage.data_from) - new Date(since) > 10 * 60 * 1000;
  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-text">{title}</h3>
        <span className="text-xs text-muted">{since ? `Since ${when(since)}` : ""}</span>
      </div>
      {usage && usage.distance_km !== undefined ? (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Distance travelled" value={num(usage.distance_km, " km")} icon={Route} />
            <Stat label="Fuel consumption" value={num(usage.fuel_used_l, " L")} icon={Fuel} />
            <Stat label="Fuel efficiency" value={num(usage.km_per_l, " km/L", 2)} icon={Gauge} />
            <Stat label="Ignition time" value={duration(usage.ignition_hours)} icon={Clock} />
          </div>
          {partial && (
            <p className="mt-1.5 text-xs text-muted">Truck reported only from {when(usage.data_from)} in this window.</p>
          )}
        </>
      ) : (
        <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-sm text-muted">
          No readings from this truck in this period.
        </p>
      )}
    </section>
  );
}

// Slide-in panel with a truck's current readings and usage windows.
// `period` = the row from the Fuel & Performance table (selected date range).
export default function VehicleDetailPanel({ vehicle, period, periodLabel, onClose }) {
  const { data, loading, error } = useFetch(
    () => api.get(`/analytics/vehicle/${vehicle.vehicle_id}/summary`),
    [vehicle.vehicle_id]
  );

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const c = data?.current;

  return (
    <div className="fixed inset-0 z-[1100] flex justify-end">
      <div className="absolute inset-0 bg-slate-900/30" onClick={onClose} />
      <aside className="relative flex h-full w-full max-w-md flex-col overflow-y-auto bg-ink shadow-2xl">
        <header className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-border bg-panel px-5 py-4">
          <div>
            <div className="text-lg font-semibold tracking-tight text-text">{vehicle.vehicle_number}</div>
            <div className="text-xs text-muted">
              {[data?.oem || vehicle.oem, data?.model, data?.chassis_number].filter(Boolean).join(" · ")}
            </div>
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 text-muted transition hover:bg-panel-hover hover:text-text">
            <X size={18} />
          </button>
        </header>

        <div className="flex flex-col gap-6 px-5 py-5">
          <StateBlock loading={loading && !data} error={error}>
            {data && (
              <>
                <section>
                  <div className="mb-2 flex items-baseline justify-between gap-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-text">Current status</h3>
                    <span className="text-xs text-muted">{c ? `Updated ${when(c.updated_at)}` : ""}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Stat
                      label="Fuel level"
                      value={c?.fuel_level_l != null ? `${num(c.fuel_level_l, " L")} (${c.fuel_level_pct}%)` : DASH}
                      icon={Fuel}
                    />
                    <Stat label="Odometer" value={num(c?.odometer_km, " km")} icon={Route} />
                    <Stat label="Engine hours" value={num(c?.engine_hours, " h")} icon={Clock} />
                    <Stat label="DEF level" value={num(c?.def_level_l, " L")} icon={Droplet} />
                  </div>
                  {data.oem === "Volvo" && (
                    <p className="mt-1.5 text-xs text-muted">
                      Fuel and DEF level aren't included in the Volvo Fuel & Environment subscription.
                    </p>
                  )}
                </section>

                {period && (
                  <section>
                    <div className="mb-2 flex items-baseline justify-between gap-2">
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-text">Selected period</h3>
                      <span className="text-xs text-muted">{periodLabel}</span>
                    </div>
                    {period.fuel_used_l != null || period.distance_km != null ? (
                      <div className="grid grid-cols-2 gap-2">
                        <Stat label="Distance travelled" value={num(period.distance_km, " km")} icon={Route} />
                        <Stat label="Fuel consumption" value={num(period.fuel_used_l, " L")} icon={Fuel} />
                        <Stat label="Fuel efficiency" value={num(period.km_per_l, " km/L", 2)} icon={Gauge} />
                        <Stat label="Engine hours" value={duration(period.engine_hours)} icon={Clock} />
                        {period.idle_hours != null && (
                          <Stat label="Idle time" value={`${duration(period.idle_hours)} (${period.idle_pct}%)`} icon={Clock} />
                        )}
                        {period.idle_fuel_l != null && <Stat label="Idle fuel" value={num(period.idle_fuel_l, " L")} icon={Fuel} />}
                      </div>
                    ) : (
                      <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-sm text-muted">
                        No readings from this truck in this period.
                      </p>
                    )}
                  </section>
                )}

                <UsageSection title="Last 2 hours" since={data.last_2h?.since} usage={data.last_2h} />
                <UsageSection title="Last 24 hours" since={data.last_24h?.since} usage={data.last_24h} />
              </>
            )}
          </StateBlock>
        </div>
      </aside>
    </div>
  );
}
