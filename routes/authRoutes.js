import express from "express";
import { register, login, me } from "../controllers/authController.js";
import { protect, requireRole } from "../middleware/auth.js";

const router = express.Router();

// Only an existing admin can create accounts — an open register endpoint
// would let anyone (even as "admin") into a publicly hosted dashboard.
router.post("/register", protect, requireRole("admin"), register);
router.post("/login", login);
router.get("/me", protect, me);

export default router;
