import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

export type RateLimitResult = { ok: boolean; retryAfterSeconds: number }
export type RateLimitOptions = { limit: number; windowMs: number }

// --- In-memory fallback (the previous fixed-window logic) --------------------
// Used only when no durable store is configured (local dev, CI, tests). On
// Vercel serverless each instance gets its own Map, so this is per-instance and
// resets on cold start — hence the durable store below is required in prod. This
// fallback keeps local/test behavior identical to before and means production is
// never worse than it is today, even before Upstash is provisioned.
type Bucket = { count: number; resetAt: number }

const globalStore = globalThis as unknown as {
  __creatordocksRateLimitStore?: Map<string, Bucket>
}

const memoryStore = globalStore.__creatordocksRateLimitStore ?? new Map<string, Bucket>()

if (!globalStore.__creatordocksRateLimitStore) {
  globalStore.__creatordocksRateLimitStore = memoryStore
}

function memoryLimit(key: string, { limit, windowMs }: RateLimitOptions): RateLimitResult {
  const now = Date.now()
  const existing = memoryStore.get(key)

  if (!existing || existing.resetAt <= now) {
    memoryStore.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true, retryAfterSeconds: Math.ceil(windowMs / 1000) }
  }

  if (existing.count >= limit) {
    return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)) }
  }

  existing.count += 1
  memoryStore.set(key, existing)
  return { ok: true, retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)) }
}

// --- Durable store (Upstash Redis via Vercel Marketplace) --------------------
let cachedRedis: Redis | null = null
let redisResolved = false

function getRedis(): Redis | null {
  if (redisResolved) return cachedRedis

  redisResolved = true
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN
  if (!url || !token) return null

  cachedRedis = new Redis({ url, token })
  return cachedRedis
}

// One Ratelimit instance per distinct (limit, windowMs) config — the sliding
// window is fixed at construction, so we key the cache by the config pair.
const limiterCache = new Map<string, Ratelimit>()

function getLimiter(redis: Redis, { limit, windowMs }: RateLimitOptions): Ratelimit {
  const cacheKey = `${limit}:${windowMs}`
  const cached = limiterCache.get(cacheKey)
  if (cached) return cached

  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limit, `${windowMs} ms`),
    prefix: 'cd:rl',
    analytics: false,
  })
  limiterCache.set(cacheKey, limiter)
  return limiter
}

/** True when a durable rate-limit store is configured (i.e. not on the fallback). */
export function isDurableRateLimitConfigured(): boolean {
  return getRedis() !== null
}

/**
 * Durable, cross-instance rate limit. Falls back to an in-memory store when no
 * Upstash/KV credentials are present, and fails open (allow + log) on a store
 * error so a limiter outage never takes down the API.
 */
export async function rateLimit(key: string, options: RateLimitOptions): Promise<RateLimitResult> {
  const redis = getRedis()
  if (!redis) return memoryLimit(key, options)

  try {
    const limiter = getLimiter(redis, options)
    const res = await limiter.limit(key)
    return {
      ok: res.success,
      retryAfterSeconds: Math.max(1, Math.ceil((res.reset - Date.now()) / 1000)),
    }
  } catch (err) {
    console.error('[rate-limit] durable store error — failing open', err)
    return { ok: true, retryAfterSeconds: Math.ceil(options.windowMs / 1000) }
  }
}
