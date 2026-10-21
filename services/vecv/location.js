import { vecvPost, parseVecvTimestamp } from "./client.js";

const LOCATION_URL = "https://partnerapi.vecv.net/service-gateway/vehicle/v1/getlivedata/location";

// Fetches current location for every chassis number in one batched call —
// respects VECV's 1 req/min limit by covering the whole fleet per call.
export async function getLocation(chassisNoList, keyEnv) {
  const body = await vecvPost(LOCATION_URL, { chassisNo: chassisNoList }, keyEnv);

  return (body.locationData || []).map((row) => ({
    regNo: row.regNo,
    chassisNo: row.chassisNo,
    deviceId: row.deviceId,
    latitude: row.latitude,
    longitude: row.longitude,
    vehicleStatus: row.vehicleStatus,
    vehicleSpeed: row.vehicleSpeed,
    vehicleDirection: row.vehicleDirection,
    odometerKm: row.odometer,
    deviceTimestamp: parseVecvTimestamp(row.lastUpdated),
    epochTime: row.epochTime,
    raw: row
  }));
}
