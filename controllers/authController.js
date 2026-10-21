import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../model/userSchema.js";

const signToken = (user) =>
  jwt.sign({ sub: user._id.toString(), role: user.role }, process.env.JWT_SECRET, {
    expiresIn: "12h"
  });

const publicUser = (user) => ({
  id: user._id,
  name: user.name,
  username: user.username,
  email: user.email,
  role: user.role,
  assignedProjects: user.assignedProjects,
  status: user.status
});

// POST /api/auth/register — creates a dashboard user (admin/mine_manager/dispatcher/viewer).
export const register = async (req, res) => {
  try {
    const { name, username, email, password, role, assignedProjects } = req.body;

    if (!name || !username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "name, username, email and password are required"
      });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      username,
      email,
      password: password_hash,
      role,
      assignedProjects
    });

    res.status(201).json({ success: true, data: publicUser(user), token: signToken(user) });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: "Username or email already in use" });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/auth/login — accepts { username, password } (username or email).
export const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, message: "username and password are required" });
    }

    const identifier = username.toLowerCase().trim();
    const user = await User.findOne({
      $or: [{ username: identifier }, { email: identifier }]
    });

    if (!user || user.status !== "active") {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    const passwordMatches = await bcrypt.compare(password, user.password);
    if (!passwordMatches) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    res.status(200).json({ success: true, data: publicUser(user), token: signToken(user) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/auth/me — returns the authenticated user (requires `protect` middleware).
export const me = async (req, res) => {
  res.status(200).json({ success: true, data: publicUser(req.user) });
};
