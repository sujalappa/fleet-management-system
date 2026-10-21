import mongoose from "mongoose";

const connectDB = async () => {
  try {
    // Cross-project collections (dashboard Users, etc.) live in one shared
    // platform database. Each mine's operational data lives in its own
    // fleet_<project> / dummy_<project>_fleet database via useDb() —
    // see config/projectDb.js — so it never mixes with this one.
    await mongoose.connect(process.env.MONGODB_URI, { dbName: "bhushilp_platform" });
    console.log("MongoDB connected successfully");
  } catch (error) {
    console.error("MongoDB connection failed:", error);
    process.exit(1);
  }
};

export default connectDB;