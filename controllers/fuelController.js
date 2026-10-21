import { getProjectModel } from "../model/index.js";

export const createFuelLog = async (req, res) => {
  try {
    const FuelLog = getProjectModel(req.projectId, "Fuel");
    const log = await FuelLog.create(req.body);

    res.status(201).json({ success: true, data: log });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/fuel?vehicle_id=&from=&to=&page=&limit=
export const getFuelLogs = async (req, res) => {
  try {
    const FuelLog = getProjectModel(req.projectId, "Fuel");
    const { vehicle_id, from, to } = req.query;

    const filter = {};
    if (vehicle_id) filter.vehicle_id = vehicle_id;
    if (from || to) {
      filter.device_timestamp = {};
      if (from) filter.device_timestamp.$gte = new Date(from);
      if (to) filter.device_timestamp.$lte = new Date(to);
    }

    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 50, 500);

    const [logs, total] = await Promise.all([
      FuelLog.find(filter)
        .sort({ device_timestamp: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      FuelLog.countDocuments(filter)
    ]);

    res.status(200).json({
      success: true,
      data: logs,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getFuelLogById = async (req, res) => {
  try {
    const FuelLog = getProjectModel(req.projectId, "Fuel");
    const log = await FuelLog.findById(req.params.id);

    if (!log) {
      return res.status(404).json({ success: false, message: "Fuel log not found" });
    }

    res.status(200).json({ success: true, data: log });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteFuelLog = async (req, res) => {
  try {
    const FuelLog = getProjectModel(req.projectId, "Fuel");
    const log = await FuelLog.findByIdAndDelete(req.params.id);

    if (!log) {
      return res.status(404).json({ success: false, message: "Fuel log not found" });
    }

    res.status(200).json({ success: true, message: "Fuel log deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
