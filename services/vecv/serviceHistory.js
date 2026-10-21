import { vecvPost } from "./client.js";

const SERVICE_HISTORY_URL =
  "https://partnerapi.vecv.net/service-gateway/datalake/serviceHistory/getServiceHistory";

// VECV wants "YYYY-MM-DD HH:mm:ss", not ISO.
function formatVecvDate(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

// startDate/endDate are JS Date objects.
export async function getServiceHistory(chassisNoList, startDate, endDate, keyEnv) {
  const body = await vecvPost(SERVICE_HISTORY_URL, {
    chassisNo: chassisNoList,
    startDate: formatVecvDate(startDate),
    endDate: formatVecvDate(endDate)
  }, keyEnv);

  return (body.serviceHistory || []).map((row) => ({
    chassisNumber: row.vehicleChassisNo,
    registrationNumber: row.registrationNo,
    jobCardNumber: row.jobCardNumber,
    dealerName: row.dealerName,
    modelDescription: row.modelDescription,
    orderTypeDescription: row.ordertypedescription,
    invoiceNumber: row.invoiceNumber,
    odometerKm: row.odometer ? Number(row.odometer) : null,
    lubeTranValue: row.lubeTranValue,
    labourTranValue: row.labourTranValue,
    partsValueAmount: row.partsValueAmount,
    totalCostCust: row.totalCostCust ? Number(row.totalCostCust) : null,
    jobCardOpenDate: row.jobCardOpenDate ? new Date(row.jobCardOpenDate) : null,
    jobCardLineItems: (row.jobCardLineItems || []).map((item) => ({
      row_id: item.rowId,
      job_description: item.jobDescription,
      job_id_description: item.jobIdDescription,
      action: item.action,
      matnr: item.matnr,
      matnr_type: item.matnrType,
      observation: item.observation,
      job_type_bezei: item.jobTypeBezei,
      part_qty: item.partQty,
      part_total_amt: item.partTotalAmt,
      part_total_amt_in_gst: item.partTotalAmtInGst
    })),
    raw: row
  }));
}
