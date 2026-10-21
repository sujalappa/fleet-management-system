/**
 * Puts one Eicher truck on real VECV telemetry: sets chassis_number,
 * data_source "vecv_live" and which API key owns it. Creates the vehicle if
 * it doesn't exist yet.
 *
 * Usage:
 *   node scripts/onboardVehicle.js <vehicle_id> <chassis_number> [vehicle_number] [--key=ENV_NAME] [--project=ID]
 * Example:
 *   node scripts/onboardVehicle.js 012715 MC2DALRC0UA012715 012715 --key=VECV_API_KEY_2
 *
 * --key is the .env variable holding the VECV API key this truck is mapped
 * to (default VECV_API_KEY). Restart the backend afterwards.
 */
import "dotenv/config";
import mongoose from "mongoose";
import connectDB from "../config/database.js";
import { getProjectModel } from "../model/index.js";

async function main() {
  const args = process.argv.slice(2);
  const flag = (name, fallback) => args.find((a) => a.startsWith(`--${name}=`))?.split("=")[1] ?? fallback;
  const [vehicleId, chassisNumber, vehicleNumber = vehicleId] = args.filter((a) => !a.startsWith("--"));
  const keyEnv = flag("key", "VECV_API_KEY");
  const projectId = flag("project", "kamptee");

  if (!vehicleId || !chassisNumber) {
    console.error(
      "Usage: node scripts/onboardVehicle.js <vehicle_id> <chassis_number> [vehicle_number] [--key=ENV_NAME] [--project=ID]"
    );
    process.exitCode = 1;
    return;
  }
  if (!process.env[keyEnv]) {
    console.error(`${keyEnv} is not set in .env.`);
    process.exitCode = 1;
    return;
  }

  await connectDB();
  const Vehicle = getProjectModel(projectId, "Vehicle");

  const vehicle = await Vehicle.findOneAndUpdate(
    { vehicle_id: vehicleId },
    {
      $set: { chassis_number: chassisNumber, data_source: "vecv_live", api_key_env: keyEnv, status: "active" },
      $setOnInsert: { vehicle_number: vehicleNumber, manufacturer: "Eicher", equipment_type: "tipper" }
    },
    { returnDocument: "after", upsert: true }
  );

  console.log(
    `Onboarded ${vehicle.vehicle_id} (${vehicle.vehicle_number}) -> chassis ${vehicle.chassis_number}, key ${keyEnv} [project: ${projectId}]`
  );
  await mongoose.disconnect();
}

main().catch((error) => {
  console.error("Onboarding failed:", error.message);
  process.exitCode = 1;
});
