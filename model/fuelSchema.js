import mongoose from "mongoose";

const fuelSchema = new mongoose.Schema(
  {
    vehicle_id: {
      type: String,
      ref: "Vehicle",
      required: true
    },

    gps_device_id: {
      type: String,
      ref: "GPSDevice"
    },

    trip_id: {
      type: String,
      ref: "Trip"
    },

    fuel_level_liters: {
      type: Number,
      min: 0
    },

    fuel_percentage: {
      type: Number,
      min: 0,
      max: 100
    },

    engine_rpm: {
      type: Number,
      min: 0
    },

    engine_hours: {
      type: Number,
      min: 0
    },

    odometer_km: {
      type: Number,
      min: 0
    },

    device_timestamp: {
      type: Date,
      required: true
    },

    server_timestamp: {
      type: Date,
      default: Date.now
    },

    raw_data: {
      type: mongoose.Schema.Types.Mixed
    }
  }
);

const Fuel = mongoose.model("FuelLog", fuelSchema);

export default Fuel;