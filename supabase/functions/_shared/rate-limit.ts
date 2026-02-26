/**
 * Simple in-memory sliding-window rate limiter.
 * NOTE: Each Deno Deploy isolate has its own memory, so this is per-isolate.
 * For stricter enforcement, use a Redis-backed approach.
 */

interface WindowEntry {
  count: number;
  resetAt: number;
}

const windows = new Map<string, WindowEntry>();

/**
 * Check and increment the rate limit for a given key.
 * @param key   Unique identifier (e.g. IP or userId)
 * @param limit Maximum requests allowed in the window
 * @param windowMs Window duration in milliseconds (default 1 hour)
 * @returns true if the request is allowed, false if rate-limited
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs = 3_600_000,
): boolean {
  const now = Date.now();
  const entry = windows.get(key);

  if (!entry || now >= entry.resetAt) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= limit) {
    return false;
  }

  entry.count++;
  return true;
}
