import { vecvPost, parseVecvTimestamp } from "./client.js";

const FUEL_URL = "https://partnerapi.vecv.net/service-gateway/vehicle/v1/getlivedata/fuelData";

// Fetches current fuel/EV data for every chassis number in one batched call.
export async function getFuelData(chassisNoList, keyEnv) {
  const body = await vecvPost(FUEL_URL, { chassisNo: chassisNoList }, keyEnv);

  return (body.fuelData || []).map((row) => ({
    regNo: row.regNo,
    chassisNo: row.chassisNo,
    latitude: row.latitude,
    longitude: row.longitude,
    fuelType: row.fuelType,
    vehicleStatus: row.vehicleStatus,
    vehicleSpeed: row.vehicleSpeed,
    odometerKm: row.odometer,
    fuelLevelInPer: row.fuelLevelInPer,
    fuelLevelInLtr: row.fuelLevelInLtr,
    defLevelInLtr: row.defLevelInLtr,
    lifeTimeFuelConsumption: row.lifeTimeFuelConsumtion, // spelling matches the spec's own typo
    engineOperatingHours: row.engineOperatingHours,
    // EV-only
    socLevel: row.socLevel,
    batteryTemperature: row.batteryTemperature,
    co2Saving: row.co2Saving,
    deviceTimestamp: parseVecvTimestamp(row.lastUpdated),
    epochTime: row.epochTime,
    raw: row
  }));
}
