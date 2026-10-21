import { getProjectModel } from "../model/index.js";

export const createMaintenance = async (req, res) => {
  try {
    const Maintenance = getProjectModel(req.projectId, "Maintenance");
    const record = await Maintenance.create(req.body);

    res.status(201).json({ success: true, data: record });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/maintenance?vehicle_id=&status=&maintenance_type=
export const getMaintenanceRecords = async (req, res) => {
  try {
    const Maintenance = getProjectModel(req.projectId, "Maintenance");
    const { vehicle_id, status, maintenance_type } = req.query;

    const filter = {};
    if (vehicle_id) filter.vehicle_id = vehicle_id;
    if (status) filter.status = status;
    if (maintenance_type) filter.maintenance_type = maintenance_type;

    const records = await Maintenance.find(filter).sort({ createdAt: -1 });

    res.status(200).json({ success: true, data: records });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getMaintenanceById = async (req, res) => {
  try {
    const Maintenance = getProjectModel(req.projectId, "Maintenance");
    const record = await Maintenance.findById(req.params.id);

    if (!record) {
      return res.status(404).json({ success: false, message: "Maintenance record not found" });
    }

    res.status(200).json({ success: true, data: record });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateMaintenance = async (req, res) => {
  try {
    const Maintenance = getProjectModel(req.projectId, "Maintenance");
    const record = await Maintenance.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    if (!record) {
      return res.status(404).json({ success: false, message: "Maintenance record not found" });
    }

    res.status(200).json({ success: true, data: record });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteMaintenance = async (req, res) => {
  try {
    const Maintenance = getProjectModel(req.projectId, "Maintenance");
    const record = await Maintenance.findByIdAndDelete(req.params.id);

    if (!record) {
      return res.status(404).json({ success: false, message: "Maintenance record not found" });
    }

    res.status(200).json({ success: true, message: "Maintenance record deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
