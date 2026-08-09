import mongoose from "mongoose";

const tripSchema = new mongoose.Schema(
  {
    trip_id: {
      type: String,
      unique: true,
      required: true
    },

    driver_id: {
      type: String,
      ref: "Driver",
      required: true
    },

    vehicle_id: {
      type: String,
      ref: "Vehicle",
      required: true
    },

    gps_device_id: {
      type: String,
      ref: "GPSDevice",
      required: true
    },

    start_geofence_id: {
      type: String,
      ref: "Geofence",
      required: true
    },

    end_geofence_id: {
      type: String,
      ref: "Geofence"
    },

    start_time: {
      type: Date,
      required: true
    },

    end_time: {
      type: Date
    },

    distance_km: {
      type: Number,
      min: 0
    },

    duration_minutes: {
      type: Number,
      min: 0
    },

    fuel_consumed_liters: {
      type: Number,
      min: 0
    },

    status: {
      type: String,
      enum: ["ACTIVE", "COMPLETED", "CANCELLED"],
      default: "ACTIVE"
    }
  }
);

const Trip = mongoose.model("Trip", tripSchema);

export default Trip;