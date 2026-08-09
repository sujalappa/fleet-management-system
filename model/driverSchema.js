import mongoose from "mongoose";

const driverSchema = new mongoose.Schema(
  {
    // Driver ID = Employee ID
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

    status: {
      type: String,
      enum: ["active", "inactive", "suspended"],
      default: "active"
    },

    joining_date: {
      type: Date,
      required: true
    }
  },
  {
    timestamps: true
  }
);

const Driver = mongoose.model("Driver", driverSchema);

export default Driver;