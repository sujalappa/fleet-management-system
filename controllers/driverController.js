import { getProjectModel } from "../model/index.js";

export const createDriver = async (req, res) => {
  try {
    const Driver = getProjectModel(req.projectId, "Driver");
    const driver = await Driver.create(req.body);

    res.status(201).json({
      success: true,
      data: driver
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const getDrivers = async (req, res) => {
  try {
    const Driver = getProjectModel(req.projectId, "Driver");
    const drivers = await Driver.find();

    res.status(200).json({
      success: true,
      data: drivers
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Gets ONE driver by their MongoDB _id
// req.params.id comes from the URL like /api/drivers/abc123
export const getDriverById = async (req, res) => {
  try {
    const Driver = getProjectModel(req.projectId, "Driver");
    const driver = await Driver.findById(req.params.id);

    if (!driver) {
      return res.status(404).json({
        success: false,
        message: "Driver not found"
      });
    }

    res.status(200).json({
      success: true,
      data: driver
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Updates a driver's fields
// findByIdAndUpdate takes the id + new data from req.body
// { new: true } returns the UPDATED document (default returns old one)
// { runValidators: true } ensures schema validations still run on update
export const updateDriver = async (req, res) => {
  try {
    const Driver = getProjectModel(req.projectId, "Driver");
    const driver = await Driver.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    if (!driver) {
      return res.status(404).json({
        success: false,
        message: "Driver not found"
      });
    }

    res.status(200).json({
      success: true,
      data: driver
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// GET /api/drivers/leaderboard
// Ranks drivers by volume moved, blending in trip count and fuel economy —
// feeds the Driver Performance Leaderboard on Tab 4.
export const getDriverLeaderboard = async (req, res) => {
  try {
    const Driver = getProjectModel(req.projectId, "Driver");
    const Trip = getProjectModel(req.projectId, "Trip");

    const stats = await Trip.aggregate([
      { $match: { status: "COMPLETED" } },
      {
        $group: {
          _id: "$driver_id",
          trips_completed: { $sum: 1 },
          cum_moved: { $sum: "$volume_cum" },
          diesel_liters: { $sum: "$diesel_consumed_liters" },
          avg_cycle_time_minutes: { $avg: "$cycle_time_minutes" }
        }
      },
      { $sort: { cum_moved: -1 } }
    ]);

    const drivers = await Driver.find({
      driver_id: { $in: stats.map((s) => s._id) }
    }).lean();
    const driverById = new Map(drivers.map((d) => [d.driver_id, d]));

    const licenseAlertWindowMs = 30 * 24 * 60 * 60 * 1000;
    const now = Date.now();

    const leaderboard = stats.map((s, index) => {
      const driver = driverById.get(s._id) || {};
      const fuelEconomyLPerCum = s.cum_moved ? s.diesel_liters / s.cum_moved : null;
      const licenseExpiringSoon = driver.license_expiry
        ? new Date(driver.license_expiry).getTime() - now < licenseAlertWindowMs
        : false;

      return {
        rank: index + 1,
        driver_id: s._id,
        name: driver.name || s._id,
        status: driver.status,
        trips_completed: s.trips_completed,
        cum_moved: Math.round(s.cum_moved * 100) / 100,
        fuel_economy_l_per_cum: fuelEconomyLPerCum
          ? Math.round(fuelEconomyLPerCum * 1000) / 1000
          : null,
        avg_cycle_time_minutes: Math.round(s.avg_cycle_time_minutes * 100) / 100,
        license_expiry: driver.license_expiry,
        license_expiring_soon: licenseExpiringSoon
      };
    });

    res.status(200).json({ success: true, data: leaderboard });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Deletes a driver permanently from the database
export const deleteDriver = async (req, res) => {
  try {
    const Driver = getProjectModel(req.projectId, "Driver");
    const driver = await Driver.findByIdAndDelete(req.params.id);

    if (!driver) {
      return res.status(404).json({
        success: false,
        message: "Driver not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Driver deleted"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
