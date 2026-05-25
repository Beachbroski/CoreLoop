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

function getAllowedOrigin(): string | null {
  const siteUrl = getSiteUrl()
  if (!siteUrl) return null

  try {
    return new URL(siteUrl).origin
  } catch {
    return null
  }
}

export function isTrustedOrigin(req: Request): boolean {
  const allowedOrigin = getAllowedOrigin()
  if (!allowedOrigin) return true

  const origin = req.headers.get('origin')
  if (origin && origin !== allowedOrigin) return false

  const referer = req.headers.get('referer')
  if (!origin && referer) {
    try {
      if (new URL(referer).origin !== allowedOrigin) return false
    } catch {
      return false
    }
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
