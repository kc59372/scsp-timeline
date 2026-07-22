/**
 * Best-effort in-memory rate limiter (fixed window) for throttling abusive
 * clients — primarily bulk HTML scraping of the public pages. Enforced in
 * middleware.ts on page routes only (the JSON API is separately locked by
 * lib/apiGuard.ts).
 *
 * DISABLED BY DEFAULT — set RATE_LIMIT_ENABLED="true" to turn it on. Tunables:
 *   RATE_LIMIT_ENABLED     "true" to enable (default off)
 *   RATE_LIMIT_MAX         requests allowed per window per IP (default 120)
 *   RATE_LIMIT_WINDOW_SEC  window length in seconds (default 60)
 *
 * DEPLOYMENT NOTE: counters live in the process's memory. On a single instance
 * (local, self-host) the limit is exact. On a horizontally-scaled host (Google
 * Cloud Run with N containers) each instance counts independently, so the
 * effective ceiling is ~max × N — still a useful brake, but not a strict global
 * cap. For exact global limits, enforce at the platform edge (a Google Cloud
 * Armor rate-limiting policy on the load balancer) or back this with a shared
 * store (Redis); either can be added later without changing call sites.
 *
 * Edge-safe: uses only Map / Date.now / process.env (no Node-only APIs), so it
 * runs in the Next.js middleware runtime.
 */

interface Bucket {
  count: number;
  resetAt: number; // epoch ms when the current window expires
}

const buckets = new Map<string, Bucket>();
const MAX_TRACKED = 10_000; // memory cap; sweep expired entries past this

export interface RateLimitConfig {
  enabled: boolean;
  max: number;
  windowSec: number;
}

export function rateLimitConfig(): RateLimitConfig {
  const max = Number(process.env.RATE_LIMIT_MAX);
  const windowSec = Number(process.env.RATE_LIMIT_WINDOW_SEC);
  return {
    enabled: process.env.RATE_LIMIT_ENABLED === "true", // default OFF
    max: Number.isFinite(max) && max > 0 ? max : 120,
    windowSec: Number.isFinite(windowSec) && windowSec > 0 ? windowSec : 60,
  };
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetSeconds: number; // seconds until the window resets (for Retry-After)
}

/** Record one hit for `key` and report whether it's within the limit. */
export function checkRateLimit(key: string): RateLimitResult {
  const { max, windowSec } = rateLimitConfig();
  const now = Date.now();
  const windowMs = windowSec * 1000;

  let bucket = buckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(key, bucket);
  }
  bucket.count++;

  // Opportunistic cleanup so the map can't grow without bound under many IPs.
  if (buckets.size > MAX_TRACKED) {
    for (const [k, v] of buckets) if (now >= v.resetAt) buckets.delete(k);
  }

  return {
    allowed: bucket.count <= max,
    limit: max,
    remaining: Math.max(0, max - bucket.count),
    resetSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
  };
}
