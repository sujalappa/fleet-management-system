import { Camera, Check } from "lucide-react";
import Badge from "../common/Badge.jsx";

const SEVERITY_TONE = { critical: "bad", warning: "warn", info: "info" };

export default function CameraEventFeed({ events, onAcknowledge }) {
  return (
    <div className="flex flex-col gap-2">
      {events.map((event) => (
        <div
          key={event._id}
          className="flex items-center justify-between gap-3 rounded-lg border border-border bg-panel px-4 py-3"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-border/40 text-muted">
              <Camera size={16} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm text-text">
                <span className="font-medium">{event.vehicle_id}</span>
                <span className="text-muted">·</span>
                <span className="capitalize">{event.event_type?.replace(/_/g, " ").toLowerCase()}</span>
                <Badge tone={SEVERITY_TONE[event.severity] || "neutral"}>{event.severity}</Badge>
              </div>
              <div className="text-xs text-muted truncate">
                {event.camera_name} · {new Date(event.createdAt).toLocaleString()}
              </div>
            </div>
          </div>

          {event.is_acknowledged ? (
            <Badge tone="ok">
              <Check size={11} /> Acknowledged
            </Badge>
          ) : (
            <button
              onClick={() => onAcknowledge(event._id)}
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
