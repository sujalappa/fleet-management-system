import express from "express";
import {
  createDriver,
  getDrivers,
  getDriverById,
  updateDriver,
  deleteDriver,
  getDriverLeaderboard
} from "../controllers/driverController.js";

const router = express.Router();

// POST   /api/drivers     → create a new driver
router.post("/", createDriver);

// GET    /api/drivers     → get all drivers
router.get("/", getDrivers);

// GET    /api/drivers/leaderboard → ranked drivers (must come before /:id)
router.get("/leaderboard", getDriverLeaderboard);

// GET    /api/drivers/:id → get one driver by id
// :id is a URL parameter — Express puts it in req.params.id
router.get("/:id", getDriverById);

// PUT    /api/drivers/:id → update a driver
router.put("/:id", updateDriver);

// DELETE /api/drivers/:id → delete a driver
router.delete("/:id", deleteDriver);

export default router;