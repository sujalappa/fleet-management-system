import mongoose from "mongoose";

const gpsLogSchema = new mongoose.Schema(
  {
    gps_device_id: {
      type: String,
      ref: "GPSDevice",
      required: true
    },

    vehicle_id: {
      type: String,
      ref: "Vehicle",
      required: true
    },

    latitude: {
      type: Number,
      required: true,
      min: -90,
      max: 90
    },

    longitude: {
      type: Number,
      required: true,
      min: -180,
      max: 180
    },

    speed: {
      type: Number,
      min: 0
    },

    direction: {
      type: Number,
      min: 0,
      max: 360
    },

    altitude: {
      type: Number
    },

    ignition: {
      type: Boolean
    },

    device_timestamp: {
      type: Date,
      required: true
    },

    server_timestamp: {
      type: Date,
      default: Date.now
    },

    gps_accuracy: {
      type: Number,
      min: 0
    },

    raw_data: {
      type: mongoose.Schema.Types.Mixed
    }
  }
);

const GPSLog = mongoose.model("GPSLog", gpsLogSchema);

export default GPSLog;