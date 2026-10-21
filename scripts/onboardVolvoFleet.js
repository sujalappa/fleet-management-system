/**
 * Onboards the Volvo FM fleet (projects/kamptee/volvoFleet.js) onto live
 * Volvo Connect telemetry. Every VIN is checked against the trucks the API
 * account can actually see before anything is written. Safe to re-run —
 * it updates existing trucks in place (e.g. after a trailer swap).
 *
 * Usage: node scripts/onboardVolvoFleet.js [projectId]
 */
import "dotenv/config";
import mongoose from "mongoose";
import connectDB from "../config/database.js";
import { getProjectModel } from "../model/index.js";
import { getVehicles, field, isVolvoConfigured } from "../services/volvo/client.js";
import { volvoFleet } from "../projects/kamptee/volvoFleet.js";

async function main() {
  const projectId = process.argv[2] || "kamptee";
  if (!isVolvoConfigured()) {
    console.error("Set VOLVO_API_USERNAME and VOLVO_API_PASSWORD in .env first.");
    process.exitCode = 1;
    return;
  }

  const apiVehicles = await getVehicles();
  const apiByVin = new Map(apiVehicles.map((v) => [field(v, "vin"), v]));
  console.log(`Volvo API account sees ${apiVehicles.length} truck(s).`);

  const missing = volvoFleet.filter((t) => !apiByVin.has(t.vin));
  if (missing.length) {
    console.error("These VINs are not on the Volvo API account — fix volvoFleet.js:");
    for (const t of missing) console.error(`  ${t.chassisNo}  ${t.vin}`);
    process.exitCode = 1;
    return;
  }
  const unlisted = apiVehicles.filter((v) => !volvoFleet.some((t) => t.vin === field(v, "vin")));
  for (const v of unlisted) console.warn(`Not in volvoFleet.js (skipped): ${field(v, "vin")}`);

  await connectDB();
  const Vehicle = getProjectModel(projectId, "Vehicle");

  for (const truck of volvoFleet) {
    const api = apiByVin.get(truck.vin);
    await Vehicle.updateOne(
      { vehicle_id: truck.chassisNo },
      {
        $set: {
          vehicle_number: truck.chassisNo,
          chassis_number: truck.vin,
          engine_number: truck.engineNo,
          trailer_number: truck.trailerNo,
          manufacturer: "Volvo",
          model: field(api, "model"),
          data_source: "volvo_live"
        },
        $setOnInsert: { equipment_type: "tipper", status: "active" }
      },
      { upsert: true }
    );
    console.log(`  ${truck.chassisNo}  ${truck.vin}  trailer ${truck.trailerNo}`);
  }

  console.log(`Onboarded ${volvoFleet.length} Volvo trucks into project "${projectId}". Restart the backend to start polling.`);
  await mongoose.disconnect();
}

main().catch((error) => {
  console.error("Volvo onboarding failed:", error.message);
  process.exit(1);
});
