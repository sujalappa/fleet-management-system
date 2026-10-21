/**
 * Volvo Connect rFMS v2.1 client (https://api.volvotrucks.com/rfms).
 *
 * Verified against the live API:
 * - HTTP Basic auth with the API Account from Volvo Connect's API Manager.
 * - Rate limit is 1 request per second per endpoint per user (429 above).
 * - Responses use PascalCase field names (VehicleStatus, Vin, ...), not the
 *   camelCase in the rFMS spec — read fields through field().
 * - starttime may be at most 14 days back.
 */
const BASE_URL = "https://api.volvotrucks.com/rfms";
const SPACING_MS = 1100;

const ACCEPT = {
  vehicles: "application/vnd.fmsstandard.com.Vehicles.v2.1+json; UTF-8",
  vehiclepositions: "application/vnd.fmsstandard.com.Vehiclepositions.v2.1+json; UTF-8",
  vehiclestatuses: "application/vnd.fmsstandard.com.Vehiclestatuses.v2.1+json; UTF-8"
};

export function isVolvoConfigured() {
  return !!(process.env.VOLVO_API_USERNAME && process.env.VOLVO_API_PASSWORD);
}

function authHeader() {
  const { VOLVO_API_USERNAME, VOLVO_API_PASSWORD } = process.env;
  return "Basic " + Buffer.from(`${VOLVO_API_USERNAME}:${VOLVO_API_PASSWORD}`).toString("base64");
}

// Case-insensitive field read. Volvo isn't consistent even between its own
// endpoints (/vehicles says "VIN", /vehiclestatuses says "Vin", the spec
// says "vin"; "GNSSPosition" vs "gnssPosition").
export function field(obj, name) {
  if (!obj || typeof obj !== "object") return undefined;
  if (obj[name] !== undefined) return obj[name];
  const lower = name.toLowerCase();
  const key = Object.keys(obj).find((k) => k.toLowerCase() === lower);
  return key === undefined ? undefined : obj[key];
}

let nextAllowedAt = 0;
let chain = Promise.resolve();

// One request at a time, >= 1.1s apart — keeps every endpoint under Volvo's
// 1 req/s limit without per-endpoint bookkeeping.
function schedule(fn) {
  const run = chain.then(async () => {
    let wait;
    while ((wait = nextAllowedAt - Date.now()) > 0) {
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
    nextAllowedAt = Date.now() + SPACING_MS;
    return fn();
  });
  chain = run.catch(() => {});
  return run;
}

async function get(resource, query = {}) {
  const params = new URLSearchParams(
    Object.entries(query).filter(([, v]) => v !== undefined && v !== null && v !== "")
  );
  const url = `${BASE_URL}/${resource}${params.size ? `?${params}` : ""}`;

  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await schedule(() =>
      fetch(url, { headers: { Authorization: authHeader(), Accept: ACCEPT[resource] } })
    );
    if (response.status === 429) {
      nextAllowedAt = Math.max(nextAllowedAt, Date.now() + 2000);
      continue;
    }
    if (!response.ok) {
      throw new Error(`Volvo ${resource} -> HTTP ${response.status} ${(await response.text()).slice(0, 300)}`);
    }
    return response.json();
  }
  throw new Error(`Volvo ${resource} -> still rate-limited after retries`);
}

// rFMS wants ISO 8601 UTC without milliseconds.
export function toRfmsTime(date) {
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}

export async function getVehicles() {
  const vehicles = [];
  let lastVin;
  for (;;) {
    const body = await get("vehicles", { lastVin });
    const page = field(body, "vehicle") || [];
    vehicles.push(...page);
    if (!field(body, "moreDataAvailable") || page.length === 0) break;
    lastVin = field(page.at(-1), "vin");
  }
  return vehicles;
}

// Fetches every record received since `since`, following rFMS time paging:
// the next page starts at the last record's receivedDateTime + 1s.
async function getAllSince(resource, listField, since, extraQuery = {}) {
  const records = [];
  let starttime = since;
  for (let page = 0; page < 500; page++) {
    const body = await get(resource, { starttime: toRfmsTime(starttime), ...extraQuery });
    const list = field(body, listField) || field(field(body, `${listField}Response`), `${listField}s`) || [];
    records.push(...list);
    if (!field(body, "moreDataAvailable") || list.length === 0) break;
    const lastReceived = new Date(field(list.at(-1), "receivedDateTime"));
    starttime = new Date(lastReceived.getTime() + 1000);
  }
  return records;
}

export function getStatusesSince(since) {
  // No contentFilter on purpose: with one, rFMS only returns reports that
  // contain ALL listed blocks — and these trucks send no SNAPSHOT block, so
  // filtering for it would silently return nothing.
  return getAllSince("vehiclestatuses", "vehicleStatus", since);
}

export function getPositionsSince(since) {
  return getAllSince("vehiclepositions", "vehiclePosition", since);
}
