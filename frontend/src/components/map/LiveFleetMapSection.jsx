import { useEffect } from "react";
import useFetch from "../../hooks/useFetch.js";
import api from "../../services/api.js";
import { getActiveProjectId } from "../../services/auth.js";
import StateBlock from "../common/StateBlock.jsx";
import Badge from "../common/Badge.jsx";
import LiveMap from "./LiveMap.jsx";

// The poller brings in a new VECV reading about once a minute.
const REFRESH_MS = 60 * 1000;

const LEGEND = [
  { label: "Moving", color: "#22c55e" },
  { label: "Idling", color: "#fb923c" },
  { label: "Stopped", color: "#3b82f6" },
  { label: "No recent signal", color: "#8695a7" }
];

export default function LiveFleetMapSection() {
  const { data: projects, error: projectsError } = useFetch(() => api.get("/projects"), []);
  const { data: fleetData, error: fleetError, refetch } = useFetch(() => api.get("/fleet/live"), []);
  const { data: geofences } = useFetch(() => api.get("/geofences"), []);

  useEffect(() => {
    const id = setInterval(refetch, REFRESH_MS);
    return () => clearInterval(id);
  }, [refetch]);

  const project = projects?.find((p) => p.projectId === getActiveProjectId());
  // Every truck with a real GPS fix is shown — moving, idling or stopped.
  const vehicles = (fleetData?.fleet || []).filter((v) => v.last_gps);
  const withoutGps = (fleetData?.fleet || []).filter((v) => !v.last_gps);

  // Only the first load shows the loading state; later refreshes update the
  // markers in place so the map doesn't reset the user's zoom.
  const ready = project && fleetData && geofences;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-text">Live Fleet Location</h2>
        <div className="flex flex-wrap items-center gap-3">
          {LEGEND.map((item) => (
            <span key={item.label} className="flex items-center gap-1.5 text-xs text-muted">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
              {item.label}
            </span>
          ))}
          <Badge tone="ok">{vehicles.length} vehicle(s) with live GPS</Badge>
        </div>
      </div>

      {withoutGps.length > 0 && (
        <div className="rounded-lg border border-border bg-panel px-3 py-2 text-xs text-muted">
          <span className="font-medium text-text">Not on map ({withoutGps.length}):</span>{" "}
          {withoutGps.map((v) => v.vehicle_number).join(", ")}
          {withoutGps.some((v) => v.data_source === "volvo_live") &&
            " — Volvo trucks report engine/fuel data only; their current subscription has no GPS positioning."}
        </div>
      )}

      <StateBlock
        loading={!ready && !projectsError && !fleetError}
        error={ready ? null : projectsError || fleetError}
      >
        {ready && <LiveMap center={project.location.center} vehicles={vehicles} geofences={geofences || []} />}
      </StateBlock>
    </div>
  );
}
