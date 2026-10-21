import express from "express";
import {
  createVehicle,
  getVehicle,
  getVehicleById,
  updateVehicle,
  deleteVehicle
} from "../controllers/vehicleController.js";

const router = express.Router();

router.post("/", createVehicle);
router.get("/", getVehicle);
router.get("/:id", getVehicleById);
router.put("/:id", updateVehicle);
router.delete("/:id", deleteVehicle);

export default router;