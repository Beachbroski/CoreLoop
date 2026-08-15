import { rateLimit, type RateLimitOptions, type RateLimitResult } from './rate-limit'
import { getSiteUrl } from './site-url'

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

/**
 * Durable, cross-instance rate limit. Delegates to lib/rate-limit (Upstash Redis
 * with an in-memory fallback when unconfigured). Now async — callers must await.
 */
export function checkRateLimit(key: string, options: RateLimitOptions): Promise<RateLimitResult> {
  return rateLimit(key, options)
}
