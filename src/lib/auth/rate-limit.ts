type Window = { count: number; resetAt: number };

const windows = new Map<string, Window>();

/**
 * Minimal in-memory fixed-window limiter for expensive routes.
 */
export function checkUserRateLimit(key: string, windowMs: number, max: number): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const entry = windows.get(key);
  if (!entry || now >= entry.resetAt) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }
  if (entry.count >= max) {
    return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)) };
  }
  entry.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}
