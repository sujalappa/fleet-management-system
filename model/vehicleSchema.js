import mongoose from "mongoose";

const vehicleSchema = new mongoose.Schema(
  {
    vehicle_id: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },

    vehicle_number: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },

    manufacturer: {
      type: String,
      trim: true
    },

    model: {
      type: String,
      trim: true
    },

    year_of_manufacture: {
      type: Number,
      min: 1980,
      max: new Date().getFullYear()
    },

    capacity_tons: {
      type: Number,
      min: 0
    },

    capacity_cum: {
      type: Number,
      min: 0,
      default: 10.59 // Average tipper payload from the Kamptee benchmark
    },

    equipment_type: {
      type: String,
      enum: ["tipper", "excavator", "dozer"],
      required: true,
      default: "tipper"
    },

    // Fleet lifecycle state (asset-level)
    status: {
      type: String,
      enum: ["active", "inactive", "maintenance", "breakdown", "sold"],
      default: "active"
    },

    // Live haul-cycle phase (only meaningful for tippers mid-trip)
    current_status: {
      type: String,
      enum: ["loading", "hauling", "dumping", "returning", "idle", "breakdown"],
      default: "idle"
    },

    // Running totals (updated from GPS/CAN data)
    total_odometer_km: {
      type: Number,
      min: 0,
      default: 0
    },

    total_engine_hours: {
      type: Number,
      min: 0,
      default: 0
    },

    // Maintenance tracking
    last_service_date: {
      type: Date
    },

    last_service_odometer_km: {
      type: Number,
      min: 0,
      default: 0
    },

    next_service_due_km: {
      type: Number,
      min: 0
    },

    next_service_due_date: {
      type: Date
    },

    // Fuel tank capacity for theft detection
    fuel_tank_capacity_liters: {
      type: Number,
      min: 0
    },

    // Current assigned driver (denormalized for quick lookup)
    current_driver_id: {
      type: String,
      ref: "Driver"
    },

    // GPS device linked to this vehicle
    gps_device_id: {
      type: String,
      ref: "GPSDevice"
    },

    // The OEM telematics identity: Eicher chassis number for VECV, the
    // 17-character VIN for Volvo.
    chassis_number: {
      type: String,
      trim: true,
      unique: true,
      sparse: true
    },

    engine_number: {
      type: String,
      trim: true
    },

    // Eicher only: the .env variable holding the VECV API key this truck is
    // mapped to (each key covers its own trucks). Defaults to VECV_API_KEY.
    api_key_env: {
      type: String,
      trim: true
    },

    // Plate of the trailer currently paired with this prime mover — can
    // change when trailers are swapped, so it's never the vehicle's ID.
    trailer_number: {
      type: String,
      trim: true
    },

    // Lifetime fuel used, from telematics (Volvo EngineTotalFuelUsed / Eicher
    // lifeTimeFuelConsumption).
    total_fuel_used_liters: {
      type: Number,
      min: 0
    },

    // Which telematics feed this vehicle's data comes from — set by the
    // onboarding scripts; each OEM poller only polls its own vehicles.
    data_source: {
      type: String,
      enum: ["simulated", "vecv_live", "volvo_live"],
      default: "simulated"
    }
  },
  {
    timestamps: true
  }
);

// Indexes for fast queries
vehicleSchema.index({ status: 1 });
vehicleSchema.index({ equipment_type: 1 });
vehicleSchema.index({ data_source: 1 });
vehicleSchema.index({ current_driver_id: 1 });
vehicleSchema.index({ gps_device_id: 1 });

const Vehicle = mongoose.model("Vehicle", vehicleSchema);

export { vehicleSchema };
export default Vehicle;