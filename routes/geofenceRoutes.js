import express from "express";
import {
  createGeofence,
  getGeofences,
  updateGeofence,
  deleteGeofence
} from "../controllers/geofenceController.js";

const router = express.Router();

router.post("/", createGeofence);
router.get("/", getGeofences);
router.put("/:id", updateGeofence);
router.delete("/:id", deleteGeofence);

export default router;
