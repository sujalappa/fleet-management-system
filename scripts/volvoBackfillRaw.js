/**
 * Re-fetches Volvo's full 14-day status history and restores the complete
 * raw report (including the *Class histograms) on reports that were stored
 * slimmed. Safe to re-run.
 *
 * Usage: node scripts/volvoBackfillRaw.js [projectId]
 */
import "dotenv/config";
import mongoose from "mongoose";
import connectDB from "../config/database.js";
import { getProjectModel } from "../model/index.js";
import { getStatusesSince, field, isVolvoConfigured } from "../services/volvo/client.js";

async function main() {
  const projectId = process.argv[2] || "kamptee";
  if (!isVolvoConfigured()) {
    console.error("Volvo credentials missing in .env.");
    process.exitCode = 1;
    return;
  }

  await connectDB();
  const VehicleStatus = getProjectModel(projectId, "VehicleStatus");

  const since = new Date(Date.now() - 13.9 * 24 * 60 * 60 * 1000);
  console.log(`Fetching Volvo status history since ${since.toISOString()} ...`);
  const reports = await getStatusesSince(since);
  console.log(`Fetched ${reports.length} reports.`);

  let restored = 0;
  for (const r of reports) {
    const externalRef = `${field(r, "vin")}:${field(r, "createdDateTime")}:${field(field(r, "triggerType"), "triggerType")}`;
    const result = await VehicleStatus.updateOne({ external_ref: externalRef }, { $set: { raw_data: r } });
    restored += result.modifiedCount;
  }
  console.log(`Restored full raw data on ${restored} stored report(s).`);
  await mongoose.disconnect();
}

main().catch((error) => {
  console.error("Backfill failed:", error.message);
  process.exitCode = 1;
});
