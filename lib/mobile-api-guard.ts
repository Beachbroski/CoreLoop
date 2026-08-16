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
        return jsonError('Unauthorized', 401)
      }

      const { userId } = await auth()
      if (!userId) return jsonError('Unauthorized', 401)

      const rl = await checkRateLimit(`v1:onboard:${userId}`, options.rateLimit)
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
        return jsonError('Unauthorized', 401)
      }

      const { userId } = await auth()
      if (!userId) return jsonError('Unauthorized', 401)

      const { user } = await getCurrentAppUser()
      if (!user) return jsonError('Unauthorized', 401)

      const rl = await checkRateLimit(`v1:${user.id}:${getRequestIp(req)}`, options.rateLimit)
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
