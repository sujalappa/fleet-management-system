import { AlertTriangle, Check } from "lucide-react";
import Badge from "../common/Badge.jsx";

const SEVERITY_TONE = { low: "info", medium: "warn", high: "idle", critical: "bad" };

export default function AlertFeed({ alerts, onAcknowledge }) {
  return (
    <div className="flex flex-col gap-2">
      {alerts.map((alert) => (
        <div
          key={alert._id}
          className="flex items-center justify-between gap-3 rounded-lg border border-border bg-panel px-4 py-3"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-border/40 text-muted">
              <AlertTriangle size={16} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm text-text">
                <span className="font-medium">{alert.vehicle_id || "Fleet"}</span>
                <span className="text-muted">·</span>
                <span className="truncate">{alert.fault_name || alert.message}</span>
                <Badge tone={SEVERITY_TONE[alert.severity] || "neutral"}>{alert.severity}</Badge>
                {alert.source === "telematics" && <Badge tone="ok">Live</Badge>}
              </div>
              <div className="text-xs text-muted truncate">
                {alert.external_alert_type || alert.alert_type?.replace(/_/g, " ")} ·{" "}
                {new Date(alert.createdAt).toLocaleString()}
              </div>
            </div>
          </div>

          {alert.is_acknowledged ? (
            <Badge tone="ok">
              <Check size={11} /> Acknowledged
            </Badge>
          ) : (
            <button
              onClick={() => onAcknowledge(alert._id)}
              className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-xs text-muted hover:border-accent/50 hover:text-text"
            >
              Acknowledge
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
