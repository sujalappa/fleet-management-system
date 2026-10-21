// VECV allows 1 data call per minute per API key, shared across ALL
// endpoints of that key (verified live: any call 30s after a successful
// one got 429). Each key gets its own queue, so two keys poll in parallel
// without slowing each other down.
const DEFAULT_REQUESTS_PER_MINUTE = 1;
const PENALTY_MS = 60 * 1000;

function spacingMs() {
  const perMinute = Number(process.env.VECV_REQUESTS_PER_MINUTE) || DEFAULT_REQUESTS_PER_MINUTE;
  return Math.ceil(60000 / perMinute) + 500; // small margin for clock skew
}

// Set VECV_DEBUG=true to log every VECV request with its status — the
// quickest way to see how the live rate limit actually behaves.
export function logRequest(keyEnv, label, status) {
  if (process.env.VECV_DEBUG === "true") {
    console.log(`[VECV debug] ${new Date().toISOString()} ${keyEnv} ${label} -> ${status}`);
  }
}

function createLimiter() {
  let nextAllowedAt = 0;
  let chain = Promise.resolve();

  return {
    // Runs fn once its turn in the queue comes up, spaced by the rate limit.
    schedule(fn) {
      const run = chain.then(async () => {
        // Loop, not a single wait: a penalize() while this call was already
        // waiting pushes nextAllowedAt further out and must be honoured.
        let wait;
        while ((wait = nextAllowedAt - Date.now()) > 0) {
          await new Promise((resolve) => setTimeout(resolve, wait));
        }
        nextAllowedAt = Date.now() + spacingMs();
        return fn();
      });
      // Keep the queue alive even if this call fails.
      chain = run.catch(() => {});
      return run;
    },
    // Called after a 429/409: the window is exhausted, so hold this key's
    // queue for a full minute rather than burning more requests.
    penalize() {
      nextAllowedAt = Math.max(nextAllowedAt, Date.now() + PENALTY_MS);
    }
  };
}

const limiters = new Map();

// keyEnv is the .env variable holding the API key, e.g. "VECV_API_KEY_2".
export function limiterFor(keyEnv) {
  if (!limiters.has(keyEnv)) limiters.set(keyEnv, createLimiter());
  return limiters.get(keyEnv);
}
