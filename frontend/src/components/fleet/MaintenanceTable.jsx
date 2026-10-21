import Badge from "../common/Badge.jsx";

const STATUS_TONE = {
  completed: "ok",
  in_progress: "warn",
  overdue: "bad",
  scheduled: "info",
  cancelled: "neutral"
};

const formatType = (type) => type?.replace(/_/g, " ");

export default function MaintenanceTable({ records }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-panel shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-slate-50 text-left text-xs uppercase tracking-wide text-muted">
            <th className="px-4 py-3">Vehicle</th>
            <th className="px-4 py-3">Nature of Breakdown</th>
            <th className="px-4 py-3">Reported By</th>
            <th className="px-4 py-3">Response</th>
            <th className="px-4 py-3">Spares Used</th>
            <th className="px-4 py-3">Status</th>
          </tr>
        </thead>
        <tbody>
          {records.map((m) => (
            <tr key={m._id} className="border-b border-border/60 last:border-0 hover:bg-panel-hover">
              <td className="px-4 py-3 font-medium text-text">{m.vehicle_id}</td>
              <td className="px-4 py-3 text-muted capitalize">{formatType(m.maintenance_type)}</td>
              <td className="px-4 py-3 text-muted">{m.reported_by || "—"}</td>
              <td className="px-4 py-3 text-muted">
                {m.response_time_minutes != null ? `${m.response_time_minutes} min` : "—"}
              </td>
              <td className="px-4 py-3 text-muted">{m.spares_used || "—"}</td>
              <td className="px-4 py-3">
                <Badge tone={STATUS_TONE[m.status] || "neutral"}>{m.status?.replace("_", " ")}</Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
