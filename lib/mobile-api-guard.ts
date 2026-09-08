import { auth } from '@clerk/nextjs/server'
import { getCurrentAppUser } from './current-app-user'
import { checkRateLimit, getRequestIp } from './request-security'
import type { Role } from '@creatordocks/shared'

export type MobileAuthedUser = {
  id: string
  email: string
  name: string | null
  role: Role
}

type RateLimitConfig = { limit: number; windowMs: number }

function jsonError(message: string, status: number, extraHeaders?: Record<string, string>): Response {
  return Response.json({ success: false, error: message }, { status, headers: extraHeaders })
}

/**
 * Every 401 out of this namespace carries `WWW-Authenticate`, per RFC 9110 and
 * the W5-H2 review: a 401 without it is a malformed challenge, and it is the
 * signal that tells a client the failure is "your token" rather than "this
 * resource". `Bearer` alone — no `error=` parameter — because the reason a
 * token was refused is not something an unauthenticated caller gets to learn.
 */
const BEARER_CHALLENGE = { 'WWW-Authenticate': 'Bearer realm="creatordocks"' } as const

function unauthorized(): Response {
  return jsonError('Unauthorized', 401, { ...BEARER_CHALLENGE })
}

/**
 * Rate-limit bucket for a request, so each route gets its own budget.
 *
 * Before this existed the key was `v1:<userId>:<ip>` for every authenticated
 * route while the limits differed wildly per route (reads 60/min, DELETE /me
 * and POST /stripe/onboard 5/min). One counter served them all and the *lowest*
 * limit won: six campaign fetches on app launch consumed the budget, and the
 * creator's first tap on "Connect Stripe" or "Delete account" came back 429.
 *
 * Dynamic segments are collapsed to `:id` so a caller cannot mint a fresh
 * bucket per resource — `/applications/<cuid>` and `/applications/<other>` must
 * share one budget, or the limit is trivially bypassed by varying the id.
 */
export function rateLimitBucket(req: Request): string {
  let pathname: string
  try {
    pathname = new URL(req.url).pathname
  } catch {
    // A relative or malformed URL should never widen the limit, so fall back to
    // a single shared bucket rather than skipping the route dimension.
    return `${req.method}:unknown`
  }

  const normalized = pathname
    .replace(/^\/api\/v1\/?/, '')
    .split('/')
    .filter(Boolean)
    .map(segment => (looksLikeIdentifier(segment) ? ':id' : segment))
    .join('/')

  return `${req.method}:${normalized || 'root'}`
}

/**
 * cuids (`c` + 24 chars) are what Prisma generates here; Expo push tokens are
 * the other dynamic segment on this surface. The length floor also catches any
 * future opaque id without needing to know its shape.
 */
function looksLikeIdentifier(segment: string): boolean {
  const value = decodeURIComponent(segment)
  return /^c[a-z0-9]{20,}$/i.test(value) || /^ExponentPushToken\[/.test(value) || value.length >= 16
}

/**
 * Wraps an /api/v1 route that needs a verified Clerk identity but must run
 * BEFORE a DB user row exists — currently only /api/v1/onboarding, which
 * creates that row.
 *
 * `withMobileApi` 401s when getCurrentAppUser() finds no row, which is correct
 * for every other route but would make account creation impossible from the
 * app: a creator who only ever signs up on iOS has a Clerk identity and no
 * row, so every call fails and nothing can ever create one.
 *
 * Same Bearer-only rule as withMobileApi (a cookie session must not reach
 * /api/v1). Rate limited on the Clerk user id — there is no DB id yet — under
 * its own key prefix so it can't collide with the other two guards' keyspaces.
 */
export function withMobileAuthOnly(
  options: { rateLimit: RateLimitConfig },
  handler: (ctx: { req: Request; clerkUserId: string }) => Promise<Response>,
) {
  return async (req: Request): Promise<Response> => {
    try {
      const authHeader = req.headers.get('authorization')
      if (!authHeader?.startsWith('Bearer ')) {
        return unauthorized()
      }

      const { userId } = await auth()
      if (!userId) return unauthorized()

      const rl = await checkRateLimit(`v1:onboard:${rateLimitBucket(req)}:${userId}`, options.rateLimit)
      if (!rl.ok) {
        return jsonError('Too many requests. Please try again shortly.', 429, {
          'Retry-After': String(rl.retryAfterSeconds),
        })
      }

      return await handler({ req, clerkUserId: userId })
    } catch (err) {
      console.error('[mobile-api-guard:auth-only]', err)
      return jsonError('Internal server error', 500)
    }
  }
}

/**
 * Wraps a public, unauthenticated /api/v1 route (currently only /api/v1/meta).
 * Still rate limited — by IP, since there's no user yet.
 */
export function withPublicMobileApi(
  rateLimit: RateLimitConfig,
  handler: (req: Request) => Promise<Response>,
) {
  return async (req: Request): Promise<Response> => {
    try {
      const rl = await checkRateLimit(`v1:public:${getRequestIp(req)}`, rateLimit)
      if (!rl.ok) {
        return jsonError('Too many requests. Please try again shortly.', 429, {
          'Retry-After': String(rl.retryAfterSeconds),
        })
      }

      return await handler(req)
    } catch (err) {
      console.error('[mobile-api-guard:public]', err)
      return jsonError('Internal server error', 500)
    }
  }
}

/**
 * Wraps an authenticated /api/v1 route. Requires an explicit Bearer token —
 * a request authenticated only via the ambient session cookie is rejected,
 * since /api/v1 skips the origin-check CSRF defense that cookie-auth routes
 * rely on (see docs/platform-split/02-mobile-api.md, decision 3).
 */
export function withMobileApi<RouteContext = unknown>(
  options: { rateLimit: RateLimitConfig; role?: Role },
  handler: (ctx: { req: Request; user: MobileAuthedUser; context: RouteContext }) => Promise<Response>,
) {
  return async (req: Request, routeContext?: RouteContext): Promise<Response> => {
    try {
      const authHeader = req.headers.get('authorization')
      if (!authHeader?.startsWith('Bearer ')) {
        return unauthorized()
      }

      const { userId } = await auth()
      if (!userId) return unauthorized()

      const { user } = await getCurrentAppUser()
      if (!user) return unauthorized()

      const rl = await checkRateLimit(`v1:${rateLimitBucket(req)}:${user.id}:${getRequestIp(req)}`, options.rateLimit)
      if (!rl.ok) {
        return jsonError('Too many requests. Please try again shortly.', 429, {
          'Retry-After': String(rl.retryAfterSeconds),
        })
      }

      if (options.role && user.role !== options.role) {
        return jsonError('Forbidden', 403)
      }

      return await handler({ req, user, context: routeContext as RouteContext })
    } catch (err) {
      console.error('[mobile-api-guard]', err)
      return jsonError('Internal server error', 500)
    }
  }
}
