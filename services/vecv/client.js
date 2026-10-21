import { getToken, invalidateToken, apiKeyFor, DEFAULT_KEY_ENV } from "./tokenManager.js";
import { limiterFor, logRequest } from "./rateLimiter.js";

// The spec says 409 on rate limit, but the live API actually returns 429 —
// both are treated as rate limiting.
export class VecvRateLimitError extends Error {
  constructor(message) {
    super(message);
    this.name = "VecvRateLimitError";
  }
}

// A 401 that survives a fresh token means this endpoint isn't enabled for
// the API key (e.g. Alerts on a Location+Fuel-only subscription).
export class VecvUnauthorizedError extends Error {
  constructor(message) {
    super(message);
    this.name = "VecvUnauthorizedError";
  }
}

function buildHeaders(token, keyEnv) {
  const headers = {
    Authorization: `Bearer ${token}`,
    "API-KEY": apiKeyFor(keyEnv),
    "Content-Type": "application/json",
    Accept: "application/json"
  };
  if (process.env.VECV_CLIENT_ID) {
    headers["X-IBM-Client-Id"] = process.env.VECV_CLIENT_ID;
  }
  return headers;
}

async function postOnce(url, body, keyEnv) {
  // Token first, outside the scheduled call — getToken schedules its own
  // slot when it needs a refresh, and nesting schedule() would deadlock.
  const token = await getToken(keyEnv);
  const response = await limiterFor(keyEnv).schedule(() =>
    fetch(url, { method: "POST", headers: buildHeaders(token, keyEnv), body: JSON.stringify(body) })
  );
  logRequest(keyEnv, new URL(url).pathname.split("/").pop(), response.status);
  return response;
}

// keyEnv: the .env variable holding the API key that owns these vehicles.
export async function vecvPost(url, body, keyEnv = DEFAULT_KEY_ENV) {
  let response = await postOnce(url, body, keyEnv);

  if (response.status === 401) {
    invalidateToken(keyEnv);
    response = await postOnce(url, body, keyEnv);
    if (response.status === 401) {
      throw new VecvUnauthorizedError(`VECV rejected ${url} (401) — endpoint likely not enabled for this API key`);
    }
  }

  if (response.status === 409 || response.status === 429) {
    limiterFor(keyEnv).penalize();
    throw new VecvRateLimitError(`VECV rate limit hit for ${url}`);
  }
  if (!response.ok) {
    throw new Error(`VECV request failed: ${url} -> HTTP ${response.status} ${await response.text()}`);
  }

  const json = await response.json();
  // VECV reports some request errors (e.g. "date range should not exceed 2
  // days") as HTTP 200 with a null payload and an errorMessage — surface
  // those instead of letting them read as "no data".
  if (json.errorMessage && !/^none$/i.test(json.errorMessage)) {
    throw new Error(`VECV returned an error for ${url}: ${json.errorMessage}`);
  }
  return json;
}

// VECV timestamps are the string "yyyymmddhhmmss" in IST — this turns one
// into a proper JS Date (IST is UTC+5:30).
export function parseVecvTimestamp(value) {
  if (!value) return null;
  const s = String(value);
  if (s.length !== 14) return null;

  const year = s.slice(0, 4);
  const month = s.slice(4, 6);
  const day = s.slice(6, 8);
  const hour = s.slice(8, 10);
  const minute = s.slice(10, 12);
  const second = s.slice(12, 14);

  return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}+05:30`);
}
