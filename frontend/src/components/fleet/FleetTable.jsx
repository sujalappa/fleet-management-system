import Badge from "../common/Badge.jsx";

const DASH = "—";

const STATE_TONE = {
  on_trip: "ok",
  recently_active: "info",
  idle: "idle",
  breakdown: "bad",
  maintenance: "warn",
  no_data: "neutral"
};

const STATE_LABEL = {
  on_trip: "On Trip",
  recently_active: "Recently Active",
  idle: "Idle",
  breakdown: "Breakdown",
  maintenance: "Maintenance",
  no_data: "No Data Yet"
};

const STATUS_TONE = { MOVING: "ok", IDLING: "idle", STOPPED: "info", IGNITION_ON: "ok", IGNITION_OFF: "neutral", TIMER: "ok", NO_SIGNAL: "neutral" };

// Volvo's hourly TIMER report is only sent while the engine runs.
const STATUS_LABEL = { NO_SIGNAL: "NO SIGNAL", TIMER: "RUNNING", IGNITION_ON: "IGNITION ON", IGNITION_OFF: "IGNITION OFF" };

const OEM_LABEL = { vecv_live: "Eicher", volvo_live: "Volvo" };

// 25621 → "17d 19h", 95 → "1h 35m", 11 → "11m"
function formatDuration(minutes) {
  if (minutes < 60) return `${minutes}m`;
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  return `${hours}h ${minutes % 60}m`;
}

// GPS status when available; otherwise the last ignition event (Volvo
// trucks without a positioning subscription).
function liveStatus(v) {
  if (v.last_gps?.stale) return "NO_SIGNAL";
  return v.last_gps?.vehicleStatus || v.last_status?.trigger || null;
}

export default function FleetTable({ fleet }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-panel shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-slate-50 text-left text-xs uppercase tracking-wide text-muted">
            <th className="px-4 py-3">Vehicle</th>
            <th className="px-4 py-3">OEM</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">State</th>
            <th className="px-4 py-3">Fuel</th>
            <th className="px-4 py-3">DEF</th>
            <th className="px-4 py-3">Odometer</th>
            <th className="px-4 py-3">Engine Hrs</th>
            <th className="px-4 py-3">Fuel Used</th>
            <th className="px-4 py-3">Idle Time</th>
            <th className="px-4 py-3">Idle Fuel</th>
            <th className="px-4 py-3">Last Trip</th>
            <th className="px-4 py-3">Volume</th>
            <th className="px-4 py-3">Last Update</th>
          </tr>
        </thead>
        <tbody>
          {fleet.map((v) => (
            <tr key={v.vehicle_id} className="border-b border-border/60 last:border-0 hover:bg-panel-hover">
              <td className="px-4 py-3 whitespace-nowrap">
                <div className="font-medium text-text">{v.vehicle_number}</div>
                {v.trailer_number && <div className="text-xs text-muted">Trailer {v.trailer_number}</div>}
              </td>
              <td className="px-4 py-3 text-muted">{OEM_LABEL[v.data_source] || DASH}</td>
              <td className="px-4 py-3 whitespace-nowrap">
                {liveStatus(v) ? (
                  <Badge tone={STATUS_TONE[liveStatus(v)] || "neutral"}>{STATUS_LABEL[liveStatus(v)] || liveStatus(v)}</Badge>
                ) : (
                  DASH
                )}
              </td>
              <td className="px-4 py-3">
                <Badge tone={STATE_TONE[v.operational_state] || "neutral"}>
                  {STATE_LABEL[v.operational_state] || v.operational_state}
                  {v.operational_state === "idle" ? ` · ${formatDuration(v.idle_minutes)}` : ""}
                </Badge>
              </td>
              <td className="px-4 py-3 text-muted whitespace-nowrap">
                {v.last_fuel?.liters != null ? `${v.last_fuel.liters} L (${v.last_fuel.percent}%)` : DASH}
              </td>
              <td className="px-4 py-3 text-muted whitespace-nowrap">
                {v.last_fuel?.def_liters != null ? `${v.last_fuel.def_liters} L` : DASH}
              </td>
              <td className="px-4 py-3 text-muted whitespace-nowrap">
                {v.odometer_km != null ? `${v.odometer_km.toLocaleString()} km` : DASH}
              </td>
              <td className="px-4 py-3 text-muted">{v.engine_hours ?? DASH}</td>
              <td className="px-4 py-3 text-muted whitespace-nowrap">
                {v.fuel_used_liters != null ? `${v.fuel_used_liters.toLocaleString()} L` : DASH}
              </td>
              <td className="px-4 py-3 text-muted whitespace-nowrap">
                {v.idle_hours != null ? `${v.idle_hours} h${v.idle_pct != null ? ` (${v.idle_pct}%)` : ""}` : DASH}
              </td>
              <td className="px-4 py-3 text-muted whitespace-nowrap">
                {v.idle_fuel_liters != null ? `${v.idle_fuel_liters.toLocaleString()} L` : DASH}
              </td>
              <td className="px-4 py-3 text-muted">
                {v.last_trip
                  ? `${v.last_trip.material_type} · ${new Date(v.last_trip.start_time).toLocaleString()}`
                  : DASH}
              </td>
              <td className="px-4 py-3 text-muted">
                {v.last_trip ? `${v.last_trip.volume_cum} cum` : DASH}
              </td>
              <td className="px-4 py-3 text-muted whitespace-nowrap">
                {v.last_gps || v.last_status
                  ? new Date(v.last_gps?.updatedAt || v.last_status.updatedAt).toLocaleString()
                  : DASH}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
