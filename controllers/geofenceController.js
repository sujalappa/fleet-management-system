import { getProjectModel } from "../model/index.js";

export const createGeofence = async (req, res) => {
  try {
    const Geofence = getProjectModel(req.projectId, "Geofence");
    const geofence = await Geofence.create(req.body);

    res.status(201).json({ success: true, data: geofence });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getGeofences = async (req, res) => {
  try {
    const Geofence = getProjectModel(req.projectId, "Geofence");
    // Retired zones are kept for history but not served (?all=true for all).
    const filter = req.query.all === "true" ? {} : { status: { $ne: "inactive" } };
    const geofences = await Geofence.find(filter);

    res.status(200).json({ success: true, data: geofences });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateGeofence = async (req, res) => {
  try {
    const Geofence = getProjectModel(req.projectId, "Geofence");
    const geofence = await Geofence.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    if (!geofence) {
      return res.status(404).json({ success: false, message: "Geofence not found" });
    }

    res.status(200).json({ success: true, data: geofence });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteGeofence = async (req, res) => {
  try {
    const Geofence = getProjectModel(req.projectId, "Geofence");
    const geofence = await Geofence.findByIdAndDelete(req.params.id);

    if (!geofence) {
      return res.status(404).json({ success: false, message: "Geofence not found" });
    }

    res.status(200).json({ success: true, message: "Geofence deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
