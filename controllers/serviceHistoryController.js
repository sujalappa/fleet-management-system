import { getProjectModel } from "../model/index.js";

// GET /api/service-history?vehicle_id=&chassis_number=
export const getServiceHistory = async (req, res) => {
  try {
    const ServiceHistory = getProjectModel(req.projectId, "ServiceHistory");
    const { vehicle_id, chassis_number } = req.query;

    const filter = {};
    if (vehicle_id) filter.vehicle_id = vehicle_id;
    if (chassis_number) filter.chassis_number = chassis_number;

    const records = await ServiceHistory.find(filter).sort({ job_card_open_date: -1 }).limit(200);

    res.status(200).json({ success: true, data: records });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
