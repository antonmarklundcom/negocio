/**
 * Minimal in-memory fixed-window rate limiter, keyed by client IP.
 *
 * SINGLE-PROCESS BY DESIGN, AND THAT IS A REAL LIMIT (ROADMAP D9). The state
 * is a `Map` in this Node process's heap. Three consequences, all of them
 * accepted deliberately rather than overlooked:
 *
 *  1. **A restart resets every bucket.** A redeploy hands every blocked IP a
 *     fresh budget. Hostinger redeploys on push, so this happens in practice.
 *  2. **N processes means N × the limit.** Today Hostinger runs one Node
 *     process per app, so the configured limit is the real limit. The day this
 *     app runs behind more than one process — a second instance, a PM2
 *     cluster, any horizontal scaling — every limit here silently multiplies.
 *     Nothing will fail loudly; spam volume will simply go up.
 *  3. **Memory is bounded only by the sweep below**, which runs at most once a
 *     minute and only when someone calls in.
 *
 * The replacement, when it is needed, is a shared store (Redis/Upstash) behind
 * the same two functions — no caller changes. Do not reach for that before the
 * process count actually changes: a network round-trip on every public form
 * submission is a worse trade than this while there is exactly one process.
 */
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

// Occasionally evict expired buckets so the map can't grow unbounded.
let lastSweep = 0;
function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, b] of buckets) if (b.resetAt <= now) buckets.delete(key);
}

export function rateLimit(
  key: string,
  { limit = 5, windowMs = 60_000 }: { limit?: number; windowMs?: number } = {},
): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  sweep(now);
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }
  if (b.count >= limit) {
    return { ok: false, retryAfter: Math.ceil((b.resetAt - now) / 1000) };
  }
  b.count++;
  return { ok: true, retryAfter: 0 };
}

/** Best-effort client IP from proxy headers (Hostinger/Passenger sets these). */
export function clientIp(request: Request): string {
  const xff = request.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0]!.trim();
  return request.headers.get('x-real-ip')?.trim() || 'unknown';
}
