import express from "express";
import { createAlert, getAlerts, acknowledgeAlert } from "../controllers/alertController.js";

const router = express.Router();

router.post("/", createAlert);
router.get("/", getAlerts);
router.put("/:id/acknowledge", acknowledgeAlert);

export default router;
