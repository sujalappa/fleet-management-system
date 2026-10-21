import { limiterFor, logRequest } from "./rateLimiter.js";

/**
 * Fetches and caches one VECV Bearer token per API key. Each token is
 * refreshed a few minutes before it expires and reused by every call made
 * with that key — the token call goes through the key's rate-limit queue,
 * so it must not be fetched more often than necessary.
 *
 * Keys are identified by the .env variable that holds them
 * ("VECV_API_KEY", "VECV_API_KEY_2", ...), which is also what each
 * Vehicle stores in api_key_env.
 */
const AUTH_URL = "http://partnerapi.vecv.net/service-gateway/secure/genrateToken";
const REFRESH_MARGIN_MS = 5 * 60 * 1000; // refresh 5 min before expTime
export const DEFAULT_KEY_ENV = "VECV_API_KEY";

const cache = new Map(); // keyEnv -> { token, expiry, inflight }

// True if at least one VECV key is configured.
export function isConfigured() {
  return Object.keys(process.env).some((k) => /^VECV_API_KEY(_\d+)?$/.test(k) && process.env[k]);
}

export function apiKeyFor(keyEnv) {
  const apiKey = process.env[keyEnv];
  if (!apiKey) throw new Error(`${keyEnv} is not set in .env — cannot authenticate with VECV.`);
  return apiKey;
}

function entryFor(keyEnv) {
  if (!cache.has(keyEnv)) cache.set(keyEnv, { token: null, expiry: 0, inflight: null });
  return cache.get(keyEnv);
}

async function fetchToken(keyEnv) {
  const apiKey = apiKeyFor(keyEnv);
  const limiter = limiterFor(keyEnv);

  const response = await limiter.schedule(() =>
    fetch(AUTH_URL, { method: "GET", headers: { "API-KEY": apiKey, Accept: "application/json" } })
  );
  logRequest(keyEnv, "genrateToken", response.status);

  if (response.status === 409 || response.status === 429) {
    limiter.penalize();
    throw new Error(`VECV auth rate-limited for ${keyEnv} — will retry after the window clears.`);
  }
  if (!response.ok) {
    throw new Error(`VECV auth failed for ${keyEnv}: HTTP ${response.status} ${await response.text()}`);
  }

  const body = await response.json();
  if (!body.status || !body.token) {
    throw new Error(`VECV auth returned no token for ${keyEnv}: ${body.errorMessage || "unknown error"}`);
  }

  const entry = entryFor(keyEnv);
  entry.token = body.token;
  entry.expiry = body.expTime ? new Date(body.expTime).getTime() : Date.now() + 55 * 60 * 1000;
  return entry.token;
}

// Returns a valid Bearer token for this key, fetching or refreshing it as
// needed. Concurrent callers share one in-flight fetch.
export async function getToken(keyEnv = DEFAULT_KEY_ENV) {
  const entry = entryFor(keyEnv);
  if (!entry.token || Date.now() > entry.expiry - REFRESH_MARGIN_MS) {
    entry.inflight ??= fetchToken(keyEnv).finally(() => {
      entry.inflight = null;
    });
    await entry.inflight;
  }
  return entry.token;
}

// Drops the cached token so the next call fetches a fresh one (used when a
// data call comes back 401).
export function invalidateToken(keyEnv = DEFAULT_KEY_ENV) {
  const entry = entryFor(keyEnv);
  entry.token = null;
  entry.expiry = 0;
}
