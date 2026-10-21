import mongoose from "mongoose";

const gpsLogSchema = new mongoose.Schema(
  {
    // Optional: telematics pings from VECV are keyed by chassis number, not
    // by a GPSDevice document we registered ourselves.
    gps_device_id: {
      type: String,
      ref: "GPSDevice"
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

    // VECV Location API's vehicleStatus (MOVING / STOPPED / IDLING)
    vehicle_status: {
      type: String,
      enum: ["MOVING", "STOPPED", "IDLING"]
    },

    // Kept alongside vehicle_id for direct auditability against the source API
    chassis_number: {
      type: String,
      trim: true
    },

    // Location API returns its own odometer reading per ping (separate from
    // Vehicle.total_odometer_km and FuelLog's own odometer_km).
    odometer_km: {
      type: Number,
      min: 0
    },

    // VECV's own telematics device id — distinct from gps_device_id, which
    // refers to a GPSDevice document we registered ourselves.
    external_device_id: {
      type: String,
      trim: true
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

gpsLogSchema.index({ vehicle_id: 1, device_timestamp: -1 });
gpsLogSchema.index({ gps_device_id: 1, device_timestamp: -1 });
gpsLogSchema.index(
  { external_ref: 1 },
  { unique: true, partialFilterExpression: { external_ref: { $type: "string" } } }
);

const GPSLog = mongoose.model("GPSLog", gpsLogSchema);

export { gpsLogSchema };
export default GPSLog;