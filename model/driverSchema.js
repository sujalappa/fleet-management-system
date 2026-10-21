import mongoose from "mongoose";

const driverSchema = new mongoose.Schema(
  {
    driver_id: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },

    name: {
      type: String,
      required: true,
      trim: true
    },

    phone: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },

    license_number: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },

    license_expiry: {
      type: Date,
      required: true
    },

    license_type: {
      type: String,
      enum: ["LMV", "HMV", "HPMV", "HTV", "other"],
      default: "HMV"
    },

    // When license expires, auto-alert if within 30 days
    license_alert_sent: {
      type: Boolean,
      default: false
    },

    status: {
      type: String,
      enum: ["active", "inactive", "suspended", "on_leave"],
      default: "active"
    },

    joining_date: {
      type: Date,
      required: true
    },

    // Denormalized: which vehicle is this driver currently assigned to
    current_vehicle_id: {
      type: String,
      ref: "Vehicle"
    },

    emergency_contact: {
      name: { type: String, trim: true },
      phone: { type: String, trim: true },
      relation: { type: String, trim: true }
    }
  },
  {
    timestamps: true
  }
);

// Indexes
driverSchema.index({ status: 1 });
driverSchema.index({ current_vehicle_id: 1 });
driverSchema.index({ license_expiry: 1 });

const Driver = mongoose.model("Driver", driverSchema);

export { driverSchema };
export default Driver;