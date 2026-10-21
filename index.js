import "dotenv/config";
import express from "express";
import cors from "cors";
import connectDB from "./config/database.js";
import { projectContextMiddleware } from "./config/projectDb.js";
import { protect } from "./middleware/auth.js";
import { startVecvPoller } from "./services/vecv/poller.js";
import { startVolvoPoller } from "./services/volvo/poller.js";
import { startTripDetector } from "./services/trips/tripDetector.js";

import authRoutes from "./routes/authRoutes.js";
import projectRoutes from "./routes/projectRoutes.js";
import driverRoutes from "./routes/driverRoutes.js";
import vehicleRoutes from "./routes/vehicleRoutes.js";
import tripRoutes from "./routes/tripRoutes.js";
import fuelRoutes from "./routes/fuelRoutes.js";
import maintenanceRoutes from "./routes/maintenanceRoutes.js";
import geofenceRoutes from "./routes/geofenceRoutes.js";
import analyticsRoutes from "./routes/analyticsRoutes.js";
import fleetRoutes from "./routes/fleetRoutes.js";
import cameraEventRoutes from "./routes/cameraEventRoutes.js";
import alertRoutes from "./routes/alertRoutes.js";
import serviceHistoryRoutes from "./routes/serviceHistoryRoutes.js";
import ingestRoutes from "./routes/ingestRoutes.js";

const app = express();

// In production set CORS_ORIGIN to the dashboard's URL(s), comma-separated,
// so only our own frontend can call the API from a browser.
const allowedOrigins = (process.env.CORS_ORIGIN || "").split(",").map((o) => o.trim()).filter(Boolean);
app.use(cors(allowedOrigins.length ? { origin: allowedOrigins } : {}));
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.status(200).json({ success: true, status: "ok" });
});

// Cross-project routes — not scoped to a single mine's database.
app.use("/api/auth", authRoutes);
app.use("/api/projects", protect, projectRoutes);

// Every route below operates on one mine's database. The project is chosen
// via the `x-project-id` header (or an explicit /api/:projectId/... prefix),
// defaulting to "kamptee" when neither is given.
app.use("/api/drivers", protect, projectContextMiddleware, driverRoutes);
app.use("/api/vehicles", protect, projectContextMiddleware, vehicleRoutes);
app.use("/api/trips", protect, projectContextMiddleware, tripRoutes);
app.use("/api/fuel", protect, projectContextMiddleware, fuelRoutes);
app.use("/api/maintenance", protect, projectContextMiddleware, maintenanceRoutes);
app.use("/api/geofences", protect, projectContextMiddleware, geofenceRoutes);
app.use("/api/analytics", protect, projectContextMiddleware, analyticsRoutes);
app.use("/api/fleet", protect, projectContextMiddleware, fleetRoutes);
app.use("/api/cameras", protect, projectContextMiddleware, cameraEventRoutes);
app.use("/api/alerts", protect, projectContextMiddleware, alertRoutes);
app.use("/api/service-history", protect, projectContextMiddleware, serviceHistoryRoutes);
app.use("/api/:projectId/ingest", protect, projectContextMiddleware, ingestRoutes);

app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

// Centralized error handler — catches anything thrown/rejected in a route
// that wasn't already turned into a JSON response.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal server error"
  });
});

const PORT = process.env.PORT || 5000;

connectDB().then(async () => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });

  // No-op unless VECV_API_KEY is set and a vehicle has been onboarded to
  // data_source: "vecv_live" — see services/vecv/poller.js.
  await startVecvPoller();
  await startVolvoPoller();
  await startTripDetector();
});
