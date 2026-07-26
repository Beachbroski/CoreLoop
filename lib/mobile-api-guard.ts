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
 * Wraps a public, unauthenticated /api/v1 route (currently only /api/v1/meta).
 * Still rate limited — by IP, since there's no user yet.
 */
export function withPublicMobileApi(
  rateLimit: RateLimitConfig,
  handler: (req: Request) => Promise<Response>,
) {
  return async (req: Request): Promise<Response> => {
    try {
      const rl = checkRateLimit(`v1:public:${getRequestIp(req)}`, rateLimit)
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

      const rl = checkRateLimit(`v1:${user.id}:${getRequestIp(req)}`, options.rateLimit)
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
