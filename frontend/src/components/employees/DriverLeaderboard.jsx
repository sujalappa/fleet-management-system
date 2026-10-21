import { AlertTriangle } from "lucide-react";
import Badge from "../common/Badge.jsx";

export default function DriverLeaderboard({ drivers }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-panel shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-slate-50 text-left text-xs uppercase tracking-wide text-muted">
            <th className="px-4 py-3">#</th>
            <th className="px-4 py-3">Driver</th>
            <th className="px-4 py-3">Trips</th>
            <th className="px-4 py-3">Volume Moved</th>
            <th className="px-4 py-3">Fuel Economy</th>
            <th className="px-4 py-3">Avg Cycle Time</th>
            <th className="px-4 py-3">License</th>
          </tr>
        </thead>
        <tbody>
          {drivers.map((d) => (
            <tr key={d.driver_id} className="border-b border-border/60 last:border-0 hover:bg-panel-hover">
              <td className="px-4 py-3 font-semibold text-accent">#{d.rank}</td>
              <td className="px-4 py-3 font-medium text-text">{d.name}</td>
              <td className="px-4 py-3 text-muted">{d.trips_completed}</td>
              <td className="px-4 py-3 text-muted">{d.cum_moved?.toLocaleString()} cum</td>
              <td className="px-4 py-3 text-muted">
                {d.fuel_economy_l_per_cum != null ? `${d.fuel_economy_l_per_cum} L/cum` : "—"}
              </td>
              <td className="px-4 py-3 text-muted">{d.avg_cycle_time_minutes} min</td>
              <td className="px-4 py-3">
                {d.license_expiring_soon ? (
                  <Badge tone="bad">
                    <AlertTriangle size={11} /> Expiring soon
                  </Badge>
                ) : (
                  <Badge tone="ok">Valid</Badge>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
