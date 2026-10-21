import mongoose from "mongoose";

const maintenanceSchema = new mongoose.Schema(
  {
    maintenance_id: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },

    vehicle_id: {
      type: String,
      ref: "Vehicle",
      required: true
    },

    // What type of maintenance
    maintenance_type: {
      type: String,
      required: true,
      enum: [
        "engine_oil_change",
        "hydraulic_oil_change",
        "gear_oil_change",
        "brake_inspection",
        "tyre_replacement",
        "battery_check",
        "coolant_topup",
        "air_filter_clean",
        "general_service",
        "breakdown_repair",
        "annual_inspection",
        // Breakdown causes as reported in the Kamptee OC daily maintenance log
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
      ]
    },

    // When it was / will be done
    service_date: {
      type: Date
    },

    // For scheduled upcoming maintenance
    scheduled_date: {
      type: Date
    },

    // Trigger alerts when odometer or engine hours reach this
    alert_at_odometer_km: {
      type: Number,
      min: 0
    },

    alert_at_engine_hours: {
      type: Number,
      min: 0
    },

    // Actual cost
    cost_inr: {
      type: Number,
      min: 0
    },

    // Workshop / mechanic details
    workshop_name: {
      type: String,
      trim: true
    },

    // Description of work done
    notes: {
      type: String,
      trim: true
    },

    // Status of this maintenance entry
    status: {
      type: String,
      enum: ["scheduled", "overdue", "in_progress", "completed", "cancelled"],
      default: "scheduled"
    },

    // Who flagged the breakdown (operator/driver name or employee code)
    reported_by: {
      type: String,
      trim: true
    },

    // Minutes between report and mechanic arrival — mirrors the PDF's
    // breakdown response-time tracking
    response_time_minutes: {
      type: Number,
      min: 0
    },

    spares_used: {
      type: String,
      trim: true
    },

    source: {
      type: String,
      enum: ["seed", "sheet", "web", "telematics"],
      default: "web"
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

maintenanceSchema.index(
  { external_ref: 1 },
  { unique: true, partialFilterExpression: { external_ref: { $type: "string" } } }
);

const Maintenance = mongoose.model("Maintenance", maintenanceSchema);

export { maintenanceSchema };
export default Maintenance;