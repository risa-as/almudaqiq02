/**
 * Rate limiter with two backends:
 *  - In-memory (default) — fine for a single instance / local dev.
 *  - Upstash Redis via REST — shared across serverless instances. Enabled
 *    automatically when UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN are set.
 *
 * `checkRateLimit` stays synchronous (in-memory only) for existing call sites.
 * New call sites should prefer `checkRateLimitAsync`, which uses Redis when
 * configured and falls back to the in-memory store otherwise (or on Redis error,
 * so an Upstash outage never blocks logins).
 */

interface RateLimitEntry {
  count: number
  resetAt: number
}

const store = new Map<string, RateLimitEntry>()

// Clean up old entries periodically to prevent memory leaks
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of store.entries()) {
      if (entry.resetAt < now) store.delete(key)
    }
  }, 60_000)
}

export interface RateLimitOptions {
  /** Max requests allowed in the window */
  limit: number
  /** Window duration in milliseconds */
  windowMs: number
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
}

export function checkRateLimit(key: string, options: RateLimitOptions): RateLimitResult {
  const now = Date.now()
  const existing = store.get(key)

  if (!existing || existing.resetAt < now) {
    // New window
    const entry: RateLimitEntry = { count: 1, resetAt: now + options.windowMs }
    store.set(key, entry)
    return { allowed: true, remaining: options.limit - 1, resetAt: entry.resetAt }
  }

  existing.count++
  const allowed = existing.count <= options.limit
  return {
    allowed,
    remaining: Math.max(0, options.limit - existing.count),
    resetAt: existing.resetAt,
  }
}

// ─── Distributed (Upstash Redis REST) ─────────────────────────────────────────

function upstashConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  return url && token ? { url, token } : null
}

async function checkRateLimitRedis(
  key: string,
  options: RateLimitOptions,
  cfg: { url: string; token: string }
): Promise<RateLimitResult> {
  const redisKey = `rl:${key}`
  // Pipeline: INCR then set expiry only when the key is fresh (NX).
  const res = await fetch(`${cfg.url}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([
      ['INCR', redisKey],
      ['PEXPIRE', redisKey, String(options.windowMs), 'NX'],
    ]),
    // A slow limiter must not stall the request path.
    signal: AbortSignal.timeout(2000),
  })
  if (!res.ok) throw new Error(`Upstash ${res.status}`)
  const data = (await res.json()) as Array<{ result?: number; error?: string }>
  const count = Number(data?.[0]?.result ?? 0)
  if (!count || data?.[0]?.error) throw new Error(data?.[0]?.error ?? 'Upstash: bad INCR reply')

  return {
    allowed: count <= options.limit,
    remaining: Math.max(0, options.limit - count),
    resetAt: Date.now() + options.windowMs,
  }
}

/**
 * Redis-backed when Upstash env vars are set; otherwise (or on any Redis
 * failure) falls back to the in-memory limiter so the request never blocks.
 */
export async function checkRateLimitAsync(
  key: string,
  options: RateLimitOptions
): Promise<RateLimitResult> {
  const cfg = upstashConfig()
  if (cfg) {
    try {
      return await checkRateLimitRedis(key, options, cfg)
    } catch (err) {
      console.error('[rate-limit] Redis backend failed, using in-memory fallback:', err)
    }
  }
  return checkRateLimit(key, options)
}
