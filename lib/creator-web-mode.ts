/**
 * CREATOR_WEB_MODE — the server-evaluated switch that retires creator web.
 *
 * Modes (docs/platform-split/07-brand-web-refocus.md W7-4, flipped in W8-13):
 *   full     — today's behavior: creator dashboards render and mutate normally.
 *   readonly — creator dashboards still render, but every creator mutation is
 *              refused server-side with a "use the iOS app" error. Transition
 *              safety valve: revert to `full` with one env change, no deploy.
 *   sunset   — creator dashboard routes redirect to the get-the-app landing
 *              page. Writes stay blocked (sunset implies readonly on writes).
 *
 * This is env-only and read on the server. Nothing here is exposed to or trusted
 * from the client — per docs/platform-split/07 security requirements, `readonly`
 * has to be enforced in route handlers, not by hiding buttons.
 */

export type CreatorWebMode = 'full' | 'readonly' | 'sunset'

/**
 * Unset or unrecognized values resolve to `sunset`, not `full`.
 *
 * The plan doc originally wrote "default full"; the product decision is the
 * opposite, so a missing/typo'd env var lands on the end state we are shipping
 * toward instead of silently reopening creator web. Operational consequence:
 * every environment that still wants working creator web (production today,
 * local dev, previews) must set CREATOR_WEB_MODE explicitly — see
 * docs/platform-split/creator-web-freeze.md.
 */
export const DEFAULT_CREATOR_WEB_MODE: CreatorWebMode = 'sunset'

/** Where sunset-mode creator routes send people. */
export const GET_THE_APP_PATH = '/get-the-app'

/** Single wording for every blocked creator write, web and API alike. */
export const CREATOR_WRITE_BLOCKED_ERROR = 'Manage this in the CreatorDocks iOS app'

/**
 * Creator paths that stay reachable in every mode.
 *
 * `/creator/settings` is here because Stripe Connect onboarding sends creators
 * back to it — `app/api/stripe/onboard` and `app/api/v1/stripe/onboard` set
 * `return_url`/`refresh_url` to `/creator/settings`. Redirecting that path would
 * strand a creator mid-onboarding with no page to land on, i.e. break the money
 * setup. Drop this entry only once those Stripe URLs point somewhere else.
 */
const SUNSET_EXEMPT_CREATOR_PATHS = ['/creator/settings'] as const

/**
 * Request headers that can carry the incoming pathname, in priority order.
 *
 * App Router layouts cannot read the pathname or search params (Next 16
 * `layout.md`: "Layouts do not re-render on navigation, so they do not access
 * pathname"), and the creator layout is the only file that wraps every creator
 * route, so `headers()` is the one per-request signal available to it.
 *
 *   x-pathname     — conventional header for proxy.ts to forward the path with.
 *                    Not set today; setting it makes this deterministic in every
 *                    environment including `next dev` (see the freeze doc).
 *   x-matched-path — set by Vercel's routing layer on every function invocation,
 *                    so this is the header that works in production today.
 *   next-url       — set by Next on some RSC navigations.
 *
 * These are spoofable by a client when nothing upstream overwrites them. That is
 * acceptable *here specifically* because the sunset redirect is a UX affordance,
 * not a security boundary: the boundary is `creatorWriteBlockedResponse()`, which
 * reads env and nothing request-derived.
 */
const PATHNAME_HEADERS = ['x-pathname', 'x-matched-path', 'next-url'] as const

/** Explicit parse — no silent coercion, every branch is covered by tests. */
export function parseCreatorWebMode(raw: string | null | undefined): CreatorWebMode {
  const value = raw?.trim().toLowerCase()

  if (value === 'full') return 'full'
  if (value === 'readonly') return 'readonly'
  if (value === 'sunset') return 'sunset'

  return DEFAULT_CREATOR_WEB_MODE
}

export function getCreatorWebMode(): CreatorWebMode {
  return parseCreatorWebMode(process.env.CREATOR_WEB_MODE)
}

/** Creator mutations run only in `full`; both `readonly` and `sunset` block them. */
export function isCreatorWriteAllowed(mode: CreatorWebMode = getCreatorWebMode()): boolean {
  return mode === 'full'
}

/**
 * Route-handler guard. Returns the 403 to send back, or null to continue:
 *
 *   const creatorWebGate = creatorWriteBlockedResponse()
 *   if (creatorWebGate) return creatorWebGate
 *
 * Matches the `Response.json({ error }, { status })` envelope the surrounding
 * handlers already use.
 */
export function creatorWriteBlockedResponse(
  mode: CreatorWebMode = getCreatorWebMode(),
): Response | null {
  if (isCreatorWriteAllowed(mode)) return null

  return Response.json({ error: CREATOR_WRITE_BLOCKED_ERROR }, { status: 403 })
}

function normalizePathname(raw: string | null): string | null {
  if (!raw) return null

  const trimmed = raw.trim()
  // Only accept root-relative paths; absolute URLs and junk resolve to unknown.
  if (!trimmed.startsWith('/')) return null

  const withoutQuery = trimmed.split('?')[0].split('#')[0]
  if (withoutQuery.length > 1 && withoutQuery.endsWith('/')) {
    return withoutQuery.replace(/\/+$/, '')
  }

  return withoutQuery
}

/** Best-effort pathname for a server render. Null means "could not determine". */
export function readRequestPathname(headers: Headers): string | null {
  for (const header of PATHNAME_HEADERS) {
    const pathname = normalizePathname(headers.get(header))
    if (pathname) return pathname
  }

  return null
}

export function isCreatorPathSunsetExempt(pathname: string): boolean {
  return SUNSET_EXEMPT_CREATOR_PATHS.some(
    exempt => pathname === exempt || pathname.startsWith(`${exempt}/`),
  )
}

/**
 * The path a creator route should redirect to, or null to render normally.
 *
 * An unknown pathname (null) deliberately does NOT redirect. If we cannot prove
 * the request is not the Stripe onboarding return, redirecting risks breaking a
 * payout setup, while not redirecting only means a creator sees a dashboard they
 * cannot write to — writes are already blocked in sunset mode. Broken money beats
 * a missed redirect, so this fails open.
 */
export function resolveCreatorSunsetRedirect(
  pathname: string | null,
  mode: CreatorWebMode = getCreatorWebMode(),
): string | null {
  if (mode !== 'sunset') return null
  if (!pathname) return null
  if (isCreatorPathSunsetExempt(pathname)) return null

  return GET_THE_APP_PATH
}
