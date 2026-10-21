/**
 * Seeds the Kamptee Opencast Coal Mine project with realistic dummy data
 * matching the benchmarks in `Kamptee Data management dummy.pdf`:
 *   - 7 tippers/dumpers, 2 excavators, 1 dozer
 *   - 10 named operators
 *   - 3,210 completed haul trips totalling ~33,988.51 cum / ~17,413.10 L diesel
 *   - 36 breakdown/maintenance events across the 10 PDF failure types
 *
 * Run with: npm run seed
 *
 * SAFETY: refuses to run unless the resolved database is the dummy one
 * (projects/kamptee/config.js -> isDummyData), so pointing KAMPTEE_DB_NAME
 * at a real mine's database and running this script by mistake cannot wipe
 * real data.
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import connectDB from "../config/database.js";
import { getProjectDb } from "../config/projectDb.js";
import { getProjectModel } from "../model/index.js";
import { getProjectConfig } from "../projects/index.js";
import User from "../model/userSchema.js";

const PROJECT_ID = "kamptee";

const rand = (min, max) => min + Math.random() * (max - min);
const randInt = (min, max) => Math.floor(rand(min, max + 1));
const pick = (arr) => arr[randInt(0, arr.length - 1)];
const pad = (n, len) => String(n).padStart(len, "0");

// Scales an array of numbers so it sums to exactly `target`.
const rescaleToSum = (values, target) => {
  const sum = values.reduce((a, b) => a + b, 0);
  if (sum === 0) return values;
  const factor = target / sum;
  return values.map((v) => v * factor);
};

const FLEET = [
  { vehicle_id: "MH-32-A-4402", equipment_type: "tipper", target_cum: 8500, driver: "M. Rangari" },
  { vehicle_id: "MH-32-A-3391", equipment_type: "tipper", target_cum: 8200, driver: "T. Zade" },
  { vehicle_id: "MH-32-A-1187", equipment_type: "tipper", target_cum: 6800, driver: "R. Kale" },
  { vehicle_id: "MH-32-A-5560", equipment_type: "tipper", target_cum: 5800, driver: "S. Meshram" },
  { vehicle_id: "MH-32-A-2245", equipment_type: "tipper", target_cum: 4600, driver: "D. Ingle" },
  { vehicle_id: "DUMP-11", equipment_type: "tipper", target_cum: 44.255, driver: "V. Thakre" },
  { vehicle_id: "DUMP-12", equipment_type: "tipper", target_cum: 44.255, driver: "A. Bhoyar" },
  { vehicle_id: "EXC-01", equipment_type: "excavator", target_cum: 0, driver: "P. Rathod" },
  { vehicle_id: "EXC-02", equipment_type: "excavator", target_cum: 0, driver: "N. Waghmare" },
  { vehicle_id: "DOZ-01", equipment_type: "dozer", target_cum: 0, driver: "K. Sahare" }
];

const BREAKDOWN_TYPES = [
  "fuel_filter_choke",
  "engine_overheating",
  "hydraulic_hose_leak",
  "radiator_leakage",
  "transmission_issue",
  "electrical_fault",
  "bucket_pin_worn_out",
  "tyre_puncture",
  "brake_failure",
  "starter_motor_failure"
];

const CAMERA_EVENT_TYPES = [
  ["DSM_CABIN", "DROWSINESS", "critical"],
  ["DSM_CABIN", "PHONE_USAGE", "warning"],
  ["DSM_CABIN", "NO_SEATBELT", "warning"],
  ["ADAS_ROAD", "COLLISION_WARNING", "critical"],
  ["ADAS_ROAD", "LANE_DEPARTURE", "warning"],
  ["DUMP_REAR", "DUMPING_VIOLATION", "info"],
  ["PIT_CCTV", "BLIND_SPOT_OBJECT", "warning"]
];

const TOTAL_TRIPS = 3210;
const TOTAL_VOLUME_CUM = 33988.51;
const TOTAL_DIESEL_LITERS = 17413.1;
const AVG_CYCLE_TIME_MINUTES = 12.63;
const TOTAL_DISTANCE_KM = TOTAL_DIESEL_LITERS / 1.31; // implied by 1.31 L/km benchmark
const TOTAL_BREAKDOWNS = 36;
const TOTAL_BREAKDOWN_MINUTES = 122 * 60 + 29; // "122h 29m"
const REPORT_WINDOW_DAYS = 30;

async function main() {
  const config = getProjectConfig(PROJECT_ID);

  if (!config.isDummyData) {
    throw new Error(
      `Refusing to seed: KAMPTEE_DB_NAME points at "${config.dbName}", which is not the dummy database. ` +
        `Unset KAMPTEE_DB_NAME (or point it at a scratch database) before running the seed script.`
    );
  }

  console.log(`Seeding "${config.dbName}" for project "${PROJECT_ID}"...`);

  await connectDB();
  const db = getProjectDb(PROJECT_ID);

  const Vehicle = getProjectModel(PROJECT_ID, "Vehicle");
  const Driver = getProjectModel(PROJECT_ID, "Driver");
  const GPSDevice = getProjectModel(PROJECT_ID, "GPSDevice");
  const Geofence = getProjectModel(PROJECT_ID, "Geofence");
  const Trip = getProjectModel(PROJECT_ID, "Trip");
  const Maintenance = getProjectModel(PROJECT_ID, "Maintenance");
  const Assignment = getProjectModel(PROJECT_ID, "Assignment");
  const CameraEvent = getProjectModel(PROJECT_ID, "CameraEvent");

  // Seeding wipes every vehicle — refuse if real, onboarded trucks exist.
  const liveCount = await Vehicle.countDocuments({ data_source: "vecv_live" });
  if (liveCount > 0 && !process.argv.includes("--force")) {
    console.error(
      `Refusing to seed: ${liveCount} real VECV vehicle(s) exist and would be deleted. ` +
        "Re-run with --force only if you really want to replace them with demo data."
    );
    process.exit(1);
  }

  console.log("Clearing existing dummy data...");
  await Promise.all([
    Vehicle.deleteMany({}),
    Driver.deleteMany({}),
    GPSDevice.deleteMany({}),
    Geofence.deleteMany({}),
    Trip.deleteMany({}),
    Maintenance.deleteMany({}),
    Assignment.deleteMany({}),
    CameraEvent.deleteMany({})
  ]);

  // --- Geofences (from the mine's own config, so map + seed stay in sync) ---
  const geofenceDocs = await Geofence.insertMany(
    config.geofences.map((g) => ({
      geofence_id: g.id,
      name: g.name,
      zone_type: g.zoneType === "other" ? "other" : g.zoneType,
      latitude: g.center.lat,
      longitude: g.center.lng,
      radius_meters: g.radiusMeters,
      status: "active"
    }))
  );
  // Historical trips run on the mine's actual current operation (OB
  // rehandling: Area A -> Camp), not the generic pit/dump loop, so the
  // Overview map's route line matches the trips that produced these numbers.
  const activePhase = config.haulOperation.phases[config.haulOperation.current];
  const routeFromGeofence = geofenceDocs.find((g) => g.geofence_id === activePhase.fromGeofenceId);
  const routeToGeofence = geofenceDocs.find((g) => g.geofence_id === activePhase.toGeofenceId);
  console.log(`Created ${geofenceDocs.length} geofences`);

  // --- Drivers ---
  const now = Date.now();
  const driverDocs = await Driver.insertMany(
    FLEET.map((f, i) => ({
      driver_id: `DRV-${pad(i + 1, 3)}`,
      name: f.driver,
      phone: `98${pad(randInt(10000000, 99999999), 8)}`,
      license_number: `MH${pad(randInt(10, 99), 2)}${pad(randInt(100000, 999999), 6)}`,
      // Give one driver (index 2) a license expiring soon, to exercise the alert badge.
      license_expiry: new Date(now + (i === 2 ? 20 : randInt(90, 720)) * 86400000),
      license_type: f.equipment_type === "tipper" ? "HMV" : "HTV",
      status: "active",
      joining_date: new Date(now - randInt(180, 1500) * 86400000)
    }))
  );
  const driverByName = new Map(driverDocs.map((d) => [d.name, d]));
  console.log(`Created ${driverDocs.length} drivers`);

  // --- GPS devices + vehicles ---
  const gpsDeviceDocs = await GPSDevice.insertMany(
    FLEET.map((f, i) => ({
      gps_device_id: `GPS-${pad(i + 1, 3)}`,
      vehicle_id: f.vehicle_id,
      imei_number: `86${pad(randInt(100000000000, 999999999999), 12)}`,
      sim_number: `91${pad(randInt(1000000000, 9999999999), 10)}`,
      manufacturer: "Eicher Live",
      model: "ELT-200",
      installation_date: new Date(now - randInt(200, 900) * 86400000),
      status: "active"
    }))
  );
  const gpsDeviceByVehicle = new Map(gpsDeviceDocs.map((d) => [d.vehicle_id, d]));

  const vehicleDocs = await Vehicle.insertMany(
    FLEET.map((f) => {
      const driver = driverByName.get(f.driver);
      const gps = gpsDeviceByVehicle.get(f.vehicle_id);
      const isTipper = f.equipment_type === "tipper";
      return {
        vehicle_id: f.vehicle_id,
        vehicle_number: f.vehicle_id,
        manufacturer: isTipper ? "Eicher" : f.equipment_type === "excavator" ? "Tata Hitachi" : "Komatsu",
        model: isTipper ? "Pro 6031T" : f.equipment_type === "excavator" ? "EX 210" : "D155",
        year_of_manufacture: randInt(2018, 2023),
        capacity_tons: isTipper ? 25 : undefined,
        capacity_cum: isTipper ? 10.59 : undefined,
        equipment_type: f.equipment_type,
        status: "active",
        current_status: "idle",
        total_odometer_km: randInt(20000, 90000),
        total_engine_hours: randInt(2000, 9000),
        fuel_tank_capacity_liters: isTipper ? 200 : 300,
        current_driver_id: driver?.driver_id,
        gps_device_id: gps?.gps_device_id
      };
    })
  );
  console.log(`Created ${vehicleDocs.length} vehicles`);

  // --- Assignments (1:1 primary driver <-> vehicle, matching the shift roster) ---
  await Assignment.insertMany(
    FLEET.map((f, i) => ({
      assignment_id: `ASG-${pad(i + 1, 3)}`,
      vehicle_id: f.vehicle_id,
      driver_id: driverByName.get(f.driver).driver_id,
      assigned_from: new Date(now - REPORT_WINDOW_DAYS * 86400000),
      assigned_by: "Shift Roster Import",
      shift_type: "general",
      status: "active"
    }))
  );

  // --- Trips: 3,210 completed haul cycles across the 7 tippers ---
  const tipperFleet = FLEET.filter((f) => f.equipment_type === "tipper");
  const rawTripCounts = tipperFleet.map((f) => Math.round(f.target_cum / 10.59));
  // Nudge the rounded counts so they sum to exactly TOTAL_TRIPS.
  let diff = TOTAL_TRIPS - rawTripCounts.reduce((a, b) => a + b, 0);
  while (diff !== 0) {
    const idx = diff > 0 ? 0 : rawTripCounts.length - 1; // add to biggest producer, trim from smallest
    rawTripCounts[idx] += diff > 0 ? 1 : -1;
    diff += diff > 0 ? -1 : 1;
  }

  const dieselRatio = TOTAL_DIESEL_LITERS / TOTAL_VOLUME_CUM;
  const distanceRatio = TOTAL_DISTANCE_KM / TOTAL_TRIPS;

  let tripCounter = 0;
  let cycleTimeSamples = [];
  const allTripDocs = [];

  for (let v = 0; v < tipperFleet.length; v++) {
    const fleetEntry = tipperFleet[v];
    const tripCount = rawTripCounts[v];
    const driver = driverByName.get(fleetEntry.driver);
    const gps = gpsDeviceByVehicle.get(fleetEntry.vehicle_id);

    // Jittered volumes, later rescaled so this vehicle's trips sum to its target cum.
    const volumes = Array.from({ length: tripCount }, () => rand(8.5, 12.7));
    const scaledVolumes = rescaleToSum(volumes, fleetEntry.target_cum);

    for (let i = 0; i < tripCount; i++) {
      tripCounter += 1;
      const daysAgo = randInt(1, REPORT_WINDOW_DAYS);
      const shiftStartHour = pick([6, 14, 22]);
      const startTime = new Date(now - daysAgo * 86400000);
      startTime.setHours((shiftStartHour + randInt(0, 7)) % 24, randInt(0, 59), 0, 0);

      const cycleTimeMinutes = rand(9, 17);
      cycleTimeSamples.push(cycleTimeMinutes);
      const endTime = new Date(startTime.getTime() + cycleTimeMinutes * 60000);

      const volumeCum = scaledVolumes[i];
      const distanceKm = rand(distanceRatio * 0.7, distanceRatio * 1.3);

      allTripDocs.push({
        trip_id: `TRIP-${pad(tripCounter, 6)}`,
        driver_id: driver.driver_id,
        vehicle_id: fleetEntry.vehicle_id,
        gps_device_id: gps.gps_device_id,
        start_geofence_id: routeFromGeofence.geofence_id,
        end_geofence_id: routeToGeofence.geofence_id,
        start_time: startTime,
        end_time: endTime,
        distance_km: distanceKm,
        duration_minutes: cycleTimeMinutes,
        fuel_consumed_liters: 0, // filled in below once diesel is rescaled
        status: "COMPLETED",
        material_type: "Overburden",
        volume_cum: volumeCum,
        cycle_time_minutes: cycleTimeMinutes,
        revenue_inr: volumeCum * config.financials.revenuePerCumINR,
        diesel_consumed_liters: 0, // filled in below
        source: "seed"
      });
    }
  }

  // Rescale cycle times fleet-wide to hit the PDF's exact average, then diesel
  // to hit the exact total, keeping each trip's diesel proportional to its volume.
  const meanCycleTime = cycleTimeSamples.reduce((a, b) => a + b, 0) / cycleTimeSamples.length;
  const cycleTimeOffset = AVG_CYCLE_TIME_MINUTES - meanCycleTime;

  const dieselRaw = allTripDocs.map((t) => t.volume_cum * dieselRatio * rand(0.9, 1.1));
  const dieselScaled = rescaleToSum(dieselRaw, TOTAL_DIESEL_LITERS);

  allTripDocs.forEach((t, i) => {
    t.cycle_time_minutes = Math.max(5, Math.round((t.cycle_time_minutes + cycleTimeOffset) * 100) / 100);
    t.duration_minutes = t.cycle_time_minutes;
    t.end_time = new Date(t.start_time.getTime() + t.cycle_time_minutes * 60000);
    t.diesel_consumed_liters = Math.round(dieselScaled[i] * 1000) / 1000;
    t.fuel_consumed_liters = t.diesel_consumed_liters;
    t.volume_cum = Math.round(t.volume_cum * 1000) / 1000;
    t.revenue_inr = Math.round(t.revenue_inr * 100) / 100;
    t.distance_km = Math.round(t.distance_km * 1000) / 1000;
  });

  await Trip.insertMany(allTripDocs, { ordered: false });
  console.log(`Created ${allTripDocs.length} trips`);

  // --- Maintenance: 36 breakdown events across the fleet, totalling ~122h29m ---
  const downtimeRaw = Array.from({ length: TOTAL_BREAKDOWNS }, () => rand(60, 480));
  const downtimeScaled = rescaleToSum(downtimeRaw, TOTAL_BREAKDOWN_MINUTES);

  const maintenanceDocs = Array.from({ length: TOTAL_BREAKDOWNS }, (_, i) => {
    const vehicle = pick(FLEET);
    const driver = driverByName.get(vehicle.driver);
    const serviceDate = new Date(now - randInt(1, REPORT_WINDOW_DAYS) * 86400000);
    return {
      maintenance_id: `MNT-${pad(i + 1, 4)}`,
      vehicle_id: vehicle.vehicle_id,
      maintenance_type: pick(BREAKDOWN_TYPES),
      service_date: serviceDate,
      cost_inr: randInt(1500, 25000),
      workshop_name: "Central Workshop & Fuel Station",
      notes: "Reported during routine shift check; resolved on-site.",
      status: "completed",
      reported_by: driver?.name || "Shift Supervisor",
      response_time_minutes: Math.round(downtimeScaled[i]),
      spares_used: pick(["Filter element", "Hydraulic hose", "Brake pads", "Fuse & relay kit", "None"]),
      source: "seed"
    };
  });
  await Maintenance.insertMany(maintenanceDocs);
  console.log(`Created ${maintenanceDocs.length} maintenance/breakdown records`);

  // --- A handful of AI safety camera events for the Live Camera tab demo ---
  const cameraEventDocs = Array.from({ length: 18 }, (_, i) => {
    const vehicle = pick(tipperFleet);
    const driver = driverByName.get(vehicle.driver);
    const [camera_type, event_type, severity] = pick(CAMERA_EVENT_TYPES);
    const acknowledged = Math.random() < 0.4;
    return {
      event_id: `CAM-${pad(i + 1, 4)}`,
      vehicle_id: vehicle.vehicle_id,
      driver_id: driver?.driver_id,
      camera_type,
      camera_name: `${camera_type.replace("_", " ")} Camera`,
      event_type,
      severity,
      snapshot_url: `https://dummy-media.local/snapshots/${pad(i + 1, 4)}.jpg`,
      stream_url: `https://dummy-media.local/streams/${vehicle.vehicle_id}.m3u8`,
      speed_kmh: randInt(0, 35),
      is_acknowledged: acknowledged,
      acknowledged_by: acknowledged ? "dispatcher" : undefined,
      acknowledged_at: acknowledged ? new Date(now - randInt(0, 5) * 3600000) : undefined
    };
  });
  await CameraEvent.insertMany(cameraEventDocs);
  console.log(`Created ${cameraEventDocs.length} camera/AI safety events`);

  // --- Demo login (global platform DB, not project-scoped) ---
  const adminPassword = process.env.ADMIN_SEED_PASSWORD || "Kamptee@123";
  const adminEmail = process.env.ADMIN_SEED_EMAIL || "admin@bhushilp.local";
  await User.deleteOne({ username: "admin" });
  await User.create({
    name: "Bhushilp Admin",
    username: "admin",
    email: adminEmail,
    password: await bcrypt.hash(adminPassword, 10),
    role: "admin",
    assignedProjects: [PROJECT_ID],
    status: "active"
  });
  console.log(
    `Created demo login -> username: admin / password: ${adminPassword}` +
      (process.env.ADMIN_SEED_PASSWORD ? "" : " (default — override with ADMIN_SEED_PASSWORD before sharing this build)")
  );

  console.log("\nSeed complete:");
  console.log(`  Database        : ${db.name}`);
  console.log(`  Vehicles        : ${vehicleDocs.length}`);
  console.log(`  Drivers         : ${driverDocs.length}`);
  console.log(`  Trips           : ${allTripDocs.length}`);
  console.log(`  Maintenance     : ${maintenanceDocs.length}`);
  console.log(`  Camera events   : ${cameraEventDocs.length}`);
  console.log(
    `  Total volume    : ${allTripDocs.reduce((a, t) => a + t.volume_cum, 0).toFixed(2)} cum (target ${TOTAL_VOLUME_CUM})`
  );
  console.log(
    `  Total diesel    : ${allTripDocs.reduce((a, t) => a + t.diesel_consumed_liters, 0).toFixed(2)} L (target ${TOTAL_DIESEL_LITERS})`
  );

  await mongoose.disconnect();
}

main().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
