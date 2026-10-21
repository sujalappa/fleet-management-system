import { getProjectDb } from "../config/projectDb.js";
import { vehicleSchema } from "./vehicleSchema.js";
import { driverSchema } from "./driverSchema.js";
import { tripSchema } from "./tripSchema.js";
import { fuelSchema } from "./fuelSchema.js";
import { geofenceSchema } from "./geofenceSchema.js";
import { gpsDeviceSchema } from "./gpsdeviceSchema.js";
import { gpsLogSchema } from "./gpslogsSchema.js";
import { maintenanceSchema } from "./maintenanceSchema.js";
import { alertSchema } from "./alertSchema.js";
import { assignmentSchema } from "./assignmentSchema.js";
import { cameraEventSchema } from "./cameraEventSchema.js";
import { userSchema } from "./userSchema.js";
import { serviceHistorySchema } from "./serviceHistorySchema.js";
import { vehicleStatusSchema } from "./vehicleStatusSchema.js";

// Registry of all application schemas
const schemas = {
  Vehicle: vehicleSchema,
  Driver: driverSchema,
  Trip: tripSchema,
  Fuel: fuelSchema,
  Geofence: geofenceSchema,
  GPSDevice: gpsDeviceSchema,
  GPSLog: gpsLogSchema,
  Maintenance: maintenanceSchema,
  Alert: alertSchema,
  Assignment: assignmentSchema,
  CameraEvent: cameraEventSchema,
  User: userSchema,
  ServiceHistory: serviceHistorySchema,
  VehicleStatus: vehicleStatusSchema
};

/**
 * Get a Mongoose model specifically bound to a project's isolated database.
 * 
 * Example:
 * const Vehicle = getProjectModel("kamptee", "Vehicle");
 * const trips = await getProjectModel("kamptee", "Trip").find();
 * 
 * @param {string} projectId e.g. "kamptee"
 * @param {string} modelName e.g. "Vehicle", "Trip", "Driver"
 * @returns {mongoose.Model}
 */
export const getProjectModel = (projectId = "kamptee", modelName) => {
  if (!schemas[modelName]) {
    throw new Error(`Schema not found for model name: ${modelName}`);
  }

  const projectDb = getProjectDb(projectId);

  // Mongoose allows compiling a model directly onto a specific DB connection handle
  if (projectDb.models[modelName]) {
    return projectDb.models[modelName];
  }

  return projectDb.model(modelName, schemas[modelName]);
};

export default getProjectModel;
