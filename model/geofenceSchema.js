import mongoose from "mongoose";

const geofenceSchema = new mongoose.Schema(
  {
    geofence_id: {
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

    zone_type: {
      type: String,
      required: true,
      enum: [
        "loading",
        "unloading",
        "parking",
        "workshop",
        "fuel_station",
        "restricted",
        "other"
      ]
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

    radius_meters: {
      type: Number,
      required: true,
      min: 1
    },

    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active"
    }
  },
  {
    timestamps: true
  }
);

const Geofence = mongoose.model("Geofence", geofenceSchema);

export default Geofence;