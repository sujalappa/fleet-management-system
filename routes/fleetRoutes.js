import express from "express";
import { getLiveFleet } from "../controllers/fleetController.js";

const router = express.Router();

router.get("/live", getLiveFleet);

export default router;
