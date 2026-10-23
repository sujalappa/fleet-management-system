import express from "express";
import { getOverview, getEquipmentVolume, getDailyTrend } from "../controllers/analyticsController.js";
import { getPerformance, getVehicleSummary, getShiftLog } from "../controllers/performanceController.js";

const router = express.Router();

router.get("/overview", getOverview);
router.get("/equipment-volume", getEquipmentVolume);
router.get("/daily-trend", getDailyTrend);
router.get("/performance", getPerformance);
router.get("/vehicle/:vehicleId/summary", getVehicleSummary);
router.get("/shift-log", getShiftLog);

export default router;
