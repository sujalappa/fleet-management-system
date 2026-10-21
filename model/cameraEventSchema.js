import mongoose from "mongoose";

const cameraEventSchema = new mongoose.Schema(
  {
    event_id: {
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
      ref: "Driver"
    },
    camera_type: {
      type: String,
      enum: ["DSM_CABIN", "ADAS_ROAD", "DUMP_REAR", "PIT_CCTV"],
      required: true
    },
    camera_name: {
      type: String,
      default: "In-Cabin DSM Camera"
    },
    event_type: {
      type: String,
      enum: [
        "DROWSINESS",
        "PHONE_USAGE",
        "NO_SEATBELT",
        "SMOKING",
        "COLLISION_WARNING",
        "LANE_DEPARTURE",
        "BLIND_SPOT_OBJECT",
        "DUMPING_VIOLATION",
        "CAMERA_OBSTRUCTION"
      ],
      required: true
    },
    severity: {
      type: String,
      enum: ["info", "warning", "critical"],
      default: "warning"
    },
    snapshot_url: {
      type: String, // Thumbnail / snapshot image of the incident
      trim: true
    },
    stream_url: {
      type: String, // RTSP / HLS live stream endpoint
      trim: true
    },
    latitude: {
      type: Number
    },
    longitude: {
      type: Number
    },
    speed_kmh: {
      type: Number,
      default: 0
    },
    is_acknowledged: {
      type: Boolean,
      default: false
    },
    acknowledged_by: {
      type: String
    },
    acknowledged_at: {
      type: Date
    }
  },
  {
    timestamps: true
  }
);

cameraEventSchema.index({ vehicle_id: 1, createdAt: -1 });
cameraEventSchema.index({ severity: 1, is_acknowledged: 1 });

const CameraEvent = mongoose.model("CameraEvent", cameraEventSchema);

export { cameraEventSchema };
export default CameraEvent;
