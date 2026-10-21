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

    // Kept alongside vehicle_id for direct auditability against the source API
    chassis_number: {
      type: String,
      trim: true
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

    // VECV Fuel API fields
    vehicle_status: {
      type: String,
      enum: ["MOVING", "STOPPED", "IDLING"]
    },

    fuel_type: {
      type: String,
      enum: ["Diesel", "CNG", "EV"]
    },

    def_level_liters: {
      type: Number,
      min: 0
    },

    lifetime_fuel_consumption: {
      type: Number,
      min: 0
    },

    // EV-only — null/absent for Diesel and CNG vehicles
    soc_level: {
      type: Number,
      min: 0,
      max: 100
    },

    battery_temperature_c: {
      type: Number
    },

    co2_saving_kg: {
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
    },

    source: {
      type: String,
      enum: ["seed", "sheet", "web", "telematics"],
      default: "telematics"
    },

    external_ref: {
      type: String,
      trim: true
    }
  },
  {
    timestamps: true
  }
);

fuelSchema.index({ vehicle_id: 1, device_timestamp: -1 });
fuelSchema.index(
  { external_ref: 1 },
  { unique: true, partialFilterExpression: { external_ref: { $type: "string" } } }
);

const Fuel = mongoose.model("FuelLog", fuelSchema);

export { fuelSchema };
export default Fuel;