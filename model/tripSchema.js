import mongoose from "mongoose";

const tripSchema = new mongoose.Schema(
  {
    trip_id: {
      type: String,
      unique: true,
      required: true
    },

    // Optional: trips detected from GPS have no driver assignment.
    driver_id: {
      type: String,
      ref: "Driver"
    },

    vehicle_id: {
      type: String,
      ref: "Vehicle",
      required: true
    },

    gps_device_id: {
      type: String,
      ref: "GPSDevice"
    },

    start_geofence_id: {
      type: String,
      ref: "Geofence",
      required: true
    },

    end_geofence_id: {
      type: String,
      ref: "Geofence"
    },

    start_time: {
      type: Date,
      required: true
    },

    end_time: {
      type: Date
    },

    distance_km: {
      type: Number,
      min: 0
    },

    duration_minutes: {
      type: Number,
      min: 0
    },

    fuel_consumed_liters: {
      type: Number,
      min: 0
    },

    status: {
      type: String,
      enum: ["ACTIVE", "COMPLETED", "CANCELLED"],
      default: "ACTIVE"
    },

    // Mining haulage metrics
    material_type: {
      type: String,
      enum: ["Overburden", "Coal", "Waste", "Topsoil"],
      default: "Overburden"
    },

    // No defaults on purpose: a measured trip must never inherit benchmark
    // numbers — an unmeasured value stays empty and shows as "—".
    volume_cum: {
      type: Number,
      min: 0
    },

    // Loading-zone departure → next loading-zone departure (full loop).
    cycle_time_minutes: {
      type: Number,
      min: 0
    },

    // Loaded leg only: loading-zone departure → dump-zone arrival.
    haul_minutes: {
      type: Number,
      min: 0
    },

    // Zone dwell times, from the first and last GPS point inside each zone.
    // GPS arrives every 1–4 min, so dwell is a slight underestimate.
    loading_entered_at: { type: Date },
    loading_minutes: { type: Number, min: 0 },
    dump_left_at: { type: Date },
    unloading_minutes: { type: Number, min: 0 },
    // Empty leg: dump-zone departure → next loading-zone arrival.
    return_minutes: { type: Number, min: 0 },

    revenue_inr: {
      type: Number,
      min: 0
    },

    diesel_consumed_liters: {
      type: Number,
      min: 0
    },

    // Where this record came from — lets manual sheet entries, the web
    // dashboard, and telematics webhooks all land in the same collection.
    source: {
      type: String,
      enum: ["seed", "sheet", "web", "telematics"],
      default: "web"
    },

    // Caller-supplied identity (spreadsheet row id, form submission id, device
    // event id) used to make ingestion idempotent — re-submitting the same
    // row updates it instead of creating a duplicate trip.
    external_ref: {
      type: String,
      trim: true
    }
  },
  {
    timestamps: true
  }
);

tripSchema.index({ vehicle_id: 1, createdAt: -1 });
tripSchema.index({ driver_id: 1, createdAt: -1 });
tripSchema.index({ status: 1 });
tripSchema.index(
  { external_ref: 1 },
  { unique: true, partialFilterExpression: { external_ref: { $type: "string" } } }
);

const Trip = mongoose.model("Trip", tripSchema);

export { tripSchema };
export default Trip;