import express from "express";
import { ingest } from "../controllers/ingestController.js";

const router = express.Router();

// POST /api/:projectId/ingest/:entity  (entity: trip | fuel | maintenance)
router.post("/:entity", ingest);

export default router;
