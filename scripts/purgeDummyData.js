/**
 * Removes all seeded demo data from a project's DUMMY database, keeping only
 * real telemetry (source "telematics") and onboarded vehicles
 * (data_source "vecv_live"). `npm run seed` restores the demo data.
 *
 * Usage: node scripts/purgeDummyData.js [projectId] --confirm
 *
 * Refuses to touch any database not named dummy_* — collections like
 * drivers and geofences have no source tag, so in a real database seeded
 * and real documents couldn't be told apart.
 */
import "dotenv/config";
import mongoose from "mongoose";
import connectDB from "../config/database.js";
import { getProjectDb } from "../config/projectDb.js";

// Collections that only ever held seeded demo data in the dummy database.
const WIPE_ENTIRELY = ["drivers", "assignments", "cameraevents", "geofences", "gpsdevices"];
// Collections that may also contain real data — only seeded rows go.
const WIPE_SEED_ONLY = ["trips", "maintenances"];

async function main() {
  const args = process.argv.slice(2);
  const projectId = args.find((a) => !a.startsWith("--")) || "kamptee";
  const confirmed = args.includes("--confirm");

  await connectDB();
  const db = getProjectDb(projectId).db;

  if (!db.databaseName.startsWith("dummy_")) {
    console.error(`Refusing to purge "${db.databaseName}" — only dummy_* databases are allowed.`);
    process.exit(1);
  }

  const plan = [
    ...WIPE_ENTIRELY.map((name) => ({ name, filter: {} })),
    ...WIPE_SEED_ONLY.map((name) => ({ name, filter: { source: "seed" } })),
    { name: "vehicles", filter: { data_source: { $ne: "vecv_live" } } }
  ];

  console.log(`${confirmed ? "Purging" : "Dry run for"} ${db.databaseName}:`);
  for (const { name, filter } of plan) {
    const col = db.collection(name);
    const count = await col.countDocuments(filter);
    if (confirmed && count) await col.deleteMany(filter);
    console.log(`  ${name.padEnd(14)} ${confirmed ? "deleted" : "would delete"} ${count}`);
  }

  // Real vehicles shouldn't point at the deleted demo drivers/devices.
  const unset = { current_driver_id: "", gps_device_id: "" };
  if (confirmed) {
    await db.collection("vehicles").updateMany({ data_source: "vecv_live" }, { $unset: unset });
  }

  if (!confirmed) console.log("\nRe-run with --confirm to actually delete.");
  await mongoose.disconnect();
}

main().catch((error) => {
  console.error("Purge failed:", error.message);
  process.exit(1);
});
