import mongoose from "mongoose";

const assignmentSchema = new mongoose.Schema(
  {
    assignment_id: {
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

    driver_id: {
      type: String,
      ref: "Driver",
      required: true
    },

    // When this driver started using this vehicle
    assigned_from: {
      type: Date,
      required: true,
      default: Date.now
    },

    // When this assignment ended (null = currently active)
    assigned_to: {
      type: Date
    },

    // Who created this assignment
    assigned_by: {
      type: String,
      required: true,
      trim: true
    },

    // Shift info
    shift_type: {
      type: String,
      enum: ["day", "night", "general"],
      default: "general"
    },

    status: {
      type: String,
      enum: ["active", "ended", "transferred"],
      default: "active"
    },

    // Reason for ending assignment
    end_reason: {
      type: String,
      enum: ["shift_end", "vehicle_change", "driver_leave", "breakdown", "other"]
    },

    notes: {
      type: String,
      trim: true
    }
  },
  {
    timestamps: true
  }
);

// Ensure only ONE active assignment per vehicle at a time
assignmentSchema.index({ vehicle_id: 1, status: 1 });
// Ensure only ONE active assignment per driver at a time
assignmentSchema.index({ driver_id: 1, status: 1 });

const Assignment = mongoose.model("Assignment", assignmentSchema);

export { assignmentSchema };
export default Assignment;