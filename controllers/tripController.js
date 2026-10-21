import { getProjectModel } from "../model/index.js";

export const createTrip = async (req, res) => {
  try {
    const Trip = getProjectModel(req.projectId, "Trip");
    const trip = await Trip.create(req.body);

    res.status(201).json({ success: true, data: trip });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/trips?vehicle_id=&driver_id=&status=&from=&to=&page=&limit=
export const getTrips = async (req, res) => {
  try {
    const Trip = getProjectModel(req.projectId, "Trip");
    const { vehicle_id, driver_id, status, from, to } = req.query;

    const filter = {};
    if (vehicle_id) filter.vehicle_id = vehicle_id;
    if (driver_id) filter.driver_id = driver_id;
    if (status) filter.status = status;
    if (from || to) {
      filter.start_time = {};
      if (from) filter.start_time.$gte = new Date(from);
      if (to) filter.start_time.$lte = new Date(to);
    }

    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 50, 500);

    const [trips, total] = await Promise.all([
      Trip.find(filter)
        .sort({ start_time: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Trip.countDocuments(filter)
    ]);

    res.status(200).json({
      success: true,
      data: trips,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getTripById = async (req, res) => {
  try {
    const Trip = getProjectModel(req.projectId, "Trip");
    const trip = await Trip.findById(req.params.id);

    if (!trip) {
      return res.status(404).json({ success: false, message: "Trip not found" });
    }

    res.status(200).json({ success: true, data: trip });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateTrip = async (req, res) => {
  try {
    const Trip = getProjectModel(req.projectId, "Trip");
    const trip = await Trip.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    if (!trip) {
      return res.status(404).json({ success: false, message: "Trip not found" });
    }

    res.status(200).json({ success: true, data: trip });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteTrip = async (req, res) => {
  try {
    const Trip = getProjectModel(req.projectId, "Trip");
    const trip = await Trip.findByIdAndDelete(req.params.id);

    if (!trip) {
      return res.status(404).json({ success: false, message: "Trip not found" });
    }

    res.status(200).json({ success: true, message: "Trip deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
