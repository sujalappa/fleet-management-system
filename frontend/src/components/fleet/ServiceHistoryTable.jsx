export default function ServiceHistoryTable({ records }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-panel shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-slate-50 text-left text-xs uppercase tracking-wide text-muted">
            <th className="px-4 py-3">Vehicle</th>
            <th className="px-4 py-3">Job Card</th>
            <th className="px-4 py-3">Dealer</th>
            <th className="px-4 py-3">Order Type</th>
            <th className="px-4 py-3">Total Cost</th>
            <th className="px-4 py-3">Opened</th>
          </tr>
        </thead>
        <tbody>
          {records.map((r) => (
            <tr key={r._id} className="border-b border-border/60 last:border-0 hover:bg-panel-hover">
              <td className="px-4 py-3 font-medium text-text">{r.vehicle_id || r.chassis_number}</td>
              <td className="px-4 py-3 text-muted">{r.job_card_number || "—"}</td>
              <td className="px-4 py-3 text-muted">{r.dealer_name || "—"}</td>
              <td className="px-4 py-3 text-muted">{r.order_type_description || "—"}</td>
              <td className="px-4 py-3 text-muted">
                {r.total_cost_cust != null ? `₹${r.total_cost_cust.toLocaleString()}` : "—"}
              </td>
              <td className="px-4 py-3 text-muted">
                {r.job_card_open_date ? new Date(r.job_card_open_date).toLocaleDateString() : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
