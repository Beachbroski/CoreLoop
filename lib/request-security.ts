import { getSiteUrl } from './site-url'

type RateLimitBucket = {
  count: number
  resetAt: number
}

const globalStore = globalThis as unknown as {
  __coreloopRateLimitStore?: Map<string, RateLimitBucket>
}

const rateLimitStore = globalStore.__coreloopRateLimitStore ?? new Map<string, RateLimitBucket>()

if (!globalStore.__coreloopRateLimitStore) {
  globalStore.__coreloopRateLimitStore = rateLimitStore
}

function getAllowedOrigins(req: Request): Set<string> {
  const allowedOrigins = new Set<string>()

  const siteUrl = getSiteUrl()
  if (siteUrl) {
    try {
      allowedOrigins.add(new URL(siteUrl).origin)
    } catch {}
  }

  try {
    allowedOrigins.add(new URL(req.url).origin)
  } catch {}

  const forwardedHost = req.headers.get('x-forwarded-host')
  const forwardedProto = req.headers.get('x-forwarded-proto') ?? 'https'
  if (forwardedHost) {
    allowedOrigins.add(`${forwardedProto}://${forwardedHost}`)
  }

  const host = req.headers.get('host')
  if (host) {
    allowedOrigins.add(`${forwardedProto}://${host}`)
  }

  return allowedOrigins
}

export function isTrustedOrigin(req: Request): boolean {
  const allowedOrigins = getAllowedOrigins(req)
  if (allowedOrigins.size === 0) {
    // In production, a missing site URL is a misconfiguration — block the request.
    // In development, allow through so local dev works without NEXT_PUBLIC_URL set.
    return process.env.NODE_ENV !== 'production'
  }

  const origin = req.headers.get('origin')
  if (origin && !allowedOrigins.has(origin)) return false

  const referer = req.headers.get('referer')
  if (!origin && referer) {
    try {
      if (!allowedOrigins.has(new URL(referer).origin)) return false
    } catch {
      return false
    }
  }

  if (!origin && !referer && process.env.NODE_ENV === 'production') {
    return false
  }

  const secFetchSite = req.headers.get('sec-fetch-site')
  if (secFetchSite && !['same-origin', 'same-site', 'none'].includes(secFetchSite)) {
    return false
  }

  return true
}

export function getRequestIp(req: Request): string {
  const forwardedFor = req.headers.get('x-forwarded-for')
  if (forwardedFor) {
    const firstIp = forwardedFor.split(',')[0]?.trim()
    if (firstIp) return firstIp
  }

  return req.headers.get('x-real-ip') ?? 'unknown'
}

export function checkRateLimit(
  key: string,
  { limit, windowMs }: { limit: number; windowMs: number },
): { ok: boolean; retryAfterSeconds: number } {
  const now = Date.now()
  const existing = rateLimitStore.get(key)

  if (!existing || existing.resetAt <= now) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true, retryAfterSeconds: Math.ceil(windowMs / 1000) }
  }

  if (existing.count >= limit) {
    return {
      ok: false,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    }
  }

  existing.count += 1
  rateLimitStore.set(key, existing)

  return {
    ok: true,
    retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
  }
}
