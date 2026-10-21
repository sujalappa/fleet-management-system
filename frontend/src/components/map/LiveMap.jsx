import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Circle, CircleMarker, Popup, Tooltip, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

// Colors follow VECV's own vehicleStatus values.
const STATUS_COLOR = {
  MOVING: "#22c55e",
  IDLING: "#fb923c",
  STOPPED: "#3b82f6"
};
const UNKNOWN_COLOR = "#8695a7";

const ZONE_COLOR = { loading: "#3b82f6", unloading: "#f5a524" };

// Zooms to the trucks and zones once on first load; after that the user's
// own pan/zoom is left alone across the 1-minute data refreshes.
function FitToVehicles({ vehicles, geofences }) {
  const map = useMap();
  const fitted = useRef(false);

  useEffect(() => {
    if (fitted.current || vehicles.length + geofences.length === 0) return;
    const points = [
      ...vehicles.map((v) => [v.last_gps.lat, v.last_gps.lng]),
      ...geofences.map((g) => [g.latitude, g.longitude])
    ];
    if (points.length === 1) map.setView(points[0], 15);
    else map.fitBounds(points, { padding: [60, 60], maxZoom: 16 });
    fitted.current = true;
  }, [map, vehicles, geofences]);

  return null;
}

// Trucks parked together would stack their name labels on top of each
// other, so labels alternate left/right in west-to-east order.
function labelDirections(vehicles) {
  const byLng = [...vehicles].sort((a, b) => a.last_gps.lng - b.last_gps.lng);
  return new Map(byLng.map((v, i) => [v.vehicle_id, i % 2 === 0 ? "left" : "right"]));
}

export default function LiveMap({ center, vehicles, geofences = [] }) {
  const directions = labelDirections(vehicles);

  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={12}
      scrollWheelZoom
      style={{ height: "560px", width: "100%", borderRadius: 12 }}
    >
      {/* Real satellite imagery (Esri World Imagery). */}
      <TileLayer
        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        attribution="Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics"
        maxZoom={19}
      />

      <FitToVehicles vehicles={vehicles} geofences={geofences} />

      {geofences.map((g) => (
        <Circle
          key={g.geofence_id}
          center={[g.latitude, g.longitude]}
          radius={g.radius_meters}
          pathOptions={{ color: ZONE_COLOR[g.zone_type] || UNKNOWN_COLOR, weight: 2, fillOpacity: 0.15 }}
        >
          <Tooltip direction="top" opacity={0.9}>
            {g.name} ({g.radius_meters} m)
          </Tooltip>
        </Circle>
      ))}

      {vehicles.map((v) => (
        <CircleMarker
          key={v.vehicle_id}
          center={[v.last_gps.lat, v.last_gps.lng]}
          radius={9}
          pathOptions={{
            color: "#ffffff",
            weight: 3,
            fillColor: v.last_gps.stale ? UNKNOWN_COLOR : STATUS_COLOR[v.last_gps.vehicleStatus] || UNKNOWN_COLOR,
            fillOpacity: 1
          }}
        >
          <Tooltip
            direction={directions.get(v.vehicle_id)}
            offset={directions.get(v.vehicle_id) === "left" ? [-10, 0] : [10, 0]}
            opacity={0.9}
            permanent
          >
            {v.vehicle_number}
          </Tooltip>
          <Popup>
            <div className="text-sm">
              <div className="font-semibold">{v.vehicle_number}</div>
              <div>
                {v.last_gps.stale ? "No recent signal" : `${v.last_gps.vehicleStatus || "—"} · ${v.last_gps.speed ?? "—"} km/h`}
              </div>
              <div>
                Fuel: {v.last_fuel ? `${v.last_fuel.liters} L (${v.last_fuel.percent}%)` : "—"}
              </div>
              <div>Odometer: {v.odometer_km != null ? `${v.odometer_km.toLocaleString()} km` : "—"}</div>
              <div>
                {v.last_gps.lat.toFixed(5)}, {v.last_gps.lng.toFixed(5)}
              </div>
              <div className="text-xs opacity-70">
                Updated {new Date(v.last_gps.updatedAt).toLocaleString()}
              </div>
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
