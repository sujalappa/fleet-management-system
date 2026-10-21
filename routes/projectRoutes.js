import express from "express";
import { listProjects } from "../projects/index.js";

const router = express.Router();

// GET /api/projects — the Project Portal's mine selector card list.
router.get("/", (req, res) => {
  const projects = listProjects().map((p) => ({
    projectId: p.projectId,
    name: p.name,
    client: p.client,
    location: p.location,
    isDummyData: !!p.isDummyData,
    haulOperation: p.haulOperation
  }));

  res.status(200).json({ success: true, data: projects });
});

export default router;
