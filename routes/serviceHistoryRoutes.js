import express from "express";
import { getServiceHistory } from "../controllers/serviceHistoryController.js";

const router = express.Router();

router.get("/", getServiceHistory);

export default router;
