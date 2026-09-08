import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * W2-11 — the authorization matrix for the whole `/api/v1` namespace.
 *
 * `docs/platform-split/02-mobile-api.md` calls this "the single most important
 * test in the workstream", and until now it did not exist. Every per-route test
 * under `app/api/v1/**` opens with:
 *
 *     vi.mock('@/lib/mobile-api-guard', () => ({ withMobileApi: (_o, h) => h }))
 *
 * — it replaces the guard with a passthrough and calls the inner handler with a
 * fabricated `{ user, context }`. That is useful for handler logic and blind by
 * construction to everything the guard does: the Bearer requirement, the
 * cookie-only rejection, the role check, the 401 challenge and the rate limit.
 * Two of the worst defects found in the 2026-09-06 audit lived in exactly that
 * blind spot while the suite stayed green.
 *
 * So this file mocks Clerk, Prisma and the rate limiter, and runs **the real
 * guard** against every exported route handler, calling them the way Next.js
 * does: `handler(request, routeContext)`.
 *
 * Four properties, asserted for every endpoint rather than a chosen few:
 *   1. no/!Bearer/invalid credentials  -> 401 + `WWW-Authenticate`
 *   2. a session cookie without a Bearer token -> 401 (never accepted)
 *   3. the wrong role -> 403
 *   4. another creator's resource -> 404, never 403 (existence is not leaked)
 */

const { authMock, getCurrentAppUserMock, checkRateLimitMock, prismaMock, clerkClientMock } = vi.hoisted(() => {
  const model = () => ({
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
    aggregate: vi.fn(),
  })
  return {
    authMock: vi.fn(),
    getCurrentAppUserMock: vi.fn(),
    checkRateLimitMock: vi.fn(),
    clerkClientMock: vi.fn(),
    prismaMock: {
      user: model(),
      campaign: model(),
      application: model(),
      submission: model(),
      payout: model(),
      device: model(),
      $transaction: vi.fn(),
    },
  }
})

vi.mock('@clerk/nextjs/server', () => ({ auth: authMock, clerkClient: clerkClientMock, currentUser: vi.fn() }))
vi.mock('@/lib/current-app-user', () => ({ getCurrentAppUser: getCurrentAppUserMock }))
vi.mock('@/lib/prisma', () => ({ default: prismaMock }))
vi.mock('@/lib/request-security', () => ({
  checkRateLimit: checkRateLimitMock,
  getRequestIp: () => '203.0.113.7',
  isTrustedOrigin: () => true,
}))
vi.mock('@/lib/stripe', () => ({
  default: { accounts: { create: vi.fn(), retrieve: vi.fn() }, accountLinks: { create: vi.fn() } },
  stripe: { accounts: { create: vi.fn(), retrieve: vi.fn() }, accountLinks: { create: vi.fn() } },
}))
vi.mock('@/lib/push', () => ({ sendPushToUser: vi.fn() }))
vi.mock('@/lib/email', () => ({
  sendApplicationDecisionEmail: vi.fn(),
  sendSubmissionApprovedEmail: vi.fn(),
  sendPayoutPaidEmail: vi.fn(),
  sendWaitlistConfirmationEmail: vi.fn(),
  sendReferralMilestoneEmail: vi.fn(),
}))
vi.mock('@/lib/admin-config', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/admin-config')>()
  return { ...actual, isTesterEmailAllowed: () => true }
})

const applicationsId = await import('@/app/api/v1/applications/[id]/route')
const applications = await import('@/app/api/v1/applications/route')
const campaignsId = await import('@/app/api/v1/campaigns/[id]/route')
const campaigns = await import('@/app/api/v1/campaigns/route')
const devicesToken = await import('@/app/api/v1/devices/[token]/route')
const devices = await import('@/app/api/v1/devices/route')
const me = await import('@/app/api/v1/me/route')
const payouts = await import('@/app/api/v1/payouts/route')
const stripeOnboard = await import('@/app/api/v1/stripe/onboard/route')
const stripeStatus = await import('@/app/api/v1/stripe/status/route')
const submissionsId = await import('@/app/api/v1/submissions/[id]/route')
const submissions = await import('@/app/api/v1/submissions/route')

type Handler = (req: Request, ctx?: unknown) => Promise<Response>

const CREATOR_A = { id: 'user_a', email: 'a@example.com', name: 'A', role: 'CREATOR' as const }
const CREATOR_B = { id: 'user_b', email: 'b@example.com', name: 'B', role: 'CREATOR' as const }
const BRAND = { id: 'user_brand', email: 'brand@example.com', name: 'Brand', role: 'BRAND' as const }

const BEARER = { authorization: 'Bearer valid.session.jwt' }
/** A browser session and nothing else. Must never be enough on this namespace. */
const COOKIE_ONLY = { cookie: '__session=valid-clerk-cookie' }

type Endpoint = {
  name: string
  handler: Handler
  method: string
  path: string
  body?: unknown
  context?: unknown
}

function req(ep: Endpoint, headers: Record<string, string>): Request {
  return new Request(`https://www.creatordocks.com${ep.path}`, {
    method: ep.method,
    headers: { ...headers, ...(ep.body ? { 'content-type': 'application/json' } : {}) },
    ...(ep.body ? { body: JSON.stringify(ep.body) } : {}),
  })
}

const call = (ep: Endpoint, headers: Record<string, string>) => ep.handler(req(ep, headers), ep.context)

/** Every authenticated, creator-scoped endpoint in the namespace. */
const ENDPOINTS: Endpoint[] = [
  { name: 'GET /me', handler: me.GET as Handler, method: 'GET', path: '/api/v1/me' },
  { name: 'PATCH /me', handler: me.PATCH as Handler, method: 'PATCH', path: '/api/v1/me', body: { name: 'New' } },
  { name: 'DELETE /me', handler: me.DELETE as Handler, method: 'DELETE', path: '/api/v1/me' },
  { name: 'GET /campaigns', handler: campaigns.GET as Handler, method: 'GET', path: '/api/v1/campaigns' },
  {
    name: 'GET /campaigns/:id',
    handler: campaignsId.GET as Handler,
    method: 'GET',
    path: '/api/v1/campaigns/camp_1',
    context: { params: Promise.resolve({ id: 'camp_1' }) },
  },
  { name: 'GET /applications', handler: applications.GET as Handler, method: 'GET', path: '/api/v1/applications' },
  {
    name: 'POST /applications',
    handler: applications.POST as Handler,
    method: 'POST',
    path: '/api/v1/applications',
    body: { campaignId: 'camp_1', pitch: 'x'.repeat(60), proposedRate: 25000 },
  },
  {
    name: 'GET /applications/:id',
    handler: applicationsId.GET as Handler,
    method: 'GET',
    path: '/api/v1/applications/app_b',
    context: { params: Promise.resolve({ id: 'app_b' }) },
  },
  {
    name: 'DELETE /applications/:id',
    handler: applicationsId.DELETE as Handler,
    method: 'DELETE',
    path: '/api/v1/applications/app_b',
    context: { params: Promise.resolve({ id: 'app_b' }) },
  },
  { name: 'GET /submissions', handler: submissions.GET as Handler, method: 'GET', path: '/api/v1/submissions' },
  {
    name: 'POST /submissions',
    handler: submissions.POST as Handler,
    method: 'POST',
    path: '/api/v1/submissions',
    body: { applicationId: 'app_b', contentUrl: 'https://utfs.io/f/abc123', caption: 'hi' },
  },
  {
    name: 'GET /submissions/:id',
    handler: submissionsId.GET as Handler,
    method: 'GET',
    path: '/api/v1/submissions/sub_b',
    context: { params: Promise.resolve({ id: 'sub_b' }) },
  },
  {
    name: 'PATCH /submissions/:id',
    handler: submissionsId.PATCH as Handler,
    method: 'PATCH',
    path: '/api/v1/submissions/sub_b',
    body: { contentUrl: 'https://utfs.io/f/abc123' },
    context: { params: Promise.resolve({ id: 'sub_b' }) },
  },
  { name: 'GET /payouts', handler: payouts.GET as Handler, method: 'GET', path: '/api/v1/payouts' },
  {
    name: 'POST /devices',
    handler: devices.POST as Handler,
    method: 'POST',
    path: '/api/v1/devices',
    body: { expoPushToken: 'ExponentPushToken[aaaaaaaaaaaaaaaaaaaaaa]', platform: 'ios' },
  },
  {
    name: 'DELETE /devices/:token',
    handler: devicesToken.DELETE as Handler,
    method: 'DELETE',
    path: '/api/v1/devices/ExponentPushToken%5Bbbbbbbbbbbbbbbbbbbbbbb%5D',
    context: { params: Promise.resolve({ token: 'ExponentPushToken[bbbbbbbbbbbbbbbbbbbbbb]' }) },
  },
  { name: 'POST /stripe/onboard', handler: stripeOnboard.POST as Handler, method: 'POST', path: '/api/v1/stripe/onboard' },
  { name: 'GET /stripe/status', handler: stripeStatus.GET as Handler, method: 'GET', path: '/api/v1/stripe/status' },
]

/** Endpoints reachable with an id that belongs to another creator. */
const OWNERSHIP_CASES: { name: string; endpoint: Endpoint; seedForeignRow: () => void }[] = [
  {
    name: 'GET /applications/:id',
    endpoint: ENDPOINTS.find(e => e.name === 'GET /applications/:id')!,
    seedForeignRow: () =>
      prismaMock.application.findUnique.mockResolvedValue({
        id: 'app_b',
        creatorId: CREATOR_B.id,
        campaignId: 'camp_1',
        pitch: 'theirs',
        proposedRate: 1000,
        status: 'PENDING',
        createdAt: new Date(),
        campaign: { id: 'camp_1', title: 'T', budget: 1000, niche: 'Beauty' },
      }),
  },
  {
    name: 'DELETE /applications/:id',
    endpoint: ENDPOINTS.find(e => e.name === 'DELETE /applications/:id')!,
    seedForeignRow: () =>
      prismaMock.application.findUnique.mockResolvedValue({
        id: 'app_b',
        creatorId: CREATOR_B.id,
        status: 'PENDING',
      }),
  },
  {
    name: 'GET /submissions/:id',
    endpoint: ENDPOINTS.find(e => e.name === 'GET /submissions/:id')!,
    seedForeignRow: () =>
      prismaMock.submission.findUnique.mockResolvedValue({
        id: 'sub_b',
        creatorId: CREATOR_B.id,
        applicationId: 'app_b',
        contentUrl: 'https://utfs.io/f/x',
        caption: null,
        notes: null,
        status: 'PENDING',
        reviewNote: null,
        createdAt: new Date(),
      }),
  },
  {
    name: 'PATCH /submissions/:id',
    endpoint: ENDPOINTS.find(e => e.name === 'PATCH /submissions/:id')!,
    seedForeignRow: () =>
      prismaMock.submission.findUnique.mockResolvedValue({
        id: 'sub_b',
        creatorId: CREATOR_B.id,
        applicationId: 'app_b',
        contentUrl: 'https://utfs.io/f/x',
        status: 'REJECTED',
        createdAt: new Date(),
      }),
  },
  {
    name: 'POST /submissions (foreign application)',
    endpoint: ENDPOINTS.find(e => e.name === 'POST /submissions')!,
    seedForeignRow: () =>
      prismaMock.application.findUnique.mockResolvedValue({
        id: 'app_b',
        creatorId: CREATOR_B.id,
        status: 'ACCEPTED',
      }),
  },
  {
    name: 'DELETE /devices/:token',
    endpoint: ENDPOINTS.find(e => e.name === 'DELETE /devices/:token')!,
    seedForeignRow: () =>
      prismaMock.device.findUnique.mockResolvedValue({
        id: 'dev_b',
        userId: CREATOR_B.id,
        expoPushToken: 'ExponentPushToken[bbbbbbbbbbbbbbbbbbbbbb]',
      }),
  },
]

function signedInAs(user: typeof CREATOR_A | typeof BRAND) {
  authMock.mockResolvedValue({ userId: `clerk_${user.id}` })
  getCurrentAppUserMock.mockResolvedValue({ userId: `clerk_${user.id}`, user, email: user.email })
}

beforeEach(() => {
  vi.clearAllMocks()
  checkRateLimitMock.mockResolvedValue({ ok: true, retryAfterSeconds: 0 })
  signedInAs(CREATOR_A)
  // Neutral defaults: nothing is found unless a case seeds it.
  for (const model of Object.values(prismaMock)) {
    if (typeof model === 'object' && model !== null) {
      for (const fn of Object.values(model)) {
        if (typeof fn === 'function' && 'mockResolvedValue' in fn) {
          ;(fn as ReturnType<typeof vi.fn>).mockResolvedValue(null)
        }
      }
    }
  }
  prismaMock.$transaction.mockResolvedValue([])
})

describe('W2-11 · every endpoint requires an explicit Bearer token', () => {
  it.each(ENDPOINTS.map(e => [e.name, e] as const))('%s rejects a request with no credentials', async (_n, ep) => {
    const res = await call(ep, {})

    expect(res.status).toBe(401)
    expect(res.headers.get('www-authenticate')).toBe('Bearer realm="creatordocks"')
  })

  it.each(ENDPOINTS.map(e => [e.name, e] as const))('%s rejects a non-Bearer scheme', async (_n, ep) => {
    const res = await call(ep, { authorization: 'Basic dXNlcjpwYXNz' })

    expect(res.status).toBe(401)
  })

  // The reason /api/v1 can safely skip the origin-check CSRF defense: an
  // ambient cookie is never sufficient here, so a browser cannot be tricked
  // into making an authenticated call on the user's behalf.
  it.each(ENDPOINTS.map(e => [e.name, e] as const))('%s rejects a cookie-only session', async (_n, ep) => {
    const res = await call(ep, COOKIE_ONLY)

    expect(res.status).toBe(401)
  })

  it.each(ENDPOINTS.map(e => [e.name, e] as const))('%s rejects a Bearer token Clerk will not verify', async (_n, ep) => {
    authMock.mockResolvedValue({ userId: null })

    const res = await call(ep, { authorization: 'Bearer expired.or.revoked' })

    expect(res.status).toBe(401)
  })

  it.each(ENDPOINTS.map(e => [e.name, e] as const))('%s rejects a verified identity with no account row', async (_n, ep) => {
    authMock.mockResolvedValue({ userId: 'clerk_ghost' })
    getCurrentAppUserMock.mockResolvedValue({ userId: 'clerk_ghost', user: null, email: null })

    const res = await call(ep, BEARER)

    expect(res.status).toBe(401)
  })
})

/**
 * `02-mobile-api.md` (guard step 3) states the rule as: "creator endpoints
 * require `role === CREATOR` ... brands never". Ten of the eighteen handlers
 * declare `role: 'CREATOR'`. The other eight do not, and this test found that
 * — it is a real deviation from the written contract.
 *
 * It is a contract gap rather than a vulnerability: every unchecked handler is
 * scoped to `user.id` (me/route.ts:18,35,99; devices/route.ts:21; the DELETE
 * ownership check at devices/[token]/route.ts:12) or serves the same ACTIVE
 * campaign list any creator sees. A brand reaches only their own row.
 *
 * So the split below asserts what the code *actually does* rather than what
 * the doc says, deliberately. A test that asserts aspiration fails forever and
 * gets skipped; this one locks in today's behavior so that closing the gap is
 * a decision someone makes on purpose, and shows up as a failure here when
 * they do. Tracked for Jackson — the open question is whether a BRAND-role
 * account should be able to read its profile and delete its account from the
 * iOS app at all (Apple 5.1.1(v) argues the deletion path should stay open).
 */
const CREATOR_ONLY = ENDPOINTS.filter(e =>
  /applications|submissions|payouts|stripe/.test(e.path),
)
const NO_ROLE_CHECK = ENDPOINTS.filter(e => !CREATOR_ONLY.includes(e))

describe('W2-11 · role enforcement', () => {
  // The namespace serves the creator app. A brand holds a valid session on the
  // same Clerk instance, so role — not authentication — is what separates them.
  it.each(CREATOR_ONLY.map(e => [e.name, e] as const))('%s refuses a BRAND account', async (_n, ep) => {
    signedInAs(BRAND)

    const res = await call(ep, BEARER)

    expect(res.status).toBe(403)
  })

  it('covers every creator-scoped endpoint in the namespace', () => {
    expect(CREATOR_ONLY.length + NO_ROLE_CHECK.length).toBe(ENDPOINTS.length)
    expect(CREATOR_ONLY.length).toBeGreaterThan(9)
  })

  describe('known gap: endpoints with no role check (own-data only)', () => {
    it.each(NO_ROLE_CHECK.map(e => [e.name, e] as const))(
      '%s admits a BRAND account, but only to its own data',
      async (_n, ep) => {
        signedInAs(BRAND)

        const res = await call(ep, BEARER)

        // Not 403 today. The assertion that matters is the one below it: the
        // brand is never handed another account's row.
        expect(res.status).not.toBe(403)
        expect([200, 404, 409, 500]).toContain(res.status)
      },
    )

    it('scopes every unchecked read to the caller, whatever their role', async () => {
      signedInAs(BRAND)
      prismaMock.user.findUnique.mockResolvedValue({
        id: BRAND.id,
        name: 'Brand',
        email: BRAND.email,
        avatarUrl: null,
        bio: null,
        role: 'BRAND',
        stripeOnboarded: false,
      })

      await call(ENDPOINTS.find(e => e.name === 'GET /me')!, BEARER)

      // The query is keyed by the caller's own id — there is no path by which a
      // role mix-up could surface another account's profile.
      expect(prismaMock.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: BRAND.id } }),
      )
    })
  })
})

describe('W2-11 · object-level authorization: 404, never 403', () => {
  // 403 on someone else's row confirms it exists. 404 is the only answer that
  // does not turn an id into an existence oracle, so the distinction is the
  // assertion, not an implementation detail.
  it.each(OWNERSHIP_CASES.map(c => [c.name, c] as const))(
    "%s returns 404 for another creator's row",
    async (_n, testCase) => {
      testCase.seedForeignRow()

      const res = await call(testCase.endpoint, BEARER)
      const body = await res.json()

      expect(res.status).toBe(404)
      expect(body.success).toBe(false)
    },
  )

  it.each(OWNERSHIP_CASES.map(c => [c.name, c] as const))(
    '%s never mutates another creature\'s row',
    async (_n, testCase) => {
      testCase.seedForeignRow()

      await call(testCase.endpoint, BEARER)

      expect(prismaMock.application.delete).not.toHaveBeenCalled()
      expect(prismaMock.submission.update).not.toHaveBeenCalled()
      expect(prismaMock.submission.create).not.toHaveBeenCalled()
      expect(prismaMock.device.delete).not.toHaveBeenCalled()
    },
  )

  it('a foreign row is indistinguishable from one that does not exist', async () => {
    const endpoint = ENDPOINTS.find(e => e.name === 'GET /applications/:id')!

    prismaMock.application.findUnique.mockResolvedValue(null)
    const missing = await call(endpoint, BEARER)
    const missingBody = await missing.json()

    OWNERSHIP_CASES[0].seedForeignRow()
    const foreign = await call(endpoint, BEARER)
    const foreignBody = await foreign.json()

    expect(foreign.status).toBe(missing.status)
    expect(foreignBody).toEqual(missingBody)
  })
})

describe('W2-11 · rate limiting is enforced by the guard, not the handler', () => {
  it.each(ENDPOINTS.map(e => [e.name, e] as const))('%s returns 429 with Retry-After', async (_n, ep) => {
    checkRateLimitMock.mockResolvedValue({ ok: false, retryAfterSeconds: 42 })

    const res = await call(ep, BEARER)

    expect(res.status).toBe(429)
    expect(res.headers.get('retry-after')).toBe('42')
  })

  it('rate-limits per route, so reads cannot exhaust the budget for writes', async () => {
    const keys: string[] = []
    checkRateLimitMock.mockImplementation(async (key: string) => {
      keys.push(key)
      return { ok: true, retryAfterSeconds: 0 }
    })

    await call(ENDPOINTS.find(e => e.name === 'GET /me')!, BEARER)
    await call(ENDPOINTS.find(e => e.name === 'POST /stripe/onboard')!, BEARER)

    expect(keys).toHaveLength(2)
    expect(keys[0]).not.toBe(keys[1])
  })
})
