import mongoose from "mongoose";

const vehicleSchema = new mongoose.Schema(
  {
    vehicle_id: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },

    vehicle_number: {
      type: String,
      required: true,
      unique: true,
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

    capacity_tons: {
      type: Number,
      min: 0
    },

    status: {
      type: String,
      enum: ["active", "inactive", "maintenance"],
      default: "active"
    }
  },
  {
    timestamps: true
  }
);

const Vehicle = mongoose.model("Vehicle", vehicleSchema);

export default Vehicle;