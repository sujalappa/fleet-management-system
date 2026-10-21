import express from "express";
import {
  createFuelLog,
  getFuelLogs,
  getFuelLogById,
  deleteFuelLog
} from "../controllers/fuelController.js";

const router = express.Router();

router.post("/", createFuelLog);
router.get("/", getFuelLogs);
router.get("/:id", getFuelLogById);
router.delete("/:id", deleteFuelLog);

export default router;
