/**
 * Dependency-free, in-memory sliding-window IP rate limiter.
 *
 * IMPORTANT - this is PER SERVER INSTANCE. State lives in the process heap, so
 * on Vercel (or any multi-instance / serverless deployment) each lambda has its
 * own counter and the effective limit is roughly `limit x instances`. It also
 * resets on every cold start. This exists to blunt casual abuse of endpoints
 * that cost real money (LLM calls) on a publicly reachable demo.
 *
 * The durable fix is an edge WAF rate-limit rule (e.g. Vercel Firewall custom
 * rule keyed on IP + path) or a shared store such as Redis/Upstash. Treat this
 * module as a stopgap, not as the security boundary.
 */

export interface RateLimitResult {
  /** True when the request is allowed through. */
  ok: boolean;
  /** Requests still available in the current window. */
  remaining: number;
  /** Seconds until the window frees up (only meaningful when ok === false). */
  retryAfter: number;
  /** Configured ceiling, echoed for response headers. */
  limit: number;
}

export interface RateLimitOptions {
  /** Max requests permitted per window. Default 20. */
  limit?: number;
  /** Window length in milliseconds. Default 60_000 (1 minute). */
  windowMs?: number;
}

// bucket key -> ascending list of request timestamps (ms) inside the window
const buckets = new Map<string, number[]>();

// Stop the Map from growing without bound on a long-lived instance.
const MAX_TRACKED_KEYS = 10_000;
let lastSweep = 0;

function sweep(now: number, windowMs: number) {
  // At most one sweep per window, and only when the Map is actually large.
  if (buckets.size < MAX_TRACKED_KEYS || now - lastSweep < windowMs) return;
  lastSweep = now;
  for (const [key, hits] of buckets) {
    if (hits.length === 0 || hits[hits.length - 1] <= now - windowMs) {
      buckets.delete(key);
    }
  }
}

/**
 * Best-effort client IP.
 *
 * `x-forwarded-for` is a comma-separated chain; the left-most entry is the
 * original client as reported by the first proxy. It is spoofable by a direct
 * caller, which is another reason the WAF is the real control - but behind
 * Vercel the platform rewrites it, so it is good enough here.
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return (
    request.headers.get('x-real-ip')?.trim() ||
    request.headers.get('cf-connecting-ip')?.trim() ||
    'unknown'
  );
}

/**
 * Record a hit for `identifier` and report whether it is within the window.
 *
 * @param identifier Usually `${routeName}:${ip}` so routes get separate budgets.
 */
export function rateLimit(
  identifier: string,
  options: RateLimitOptions = {}
): RateLimitResult {
  const limit = options.limit ?? 20;
  const windowMs = options.windowMs ?? 60_000;
  const now = Date.now();
  const windowStart = now - windowMs;

  sweep(now, windowMs);

  const previous = buckets.get(identifier) ?? [];
  // Drop timestamps that have aged out of the sliding window.
  const hits = previous.filter((ts) => ts > windowStart);

  if (hits.length >= limit) {
    buckets.set(identifier, hits);
    const oldest = hits[0];
    const retryAfter = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
    return { ok: false, remaining: 0, retryAfter, limit };
  }

  hits.push(now);
  buckets.set(identifier, hits);

  return {
    ok: true,
    remaining: Math.max(0, limit - hits.length),
    retryAfter: 0,
    limit,
  };
}

/**
 * Convenience wrapper: rate-limit a request by its client IP.
 * Returns a ready-to-send 429 `Response` when the caller is over budget, or
 * `null` when the request should proceed.
 */
export function checkRateLimit(
  request: Request,
  routeName: string,
  options: RateLimitOptions = {}
): Response | null {
  const ip = getClientIp(request);
  const result = rateLimit(`${routeName}:${ip}`, options);

  if (result.ok) return null;

  return new Response(
    JSON.stringify({
      error: 'Too many requests. Please slow down and try again shortly.',
      retryAfter: result.retryAfter,
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(result.retryAfter),
        'X-RateLimit-Limit': String(result.limit),
        'X-RateLimit-Remaining': '0',
      },
    }
  );
}
