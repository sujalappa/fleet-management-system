import express from "express";
import { getOverview, getEquipmentVolume, getDailyTrend } from "../controllers/analyticsController.js";
import { getPerformance } from "../controllers/performanceController.js";

const router = express.Router();

router.get("/overview", getOverview);
router.get("/equipment-volume", getEquipmentVolume);
router.get("/daily-trend", getDailyTrend);
router.get("/performance", getPerformance);

export default router;
