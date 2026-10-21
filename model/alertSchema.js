import mongoose from "mongoose";

const alertSchema = new mongoose.Schema(
  {
    alert_id: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },

    // What triggered this alert
    alert_type: {
      type: String,
      required: true,
      enum: [
        "maintenance_due",
        "maintenance_overdue",
        "fuel_theft",
        "fuel_low",
        "geofence_breach",
        "overspeed",
        "idle_time_exceeded",
        "device_offline",
        "ignition_on_after_hours",
        "license_expiry",
        // Catch-all for a VECV alertType we haven't explicitly mapped yet —
        // see services/vecv/alerts.js for the mapping table.
        "telematics_alert"
      ]
    },

    // The VECV alert exactly as VECV named it (e.g. "Predictive Uptime" /
    // "Visit Soon") — kept alongside our own `alert_type` above so nothing
    // is lost even when the mapping table doesn't have a clean match.
    external_alert_type: {
      type: String,
      trim: true
    },

    alert_sub_type: {
      type: String,
      trim: true
    },

    // VECV's raw alertSubTypeId code (e.g. "VISIT_SOON") — kept even though
    // it's already used to derive alert_type/severity, so an unmapped code
    // is still visible on the document instead of only in server logs.
    external_alert_sub_type_id: {
      type: String,
      trim: true
    },

    registration_number: {
      type: String,
      trim: true
    },

    odometer_km: {
      type: Number,
      min: 0
    },

    alert_value: {
      type: Number
    },

    alert_unit: {
      type: String,
      trim: true
    },

    // When VECV says the alert actually occurred — distinct from createdAt
    // (our ingestion time), which can lag behind by up to a polling cycle.
    alert_time: {
      type: Date
    },

    fault_name: {
      type: String,
      trim: true
    },

    case_description: {
      type: String,
      trim: true
    },

    solution_recommended: {
      type: String,
      trim: true
    },

    severity: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      default: "medium"
    },

    // Which vehicle / driver / device
    vehicle_id: {
      type: String,
      ref: "Vehicle"
    },

    driver_id: {
      type: String,
      ref: "Driver"
    },

    gps_device_id: {
      type: String,
      ref: "GPSDevice"
    },

    // Human readable message
    message: {
      type: String,
      required: true,
      trim: true
    },

    // Location when alert triggered (if applicable)
    latitude: {
      type: Number
    },

    longitude: {
      type: Number
    },

    // Whether someone has acted on this
    is_acknowledged: {
      type: Boolean,
      default: false
    },

    acknowledged_by: {
      type: String,
      trim: true
    },

    acknowledged_at: {
      type: Date
    },

    // If resolved, when
    resolved_at: {
      type: Date
    },

    // Any admin notes
    notes: {
      type: String,
      trim: true
    },

    source: {
      type: String,
      enum: ["seed", "sheet", "web", "telematics"],
      default: "web"
    },

    // VECV's caseId — used to upsert instead of duplicating an alert every
    // polling cycle it's still open.
    external_ref: {
      type: String,
      trim: true
    },

    // Full raw API payload — same safety net as GPSLog/FuelLog's raw_data,
    // so a field we haven't mapped yet is never silently lost.
    raw_data: {
      type: mongoose.Schema.Types.Mixed
    }
  },
  {
    timestamps: true
  }
);

// Index for fast querying of unacknowledged alerts
alertSchema.index({ is_acknowledged: 1, severity: 1, createdAt: -1 });
alertSchema.index(
  { external_ref: 1 },
  { unique: true, partialFilterExpression: { external_ref: { $type: "string" } } }
);

const Alert = mongoose.model("Alert", alertSchema);

export { alertSchema };
export default Alert;