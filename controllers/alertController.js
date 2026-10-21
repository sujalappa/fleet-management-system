import { getProjectModel } from "../model/index.js";

export const createAlert = async (req, res) => {
  try {
    const Alert = getProjectModel(req.projectId, "Alert");
    const alert = await Alert.create(req.body);

    res.status(201).json({ success: true, data: alert });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/alerts?vehicle_id=&severity=&acknowledged=&alert_type=
export const getAlerts = async (req, res) => {
  try {
    const Alert = getProjectModel(req.projectId, "Alert");
    const { vehicle_id, severity, acknowledged, alert_type } = req.query;

    const filter = {};
    if (vehicle_id) filter.vehicle_id = vehicle_id;
    if (severity) filter.severity = severity;
    if (alert_type) filter.alert_type = alert_type;
    if (acknowledged !== undefined) filter.is_acknowledged = acknowledged === "true";

    const alerts = await Alert.find(filter).sort({ createdAt: -1 }).limit(200);

    res.status(200).json({ success: true, data: alerts });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const acknowledgeAlert = async (req, res) => {
  try {
    const Alert = getProjectModel(req.projectId, "Alert");
    const alert = await Alert.findByIdAndUpdate(
      req.params.id,
      {
        is_acknowledged: true,
        acknowledged_by: req.body.acknowledged_by || req.user?.username || "dispatcher",
        acknowledged_at: new Date()
      },
      { new: true }
    );

    if (!alert) {
      return res.status(404).json({ success: false, message: "Alert not found" });
    }

    res.status(200).json({ success: true, data: alert });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
