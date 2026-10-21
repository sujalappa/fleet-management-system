/**
 * Kamptee Opencast Coal Mine — Project Configuration
 * Holds all site-specific coordinates, geofences, tariffs, and shifts.
 */

const kampteeConfig = {
  projectId: "kamptee",
  // Dedicated MongoDB database for this mine.
  // Dummy data lives in `dummy_kamptee_fleet`; when real mine data arrives,
  // set KAMPTEE_DB_NAME=fleet_kamptee in .env — no code change needed.
  dbName: process.env.KAMPTEE_DB_NAME || "dummy_kamptee_fleet",
  isDummyData: !process.env.KAMPTEE_DB_NAME,
  name: "Kamptee Opencast Coal Mine",
  client: "Western Coalfields Limited (WCL)",
  location: {
    state: "Maharashtra",
    district: "Nagpur",
    center: { lat: 21.257, lng: 79.2163 }, // midway between loading point and dump
    zoomLevel: 15
  },

  // Operational Shifts
  shifts: [
    { id: "shift_1", name: "Shift I", startTime: "06:00", endTime: "14:00" },
    { id: "shift_2", name: "Shift II", startTime: "14:00", endTime: "22:00" },
    { id: "shift_3", name: "Shift III (Night)", startTime: "22:00", endTime: "06:00" }
  ],

  // Financial Tariffs (for auto revenue & cost calculation)
  financials: {
    revenuePerCumINR: 250.0,      // ₹250 per cubic meter of Overburden moved
    dieselRatePerLiterINR: 92.0,   // ₹92 per liter of diesel
    averageHourlyWageINR: 150.0    // Operator cost
  },

  // Real geofences, surveyed by the site team (2026-10-21). Trips are
  // detected from GPS as: leave LOADING → arrive DUMP (see
  // services/trips/tripDetector.js). Radius is a starting value — widen it
  // if trips are missed, narrow it if trucks passing nearby are counted.
  geofences: [
    {
      id: "LOAD-01",
      name: "Loading Point & Halt Area",
      zoneType: "loading",
      // Centre of where trucks actually stand while loading: the cluster of
      // 8 truck positions sampled 2026-10-21 (spread 131 m), 126 m NE of the
      // site's original pin (21.24438, 79.216896), which stays inside.
      center: { lat: 21.24516, lng: 79.21777 },
      radiusMeters: 200
    },
    {
      id: "DUMP-01",
      name: "Dumping Yard",
      zoneType: "unloading",
      // 21°16'10.6"N 79°12'56.3"E
      center: { lat: 21.269609, lng: 79.215627 },
      radiusMeters: 200
    }
  ],

  // The live haul route: loading point → dumping yard (~2.8 km apart).
  haulOperation: {
    current: "loading_to_dump",
    phases: {
      loading_to_dump: {
        label: "OB Haul: Loading Point → Dumping Yard",
        fromGeofenceId: "LOAD-01",
        toGeofenceId: "DUMP-01"
      }
    }
  },

  // Thresholds for the Fuel & Performance metrics. Volvo reports speed in
  // 4 km/h bands and RPM in 400 rpm bands, so keep these on those steps.
  performance: {
    overspeedKmh: 60, // trucks average ~45 km/h on the haul road
    highRpm: 2000
  },

  // Production Benchmarks (from PDF dashboard)
  benchmarks: {
    targetCumPerDay: 1095.0,
    averagePayloadCum: 10.59,
    averageCycleTimeMinutes: 12.63,
    standardFuelEfficiencyLPerCum: 0.25
  }
};

export default kampteeConfig;
