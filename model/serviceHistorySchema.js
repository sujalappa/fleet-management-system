import mongoose from "mongoose";

// One line item within a job card (a single part/labour action performed
// during that workshop visit) — mirrors VECV's jobCardLineItems exactly.
const jobCardLineItemSchema = new mongoose.Schema(
  {
    row_id: { type: String, trim: true },
    job_description: { type: String, trim: true },
    job_id_description: { type: String, trim: true },
    action: { type: String, trim: true },
    matnr: { type: String, trim: true },
    matnr_type: { type: String, trim: true },
    observation: { type: String, trim: true },
    job_type_bezei: { type: String, trim: true },
    part_qty: { type: Number, min: 0 },
    part_total_amt: { type: Number, min: 0 },
    part_total_amt_in_gst: { type: Number, min: 0 }
  },
  { _id: false }
);

// A workshop visit / job card, pulled from VECV's Service History API.
const serviceHistorySchema = new mongoose.Schema(
  {
    vehicle_id: {
      type: String,
      ref: "Vehicle"
    },

    chassis_number: {
      type: String,
      required: true,
      trim: true
    },

    registration_number: {
      type: String,
      trim: true
    },

    job_card_number: {
      type: String,
      trim: true
    },

    dealer_name: {
      type: String,
      trim: true
    },

    model_description: {
      type: String,
      trim: true
    },

    order_type_description: {
      type: String,
      trim: true
    },

    invoice_number: {
      type: String,
      trim: true
    },

    odometer_km: {
      type: Number,
      min: 0
    },

    lube_tran_value: {
      type: Number,
      min: 0
    },

    labour_tran_value: {
      type: Number,
      min: 0
    },

    parts_value_amount: {
      type: Number,
      min: 0
    },

    total_cost_cust: {
      type: Number,
      min: 0
    },

    job_card_open_date: {
      type: Date
    },

    job_card_line_items: {
      type: [jobCardLineItemSchema],
      default: []
    },

    source: {
      type: String,
      enum: ["seed", "sheet", "web", "telematics"],
      default: "telematics"
    },

    // job_card_number is how VECV re-sends the same visit on every poll —
    // used to upsert instead of duplicating.
    external_ref: {
      type: String,
      trim: true
    },

    // Full raw job-card payload — same safety net as GPSLog/FuelLog's
    // raw_data, so a field we haven't mapped yet is never silently lost.
    raw_data: {
      type: mongoose.Schema.Types.Mixed
    }
  },
  {
    timestamps: true
  }
);

serviceHistorySchema.index({ vehicle_id: 1, job_card_open_date: -1 });
serviceHistorySchema.index({ chassis_number: 1, job_card_open_date: -1 });
serviceHistorySchema.index(
  { external_ref: 1 },
  { unique: true, partialFilterExpression: { external_ref: { $type: "string" } } }
);

const ServiceHistory = mongoose.model("ServiceHistory", serviceHistorySchema);

export { serviceHistorySchema };
export default ServiceHistory;
