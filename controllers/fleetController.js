import { getProjectModel } from "../model/index.js";

const IDLE_THRESHOLD_MINUTES = 15;

// GET /api/fleet/live
// Active vs idle vs breakdown snapshot for the Fleet Operations tab.
// State comes from the best signal each vehicle has: live GPS, else the
// last Volvo ignition event, else its most recent trip.
export const getLiveFleet = async (req, res) => {
  try {
    const Vehicle = getProjectModel(req.projectId, "Vehicle");
    const Trip = getProjectModel(req.projectId, "Trip");
    const GPSLog = getProjectModel(req.projectId, "GPSLog");

    // Inactive vehicles (e.g. trucks sent to another site) stay in the DB with
    // their history but are left off the dashboard.
    const vehicles = await Vehicle.find({ status: { $ne: "inactive" } }).lean();

    const latestTrips = await Trip.aggregate([
      { $sort: { vehicle_id: 1, start_time: -1 } },
      {
        $group: {
          _id: "$vehicle_id",
          trip: { $first: "$$ROOT" }
        }
      }
    ]);
    const latestTripByVehicle = new Map(latestTrips.map((row) => [row._id, row.trip]));

    // Telematics vehicles (Eicher or Volvo) get their position from real GPS
    // instead of the trip-derived estimate below.
    const liveVehicleIds = vehicles
      .filter((v) => v.data_source && v.data_source !== "simulated")
      .map((v) => v.vehicle_id);
    const latestGpsByVehicle = new Map();
    if (liveVehicleIds.length) {
      const latestGps = await GPSLog.aggregate([
        { $match: { vehicle_id: { $in: liveVehicleIds } } },
        { $sort: { vehicle_id: 1, device_timestamp: -1 } },
        { $group: { _id: "$vehicle_id", ping: { $first: "$$ROOT" } } }
      ]);
      latestGps.forEach((row) => latestGpsByVehicle.set(row._id, row.ping));
    }

    const FuelLog = getProjectModel(req.projectId, "Fuel");
    const latestFuel = await FuelLog.aggregate([
      { $match: { source: "telematics" } },
      { $sort: { vehicle_id: 1, device_timestamp: -1 } },
      { $group: { _id: "$vehicle_id", reading: { $first: "$$ROOT" } } }
    ]);
    const latestFuelByVehicle = new Map(latestFuel.map((row) => [row._id, row.reading]));

    // Volvo status reports (ignition on/off, hourly) — the only live signal
    // for trucks whose subscription has no GPS.
    const VehicleStatus = getProjectModel(req.projectId, "VehicleStatus");
    const latestStatuses = await VehicleStatus.aggregate([
      { $sort: { vehicle_id: 1, created_at_vehicle: -1 } },
      { $group: { _id: "$vehicle_id", report: { $first: "$$ROOT" } } }
    ]);
    const latestStatusByVehicle = new Map(latestStatuses.map((row) => [row._id, row.report]));

    const now = Date.now();
    const fleet = vehicles.map((vehicle) => {
      const trip = latestTripByVehicle.get(vehicle.vehicle_id) || null;
      const gps = latestGpsByVehicle.get(vehicle.vehicle_id) || null;
      const status = latestStatusByVehicle.get(vehicle.vehicle_id) || null;
      const fuel = latestFuelByVehicle.get(vehicle.vehicle_id) || null;

      let operational_state = "no_data";
      let idle_minutes = 0;

      if (vehicle.status === "breakdown") operational_state = "breakdown";
      else if (vehicle.status === "maintenance") operational_state = "maintenance";
      else if (gps) {
        // Real telemetry is authoritative for onboarded vehicles — no need
        // to infer state from trip records.
        // A stale reading can't say "moving now" — staleness wins over the
        // last reported status (a truck whose device went offline mid-drive
        // keeps reporting MOVING forever otherwise).
        const minutesSinceUpdate = (now - new Date(gps.device_timestamp).getTime()) / 60000;
        if (minutesSinceUpdate > IDLE_THRESHOLD_MINUTES) {
          // We haven't heard from the device — that's not the same as the
          // truck being idle, so don't claim either moving or idle.
          operational_state = "no_signal";
          idle_minutes = Math.round(minutesSinceUpdate);
        } else if (gps.vehicle_status === "MOVING") operational_state = "on_trip";
        else operational_state = "recently_active";
      } else if (status) {
        // No GPS: the last ignition event says whether the engine is running.
        if (status.trigger_type === "IGNITION_OFF") {
          operational_state = "idle";
          idle_minutes = Math.round((now - new Date(status.created_at_vehicle).getTime()) / 60000);
        } else operational_state = "recently_active";
      } else {
        const minutesSinceUpdate = trip?.end_time || trip?.start_time
          ? (now - new Date(trip.end_time || trip.start_time).getTime()) / 60000
          : null;

        if (trip && trip.status === "ACTIVE") operational_state = "on_trip";
        else if (minutesSinceUpdate !== null && minutesSinceUpdate > IDLE_THRESHOLD_MINUTES) {
          operational_state = "idle";
          idle_minutes = Math.round(minutesSinceUpdate);
        } else if (trip) operational_state = "recently_active";
      }

      return {
        vehicle_id: vehicle.vehicle_id,
        vehicle_number: vehicle.vehicle_number,
        status: vehicle.status,
        data_source: vehicle.data_source || "simulated",
        current_driver_id: vehicle.current_driver_id,
        operational_state,
        idle_minutes,
        last_fuel: latestFuelByVehicle.has(vehicle.vehicle_id)
          ? (({ fuel_level_liters, fuel_percentage, def_level_liters, device_timestamp }) => ({
              liters: fuel_level_liters,
              percent: fuel_percentage,
              def_liters: def_level_liters,
              updatedAt: device_timestamp
            }))(latestFuelByVehicle.get(vehicle.vehicle_id))
          : null,
        odometer_km: vehicle.total_odometer_km || null,
        engine_hours: vehicle.total_engine_hours || null,
        fuel_used_liters:
          vehicle.total_fuel_used_liters ??
          (fuel?.lifetime_fuel_consumption != null ? Math.round(fuel.lifetime_fuel_consumption) : null),
        idle_hours: status?.idle_seconds != null ? Math.round(status.idle_seconds / 360) / 10 : null,
        // Diesel burned with the engine on but the truck standing still.
        idle_fuel_liters: status?.idle_fuel_liters != null ? Math.round(status.idle_fuel_liters) : null,
        // Share of engine running time spent idling (lifetime).
        idle_pct:
          status?.idle_seconds != null && status?.engine_hours
            ? Math.round((status.idle_seconds / (status.engine_hours * 3600)) * 100)
            : null,
        trailer_number: vehicle.trailer_number || null,
        last_status: status
          ? { trigger: status.trigger_type, updatedAt: status.created_at_vehicle }
          : null,
        last_gps: gps
          ? {
              lat: gps.latitude,
              lng: gps.longitude,
              speed: gps.speed,
              vehicleStatus: gps.vehicle_status,
              updatedAt: gps.device_timestamp,
              // Last reading too old to describe the truck's current state.
              stale: (now - new Date(gps.device_timestamp).getTime()) / 60000 > IDLE_THRESHOLD_MINUTES
            }
          : null,
        last_trip: trip
          ? {
              trip_id: trip.trip_id,
              status: trip.status,
              material_type: trip.material_type,
              volume_cum: trip.volume_cum,
              start_time: trip.start_time,
              end_time: trip.end_time,
              // Lets the map approximate a position from geofence coordinates
              // for vehicles that don't have real telemetry yet.
              start_geofence_id: trip.start_geofence_id,
              end_geofence_id: trip.end_geofence_id
            }
          : null
      };
    });

    const summary = fleet.reduce(
      (acc, v) => {
        acc[v.operational_state] = (acc[v.operational_state] || 0) + 1;
        return acc;
      },
      { on_trip: 0, idle: 0, breakdown: 0, maintenance: 0, no_signal: 0, no_data: 0, recently_active: 0 }
    );

    res.status(200).json({ success: true, data: { fleet, summary } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
