import mongoose from "mongoose";
import { getProjectConfig } from "../projects/index.js";

/**
 * Dynamic Multi-Project Database Connection Manager
 * 
 * Each mine project gets its own isolated MongoDB database on your cluster:
 * - Kamptee Mine  -> fleet_kamptee
 * - Future Mine B -> fleet_project_b
 * 
 * Mongoose's useDb() caches the connection, so there is zero performance overhead
 * and data from different mines is 100% physically isolated into separate databases.
 */

// Cache of project-specific connections
const dbConnections = {};

/**
 * Get the isolated database connection for a specific mine project.
 * @param {string} projectId e.g. "kamptee"
 * @returns {mongoose.Connection}
 */
export const getProjectDb = (projectId = "kamptee") => {
  const sanitizedId = projectId.toLowerCase().trim().replace(/[^a-z0-9_]/g, "_");

  // The database name comes from the project's own config, so swapping dummy
  // data for real mine data is a config change, not a code change.
  const { dbName } = getProjectConfig(sanitizedId);

  if (!dbConnections[dbName]) {
    // useDb creates/reuses a database handle within the existing MongoDB connection pool
    dbConnections[dbName] = mongoose.connection.useDb(dbName, { useCache: true });
    console.log(`[Multi-Project] Switched to isolated database: ${dbName}`);
  }

  return dbConnections[dbName];
};

/**
 * Express Middleware:
 * Inspects incoming request headers or URL parameters (e.g., /api/:projectId/...)
 * and attaches the project-specific database handle to req.projectDb.
 */
export const projectContextMiddleware = (req, res, next) => {
  const projectId = req.params.projectId || req.headers["x-project-id"] || "kamptee";

  try {
    req.projectId = projectId;
    req.projectDb = getProjectDb(projectId);
  } catch (error) {
    return res.status(404).json({ message: error.message });
  }

  next();
};

export default getProjectDb;
