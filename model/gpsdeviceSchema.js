import mongoose from "mongoose";

const gpsDeviceSchema = new mongoose.Schema(
  {
    gps_device_id: {
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

    imei_number: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },

    sim_number: {
      type: String,
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

    installation_date: {
      type: Date
    },

    status: {
      type: String,
      enum: ["active", "inactive", "faulty"],
      default: "active"
    }
  },
  {
    timestamps: true
  }
);

const GPSDevice = mongoose.model("GPSDevice", gpsDeviceSchema);

export default GPSDevice;