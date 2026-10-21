/**
 * Shift trip report for manual verification: every GPS point in the window
 * (with its distance to the loading and dump zones) and the trips the
 * detector counted.
 *
 * Usage:
 *   node scripts/tripReport.js <vehicle> [--date=YYYY-MM-DD] [--from=HH:MM] [--to=HH:MM]
 * Example (today's second shift):
 *   node scripts/tripReport.js TT-6580 --from=14:00 --to=22:00
 *
 * <vehicle> may be the dashboard name (TT-6580) or the vehicle id (012715).
 * Times are IST.
 */
import "dotenv/config";
import mongoose from "mongoose";
import connectDB from "../config/database.js";
import { getProjectModel } from "../model/index.js";
import { detectTrips } from "../services/trips/tripDetector.js";

const ist = (d) => (d ? new Date(d).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour12: false }) : "—");
const mins = (v) => (v == null ? "—" : `${v} min`);

function meters(lat1, lng1, lat2, lng2) {
  const r = (d) => (d * Math.PI) / 180;
  const h =
    Math.sin(r(lat2 - lat1) / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lng2 - lng1) / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

async function main() {
  const args = process.argv.slice(2);
  const flag = (n, d) => args.find((a) => a.startsWith(`--${n}=`))?.split("=")[1] ?? d;
  const who = args.find((a) => !a.startsWith("--"));
  const today = new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
  const date = flag("date", today);
  const from = new Date(`${date}T${flag("from", "00:00")}:00+05:30`);
  let to = new Date(`${date}T${flag("to", "23:59")}:00+05:30`);
  // Night shift (e.g. --from=22:00 --to=06:00) ends the next morning.
  if (to <= from) to = new Date(to.getTime() + 24 * 60 * 60 * 1000);
  if (!who) {
    console.error("Usage: node scripts/tripReport.js <vehicle> [--date=YYYY-MM-DD] [--from=HH:MM] [--to=HH:MM]");
    process.exitCode = 1;
    return;
  }

  await connectDB();
  const projectId = "kamptee";
  const Vehicle = getProjectModel(projectId, "Vehicle");
  const vehicle = await Vehicle.findOne({ $or: [{ vehicle_number: who }, { vehicle_id: who }] }).lean();
  if (!vehicle) {
    console.error(`No vehicle "${who}".`);
    process.exitCode = 1;
    await mongoose.disconnect();
    return;
  }

  await detectTrips(projectId); // make sure trips are up to date

  const Geofence = getProjectModel(projectId, "Geofence");
  const zones = await Geofence.find({ status: "active" }).lean();
  const load = zones.find((z) => z.zone_type === "loading");
  const dump = zones.find((z) => z.zone_type === "unloading");

  const GPSLog = getProjectModel(projectId, "GPSLog");
  const points = await GPSLog.find({ vehicle_id: vehicle.vehicle_id, device_timestamp: { $gte: from, $lte: to } })
    .sort({ device_timestamp: 1 })
    .lean();

  console.log(`\n${vehicle.vehicle_number} (${vehicle.chassis_number})  ${date}  ${ist(from)}–${ist(to)} IST`);
  console.log(`Zones: ${load.name} r=${load.radius_meters}m · ${dump.name} r=${dump.radius_meters}m`);
  if (points.length) console.log(`GPS coverage: ${ist(points[0].device_timestamp)} → ${ist(points.at(-1).device_timestamp)}, ${points.length} points\n`);
  console.log("time      status    speed   to load   to dump   zone");
  for (const p of points) {
    const dl = meters(p.latitude, p.longitude, load.latitude, load.longitude);
    const dd = meters(p.latitude, p.longitude, dump.latitude, dump.longitude);
    const zone = dl <= load.radius_meters ? "LOADING" : dd <= dump.radius_meters ? "DUMP" : "";
    console.log(
      `${ist(p.device_timestamp)}  ${(p.vehicle_status || "").padEnd(8)} ${String(p.speed ?? "").padStart(5)}  ${String(Math.round(dl)).padStart(6)} m  ${String(Math.round(dd)).padStart(6)} m   ${zone}`
    );
  }

  const Trip = getProjectModel(projectId, "Trip");
  const trips = await Trip.find({
    vehicle_id: vehicle.vehicle_id,
    source: "telematics",
    start_time: { $gte: from, $lte: to }
  })
    .sort({ start_time: 1 })
    .lean();
  console.log(`\nTRIPS DETECTED: ${trips.length}`);
  trips.forEach((t, i) =>
    console.log(
      `  #${i + 1}  loading ${ist(t.loading_entered_at)}–${ist(t.start_time)} (${mins(t.loading_minutes)})` +
        `  → haul ${mins(t.haul_minutes)}${t.distance_km != null ? ` / ${t.distance_km} km` : ""}` +
        `  → unloading ${ist(t.end_time)}–${ist(t.dump_left_at)} (${mins(t.unloading_minutes)})` +
        `  → return ${mins(t.return_minutes)}   cycle ${mins(t.cycle_time_minutes)}`
    )
  );
  if (trips.length) {
    const avg = (k) => {
      const v = trips.map((t) => t[k]).filter((x) => x != null);
      return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null;
    };
    console.log(
      `
  AVERAGES  loading ${mins(avg("loading_minutes"))} · haul ${mins(avg("haul_minutes"))} · unloading ${mins(avg("unloading_minutes"))} · return ${mins(avg("return_minutes"))} · cycle ${mins(avg("cycle_time_minutes"))}`
    );
  }
  await mongoose.disconnect();
}

main().catch((error) => {
  console.error("Report failed:", error.message);
  process.exitCode = 1;
});
