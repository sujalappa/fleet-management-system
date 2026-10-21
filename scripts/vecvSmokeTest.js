/**
 * One-off connectivity check for the VECV Partner API — NOT part of the
 * poller. Run this first after adding VECV_API_KEY to .env, before trusting
 * the full poller: it confirms auth works and shows the raw Location API
 * response for one chassis number, which immediately reveals whether the
 * gateway also requires X-IBM-Client-Id (see services/vecv/client.js).
 *
 * Usage: node scripts/vecvSmokeTest.js [chassisNo]
 * Defaults to one of the spec's own example chassis numbers if none given.
 */
import "dotenv/config";
import { isConfigured, getToken } from "../services/vecv/tokenManager.js";
import { getLocation } from "../services/vecv/location.js";
import { getFuelData } from "../services/vecv/fuel.js";

const EXAMPLE_CHASSIS_NO = "MC2CASRF0PD090409"; // from the PDF's own Location API example

async function main() {
  if (!isConfigured()) {
    console.error("VECV_API_KEY is not set in .env — add it before running this script.");
    process.exit(1);
  }

  const chassisNo = process.argv[2] || EXAMPLE_CHASSIS_NO;
  console.log(`Testing VECV connectivity for chassisNo: ${chassisNo}`);

  console.log("\n1. Fetching auth token...");
  const token = await getToken();
  console.log(`   OK — token acquired (${token.slice(0, 12)}...)`);

  console.log("\n2. Calling Location API...");
  try {
    const locations = await getLocation([chassisNo]);
    console.log("   Response:", JSON.stringify(locations, null, 2));
  } catch (error) {
    console.error("   FAILED:", error.message);
    console.error("   If this is a 401/403, check whether VECV_CLIENT_ID (X-IBM-Client-Id) is needed.");
  }

  console.log("\n3. Calling Fuel API...");
  try {
    const fuel = await getFuelData([chassisNo]);
    console.log("   Response:", JSON.stringify(fuel, null, 2));
  } catch (error) {
    console.error("   FAILED:", error.message);
  }
}

main().catch((error) => {
  console.error("Smoke test failed:", error);
  process.exit(1);
});
