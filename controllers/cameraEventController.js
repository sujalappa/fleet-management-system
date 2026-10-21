import { getProjectModel } from "../model/index.js";

export const createCameraEvent = async (req, res) => {
  try {
    const CameraEvent = getProjectModel(req.projectId, "CameraEvent");
    const event = await CameraEvent.create(req.body);

    res.status(201).json({ success: true, data: event });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/cameras/events?vehicle_id=&severity=&acknowledged=
export const getCameraEvents = async (req, res) => {
  try {
    const CameraEvent = getProjectModel(req.projectId, "CameraEvent");
    const { vehicle_id, severity, acknowledged } = req.query;

    const filter = {};
    if (vehicle_id) filter.vehicle_id = vehicle_id;
    if (severity) filter.severity = severity;
    if (acknowledged !== undefined) filter.is_acknowledged = acknowledged === "true";

    const events = await CameraEvent.find(filter).sort({ createdAt: -1 }).limit(200);

    res.status(200).json({ success: true, data: events });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const acknowledgeCameraEvent = async (req, res) => {
  try {
    const CameraEvent = getProjectModel(req.projectId, "CameraEvent");
    const event = await CameraEvent.findByIdAndUpdate(
      req.params.id,
      {
        is_acknowledged: true,
        acknowledged_by: req.body.acknowledged_by || req.user?.username || "dispatcher",
        acknowledged_at: new Date()
      },
      { new: true }
    );

    if (!event) {
      return res.status(404).json({ success: false, message: "Camera event not found" });
    }

    res.status(200).json({ success: true, data: event });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
