import { vecvPost } from "./client.js";

// The spec writes this URL with a double slash ("vecv.net//service-gateway")
// — that's a typo in the doc: the double-slash URL returns 401, the
// single-slash one works. The live API also rejects date ranges over 48h
// (undocumented), so callers must keep eventStartDate..eventEndDate <= 48h.
const ALERTS_URL = "https://partnerapi.vecv.net/service-gateway/alertLog/getGetAlertLogs";

function formatVecvDate(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

// VECV's own alertType/alertSubTypeId strings don't line up with our
// alert_type enum (which predates this integration). Map the ones we know
// about; anything unrecognized falls back to "telematics_alert" rather than
// being dropped, so a new VECV alert type never silently disappears.
const ALERT_TYPE_MAP = {
  VISIT_SOON: "maintenance_due",
  VISIT_NOW: "maintenance_overdue",
  OVERSPEED: "overspeed",
  IDLE_EXCEEDED: "idle_time_exceeded",
  GEOFENCE: "geofence_breach",
  FUEL_THEFT: "fuel_theft",
  FUEL_LOW: "fuel_low"
};

function mapAlertType(alertSubTypeId) {
  return ALERT_TYPE_MAP[alertSubTypeId] || "telematics_alert";
}

function mapSeverity(alertSubTypeId) {
  if (alertSubTypeId === "VISIT_NOW" || alertSubTypeId === "FUEL_THEFT") return "critical";
  if (alertSubTypeId === "OVERSPEED" || alertSubTypeId === "GEOFENCE") return "high";
  return "medium";
}

// startDate/endDate are JS Date objects.
export async function getAlertLogs(chassisNoList, startDate, endDate, keyEnv) {
  const body = await vecvPost(ALERTS_URL, {
    chassisNo: chassisNoList,
    eventStartDate: formatVecvDate(startDate),
    eventEndDate: formatVecvDate(endDate)
  }, keyEnv);

  return (body.alertLog || []).map((row) => ({
    chassisNumber: row.chassisNo,
    registrationNumber: row.regNo,
    caseId: row.caseId,
    alertType: mapAlertType(row.alertSubTypeId),
    externalAlertType: row.alertType,
    alertSubType: row.alertSubType,
    alertSubTypeId: row.alertSubTypeId,
    alertValue: row.alertValue ? Number(row.alertValue) : null,
    alertUnit: row.alertUnit,
    severity: mapSeverity(row.alertSubTypeId),
    latitude: row.lat ? Number(row.lat) : null,
    longitude: row.lng ? Number(row.lng) : null,
    alertTime: row.alertTime ? new Date(row.alertTime) : null,
    faultName: row.faultName,
    caseDescription: row.caseDescription,
    solutionRecommended: row.solutionRecommended,
    odometerKm: row.odometer ? Number(row.odometer) : null,
    raw: row
  }));
}
