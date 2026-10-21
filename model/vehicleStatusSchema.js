import mongoose from "mongoose";

// One rFMS vehicle status report (Volvo Connect). Reports arrive on ignition
// on/off and hourly while running; all counters are life-of-vehicle totals,
// so usage over a period = difference between two reports.
const vehicleStatusSchema = new mongoose.Schema(
  {
    vehicle_id: {
      type: String,
      ref: "Vehicle",
      required: true
    },

    chassis_number: {
      type: String,
      required: true,
      trim: true
    },

    // e.g. IGNITION_ON, IGNITION_OFF, TIMER
    trigger_type: {
      type: String,
      trim: true
    },

    // When the vehicle generated the report.
    created_at_vehicle: {
      type: Date,
      required: true
    },

    // When Volvo's backend received it — the polling cursor is based on this.
    received_at: {
      type: Date,
      required: true
    },

    odometer_km: { type: Number, min: 0 },
    engine_hours: { type: Number, min: 0 },
    total_fuel_used_liters: { type: Number, min: 0 },
    gross_combination_weight_kg: { type: Number, min: 0 },

    // Life-of-vehicle utilisation (rFMS accumulated block).
    moving_seconds: { type: Number, min: 0 },
    moving_fuel_liters: { type: Number, min: 0 },
    // Engine on, wheel speed zero, no PTO — i.e. idling.
    idle_seconds: { type: Number, min: 0 },
    idle_fuel_liters: { type: Number, min: 0 },

    raw_data: {
      type: mongoose.Schema.Types.Mixed
    },

    source: {
      type: String,
      enum: ["seed", "sheet", "web", "telematics"],
      default: "telematics"
    },

    // `${vin}:${createdDateTime}:${trigger}` — re-fetching overlapping
    // windows never creates duplicates.
    external_ref: {
      type: String,
      trim: true
    }
  },
  {
    timestamps: true
  }
);

vehicleStatusSchema.index({ vehicle_id: 1, created_at_vehicle: -1 });
vehicleStatusSchema.index({ received_at: -1 });
vehicleStatusSchema.index(
  { external_ref: 1 },
  { unique: true, partialFilterExpression: { external_ref: { $type: "string" } } }
);

const VehicleStatus = mongoose.model("VehicleStatus", vehicleStatusSchema);

export { vehicleStatusSchema };
export default VehicleStatus;
