import express from "express";
import {
  createCameraEvent,
  getCameraEvents,
  acknowledgeCameraEvent
} from "../controllers/cameraEventController.js";

const router = express.Router();

router.post("/", createCameraEvent);
router.get("/events", getCameraEvents);
router.put("/events/:id/acknowledge", acknowledgeCameraEvent);

export default router;
