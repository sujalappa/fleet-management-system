/**
 * Finds where trucks actually load and dump, from saved GPS — no manual pins.
 *
 *  1. Stops: consecutive GPS points at (near) zero speed form one stop
 *     (location = mean position, duration = first → last point).
 *  2. Spots: stops within CLUSTER_M of a spot's centre are grouped together.
 *  3. Ranking: by number of separate visits — a loading or dump point is
 *     visited every cycle by many trucks, while a breakdown or parking stop
 *     is one long visit, so it can't outrank them on visit count.
 *  4. Suggested geofence per spot: centre = dwell-weighted centre of its
 *     stops; radius = 90th-percentile stop distance + 50 m margin (min 100 m).
 *
 * Usage:
 *   node scripts/discoverZones.js [--hours=6] [--from=YYYY-MM-DDTHH:MM] [--to=...] [--project=kamptee]
 * Times are IST. Reads the same database the deployed backend writes to.
 */
import "dotenv/config";
import mongoose from "mongoose";
import connectDB from "../config/database.js";
import { getProjectModel } from "../model/index.js";

const STOP_SPEED_KMH = 3; // at or below this, the truck is standing
const MAX_GAP_MIN = 20; // a longer silence ends the stop (break / device off)
const CLUSTER_M = 150;
const MIN_VISITS = 2;

function meters(lat1, lng1, lat2, lng2) {
  const r = (d) => (d * Math.PI) / 180;
  const h =
    Math.sin(r(lat2 - lat1) / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lng2 - lng1) / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

const isStanding = (p) =>
  (p.speed != null ? p.speed <= STOP_SPEED_KMH : false) || ["IDLING", "STOPPED"].includes(p.vehicle_status);

// Turns one truck's GPS track into stops.
function stopsOf(points, vehicleId) {
  const stops = [];
  let run = [];
  const close = () => {
    if (!run.length) return;
    const lat = run.reduce((s, p) => s + p.latitude, 0) / run.length;
    const lng = run.reduce((s, p) => s + p.longitude, 0) / run.length;
    const minutes = (run.at(-1).device_timestamp - run[0].device_timestamp) / 60000;
    stops.push({ vehicleId, lat, lng, minutes, from: run[0].device_timestamp, to: run.at(-1).device_timestamp });
    run = [];
  };
  for (const p of points) {
    const prev = run.at(-1);
    const gapMin = prev ? (p.device_timestamp - prev.device_timestamp) / 60000 : 0;
    if (!isStanding(p) || gapMin > MAX_GAP_MIN) close();
    if (isStanding(p)) run.push(p);
  }
  close();
  return stops;
}

function cluster(stops) {
  const spots = [];
  // Longest stops first, so a spot's centre settles on where trucks dwell.
  for (const s of [...stops].sort((a, b) => b.minutes - a.minutes)) {
    const spot = spots.find((c) => meters(c.lat, c.lng, s.lat, s.lng) <= CLUSTER_M);
    if (!spot) {
      spots.push({ lat: s.lat, lng: s.lng, stops: [s] });
      continue;
    }
    spot.stops.push(s);
    // Dwell-weighted centre (each stop weighs at least 1 minute).
    const w = spot.stops.map((x) => Math.max(1, x.minutes));
    const total = w.reduce((a, b) => a + b, 0);
    spot.lat = spot.stops.reduce((acc, x, i) => acc + x.lat * w[i], 0) / total;
    spot.lng = spot.stops.reduce((acc, x, i) => acc + x.lng * w[i], 0) / total;
  }
  return spots.map((c) => {
    const dists = c.stops.map((x) => meters(c.lat, c.lng, x.lat, x.lng)).sort((a, b) => a - b);
    const p90 = dists[Math.min(dists.length - 1, Math.floor(dists.length * 0.9))] || 0;
    const mins = c.stops.map((x) => x.minutes).sort((a, b) => a - b);
    return {
      lat: c.lat,
      lng: c.lng,
      visits: c.stops.length,
      trucks: new Set(c.stops.map((x) => x.vehicleId)).size,
      totalMinutes: Math.round(mins.reduce((a, b) => a + b, 0)),
      medianMinutes: Math.round(mins[Math.floor(mins.length / 2)] * 10) / 10,
      suggestedRadius: Math.max(100, Math.ceil((p90 + 50) / 10) * 10)
    };
  });
}

async function main() {
  const args = process.argv.slice(2);
  const flag = (n, d) => args.find((a) => a.startsWith(`--${n}=`))?.split("=")[1] ?? d;
  const projectId = flag("project", "kamptee");
  const to = flag("to") ? new Date(`${flag("to")}:00+05:30`) : new Date();
  const from = flag("from")
    ? new Date(`${flag("from")}:00+05:30`)
    : new Date(to.getTime() - Number(flag("hours", 6)) * 3600e3);

  await connectDB();
  const Vehicle = getProjectModel(projectId, "Vehicle");
  const GPSLog = getProjectModel(projectId, "GPSLog");
  const Geofence = getProjectModel(projectId, "Geofence");

  const vehicles = await Vehicle.find({ status: { $ne: "inactive" }, data_source: { $ne: "simulated" } }).lean();
  const names = new Map(vehicles.map((v) => [v.vehicle_id, v.vehicle_number]));
  const zones = await Geofence.find({ status: "active" }).lean();

  let allStops = [];
  let pointCount = 0;
  let trucksWithGps = 0;
  for (const v of vehicles) {
    const points = await GPSLog.find({ vehicle_id: v.vehicle_id, device_timestamp: { $gte: from, $lte: to } })
      .sort({ device_timestamp: 1 })
      .lean();
    pointCount += points.length;
    if (points.length) trucksWithGps++;
    allStops = allStops.concat(stopsOf(points, v.vehicle_id));
  }

  const ist = (d) => d.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour12: false });
  console.log(`\nWindow ${ist(from)} → ${ist(to)} IST`);
  console.log(`${pointCount} GPS points from ${trucksWithGps} truck(s) with GPS → ${allStops.length} stops\n`);

  const spots = cluster(allStops)
    .filter((s) => s.visits >= MIN_VISITS)
    .sort((a, b) => b.visits - a.visits || b.totalMinutes - a.totalMinutes);

  if (!spots.length) {
    console.log(`No spot visited ${MIN_VISITS}+ times yet — collect more GPS (a full shift is ideal).`);
  }
  console.log("rank  centre                 visits trucks  total   median  radius   nearest current zone");
  spots.forEach((s, i) => {
    const near = zones
      .map((z) => ({ z, d: meters(s.lat, s.lng, z.latitude, z.longitude) }))
      .sort((a, b) => a.d - b.d)[0];
    const nearTxt = near
      ? `${near.z.name} ${Math.round(near.d)} m${near.d <= near.z.radius_meters ? " (inside)" : ""}`
      : "—";
    console.log(
      `${String(i + 1).padStart(3)}   ${s.lat.toFixed(5)}, ${s.lng.toFixed(5)}  ${String(s.visits).padStart(5)} ${String(s.trucks).padStart(6)}  ${String(s.totalMinutes).padStart(4)}m  ${String(s.medianMinutes).padStart(5)}m  ${String(s.suggestedRadius).padStart(4)} m   ${nearTxt}`
    );
  });

  if (allStops.length) {
    console.log("\nLongest single stops (possible breakdowns / parking — not loading or dumping):");
    [...allStops]
      .sort((a, b) => b.minutes - a.minutes)
      .slice(0, 5)
      .forEach((s) =>
        console.log(
          `  ${names.get(s.vehicleId) || s.vehicleId}  ${Math.round(s.minutes)} min at ${s.lat.toFixed(5)}, ${s.lng.toFixed(5)}  (${ist(s.from)})`
        )
      );
  }
  await mongoose.disconnect();
}

main().catch((error) => {
  console.error("Zone discovery failed:", error.message);
  process.exitCode = 1;
});
