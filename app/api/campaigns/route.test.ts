import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Brand-facing web route: the marketplace feed (GET) and campaign creation (POST).
 *
 * Harness mirrors app/api/stripe/onboard/route.test.ts — the other web (non-/api/v1)
 * route test — so the guard seams are mocked the same way everywhere: `vi.hoisted`
 * fns, module mocks, then a dynamic `await import('./route')` once the mocks exist.
 */

const {
  authMock,
  requireTesterApiUserMock,
  userFindUniqueMock,
  campaignFindManyMock,
  campaignCreateMock,
  checkRateLimitMock,
  getRequestIpMock,
  isTrustedOriginMock,
} = vi.hoisted(() => ({
  authMock: vi.fn(),
  requireTesterApiUserMock: vi.fn(),
  userFindUniqueMock: vi.fn(),
  campaignFindManyMock: vi.fn(),
  campaignCreateMock: vi.fn(),
  checkRateLimitMock: vi.fn(),
  getRequestIpMock: vi.fn(),
  isTrustedOriginMock: vi.fn(),
}))

vi.mock('@clerk/nextjs/server', () => ({ auth: authMock }))

vi.mock('@/lib/admin-api-guard', () => ({ requireTesterApiUser: requireTesterApiUserMock }))

vi.mock('@/lib/prisma', () => ({
  default: {
    user: { findUnique: userFindUniqueMock },
    campaign: { findMany: campaignFindManyMock, create: campaignCreateMock },
  },
}))

vi.mock('@/lib/request-security', () => ({
  checkRateLimit: checkRateLimitMock,
  getRequestIp: getRequestIpMock,
  isTrustedOrigin: isTrustedOriginMock,
}))

const { GET, POST } = await import('./route')

/** Pinned clock so "past" / "future" deadlines are exact, assertable values. */
const NOW = new Date('2026-09-08T12:00:00.000Z')
const FUTURE = '2026-12-01T00:00:00.000Z'
const PAST = '2026-01-01T00:00:00.000Z'

const BRAND = {
  id: 'user_brand_1',
  clerkId: 'clerk_brand_1',
  email: 'brand@example.com',
  role: 'BRAND',
  name: 'Acme Co',
  avatarUrl: null,
  stripeAccountId: null,
}

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    title: 'Summer glow-up campaign',
    description: 'A full brief with more than twenty characters of detail.',
    budget: 500_000,
    deadline: FUTURE,
    niche: 'beauty',
    platforms: ['instagram'],
    ...overrides,
  }
}

function getReq(query = '') {
  return new Request(`https://creatordocks.com/api/campaigns${query}`)
}

function postReq(body: unknown) {
  return new Request('https://creatordocks.com/api/campaigns', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function unauthorized() {
  return { user: null, response: Response.json({ error: 'Unauthorized' }, { status: 401 }) }
}

function forbidden() {
  return { user: null, response: Response.json({ error: 'Forbidden' }, { status: 403 }) }
}

beforeEach(() => {
  authMock.mockReset()
  requireTesterApiUserMock.mockReset()
  userFindUniqueMock.mockReset()
  campaignFindManyMock.mockReset()
  campaignCreateMock.mockReset()
  checkRateLimitMock.mockReset()
  getRequestIpMock.mockReset()
  isTrustedOriginMock.mockReset()

  isTrustedOriginMock.mockReturnValue(true)
  requireTesterApiUserMock.mockResolvedValue({ user: null, response: null })
  authMock.mockResolvedValue({ userId: BRAND.clerkId })
  userFindUniqueMock.mockResolvedValue(BRAND)
  campaignFindManyMock.mockResolvedValue([])
  campaignCreateMock.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
    id: 'camp_new',
    createdAt: NOW,
    updatedAt: NOW,
    ...data,
  }))
  checkRateLimitMock.mockResolvedValue({ ok: true })
  getRequestIpMock.mockReturnValue('203.0.113.9')

  vi.useFakeTimers()
  vi.setSystemTime(NOW)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('GET /api/campaigns — access control', () => {
  it('returns 401 when the tester gate rejects an unauthenticated caller', async () => {
    requireTesterApiUserMock.mockResolvedValue(unauthorized())

    const res = await GET(getReq())

    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'Unauthorized' })
    expect(campaignFindManyMock).not.toHaveBeenCalled()
  })

  it('returns 403 when the caller is signed in but not on the tester allowlist', async () => {
    requireTesterApiUserMock.mockResolvedValue(forbidden())

    const res = await GET(getReq())

    expect(res.status).toBe(403)
    expect(campaignFindManyMock).not.toHaveBeenCalled()
  })

  it('returns 401 when the tester gate passes but Clerk has no session user', async () => {
    authMock.mockResolvedValue({ userId: null })

    const res = await GET(getReq())

    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'Unauthorized' })
    expect(campaignFindManyMock).not.toHaveBeenCalled()
  })
})

describe('GET /api/campaigns — feed shape', () => {
  it('returns only ACTIVE campaigns', async () => {
    const res = await GET(getReq())

    expect(res.status).toBe(200)
    expect(campaignFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'ACTIVE' }),
        orderBy: { createdAt: 'desc' },
      }),
    )
  })

  it('passes niche and platform filters through to the query', async () => {
    await GET(getReq('?niche=beauty&platform=tiktok'))

    const { where } = campaignFindManyMock.mock.calls[0][0]
    expect(where).toEqual({
      status: 'ACTIVE',
      niche: 'beauty',
      platforms: { has: 'tiktok' },
    })
  })

  it('omits absent filters entirely rather than querying for null', async () => {
    await GET(getReq())

    // Exact match, so an added `niche: null` / `platforms: null` key fails here.
    const { where } = campaignFindManyMock.mock.calls[0][0]
    expect(where).toEqual({ status: 'ACTIVE' })
  })

  it('exposes only the brand name and avatar — no nested User PII', async () => {
    await GET(getReq())

    // Exact match: any added PII column (email, clerkId, stripeAccountId, ...)
    // fails this assertion, so an explicit per-field loop would be dead weight.
    const { include } = campaignFindManyMock.mock.calls[0][0]
    expect(include.brand.select).toEqual({ name: true, avatarUrl: true })
  })

  // NOTE: there is deliberately no assertion about `isTrustedOrigin` on GET.
  // A test pinning it as *not called* would turn adding origin pinning to the
  // read into a suite failure, i.e. it would punish someone for adding a
  // security control. The absence of that control is left unasserted.

  it('returns a generic 500 without leaking the database error', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    campaignFindManyMock.mockRejectedValue(new Error('connection to db-prod-1.internal refused'))

    const res = await GET(getReq())
    const body = await res.json()

    expect(res.status).toBe(500)
    // Exact match: a leaked driver message would have to appear as a different
    // value or an extra key, either of which fails here.
    expect(body).toEqual({ error: 'Internal server error' })
    consoleErrorSpy.mockRestore()
  })
})

describe('POST /api/campaigns — access control', () => {
  it('returns 403 for an untrusted origin before touching auth or the database', async () => {
    isTrustedOriginMock.mockReturnValue(false)

    const res = await POST(postReq(validBody()))

    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'Invalid request origin' })
    expect(requireTesterApiUserMock).not.toHaveBeenCalled()
    expect(userFindUniqueMock).not.toHaveBeenCalled()
    expect(campaignCreateMock).not.toHaveBeenCalled()
  })

  it('returns 401 when the tester gate rejects an unauthenticated caller', async () => {
    requireTesterApiUserMock.mockResolvedValue(unauthorized())

    const res = await POST(postReq(validBody()))

    expect(res.status).toBe(401)
    expect(campaignCreateMock).not.toHaveBeenCalled()
  })

  it('returns 403 when the caller is not on the tester allowlist', async () => {
    requireTesterApiUserMock.mockResolvedValue(forbidden())

    const res = await POST(postReq(validBody()))

    expect(res.status).toBe(403)
    expect(campaignCreateMock).not.toHaveBeenCalled()
  })

  it('returns 401 when Clerk has no session user', async () => {
    authMock.mockResolvedValue({ userId: null })

    const res = await POST(postReq(validBody()))

    expect(res.status).toBe(401)
    expect(campaignCreateMock).not.toHaveBeenCalled()
  })

  it('returns 404 when the Clerk session has no app user row', async () => {
    userFindUniqueMock.mockResolvedValue(null)

    const res = await POST(postReq(validBody()))

    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'User not found' })
    expect(campaignCreateMock).not.toHaveBeenCalled()
  })

  it.each([['CREATOR'], ['ADMIN']])('returns 403 for role %s — brands only', async role => {
    userFindUniqueMock.mockResolvedValue({ ...BRAND, role })

    const res = await POST(postReq(validBody()))

    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'Only brands can create campaigns' })
    expect(campaignCreateMock).not.toHaveBeenCalled()
  })

  it('returns 429 with Retry-After when the rate limit is exhausted', async () => {
    checkRateLimitMock.mockResolvedValue({ ok: false, retryAfterSeconds: 42 })

    const res = await POST(postReq(validBody()))

    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBe('42')
    expect(campaignCreateMock).not.toHaveBeenCalled()
  })

  it('scopes the rate-limit key to the app user id and the request IP', async () => {
    await POST(postReq(validBody()))

    expect(checkRateLimitMock).toHaveBeenCalledWith(
      `campaigns:create:${BRAND.id}:203.0.113.9`,
      { limit: 10, windowMs: 60_000 },
    )
  })

  // The limiter has to run before the body is read, or an attacker can burn
  // request budget with unparseable payloads that never reach the counter.
  it('rate-limits before parsing the body', async () => {
    checkRateLimitMock.mockResolvedValue({ ok: false, retryAfterSeconds: 5 })

    const res = await POST(
      new Request('https://creatordocks.com/api/campaigns', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: 'not json at all',
      }),
    )

    expect(res.status).toBe(429)
  })
})

describe('POST /api/campaigns — budget validation', () => {
  it.each([
    ['a float', 500.5],
    ['a numeric string', '5000'],
    // JSON.stringify renders both of these as null, so the handler receives
    // null, not a real NaN/Infinity. Labelled for what actually crosses the
    // wire rather than implying coverage the transport cannot deliver.
    ['NaN, which serializes to null', Number.NaN],
    ['Infinity, which serializes to null', Number.POSITIVE_INFINITY],
    ['a negative amount', -5000],
    ['zero', 0],
    ['below the 500-cent floor', 499],
    ['null', null],
    ['a boolean', true],
    ['an object', { amount: 5000 }],
  ])('rejects %s as a budget', async (_label, budget) => {
    const res = await POST(postReq(validBody({ budget })))

    expect(res.status).toBe(400)
    expect(campaignCreateMock).not.toHaveBeenCalled()
  })

  it('rejects a missing budget', async () => {
    const body = validBody()
    delete (body as Record<string, unknown>).budget

    const res = await POST(postReq(body))

    expect(res.status).toBe(400)
    expect(campaignCreateMock).not.toHaveBeenCalled()
  })

  it('accepts the exact 500-cent floor', async () => {
    const res = await POST(postReq(validBody({ budget: 500 })))

    expect(res.status).toBe(201)
    expect(campaignCreateMock.mock.calls[0][0].data.budget).toBe(500)
  })

  /**
   * KNOWN DEFECT (reported, not fixed here — this agent does not own
   * app/api/campaigns/route.ts). The schema has no upper bound, but
   * Campaign.budget is a Postgres `Int` (signed 32-bit). Anything past
   * 2_147_483_647 is accepted here and then blows up in the driver, surfacing
   * as a 500 instead of a 400. The shared creator-side schema already caps its
   * money field (packages/shared/src/application.ts: proposedRate max
   * 10_000_000); this one does not.
   *
   * This documents shipped behaviour, it does not endorse it. When a `.max()`
   * is added this test SHOULD fail — replace it with a 400 assertion then.
   */
  it('KNOWN DEFECT: accepts a budget far beyond a 32-bit Postgres Int (no max bound)', async () => {
    const res = await POST(postReq(validBody({ budget: Number.MAX_SAFE_INTEGER })))

    expect(res.status).toBe(201)
    expect(campaignCreateMock.mock.calls[0][0].data.budget).toBe(Number.MAX_SAFE_INTEGER)
  })
})

describe('POST /api/campaigns — deadline validation', () => {
  it.each([
    ['a bare date with no time', '2026-12-01'],
    ['free text', 'next tuesday'],
    ['an empty string', ''],
    ['a unix timestamp number', 1_800_000_000],
    ['null', null],
    ['a nonsense datetime', '2026-13-45T99:99:99.000Z'],
  ])('rejects %s as a deadline', async (_label, deadline) => {
    const res = await POST(postReq(validBody({ deadline })))

    expect(res.status).toBe(400)
    expect(campaignCreateMock).not.toHaveBeenCalled()
  })

  it('rejects a deadline in the past', async () => {
    const res = await POST(postReq(validBody({ deadline: PAST })))

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Deadline must be in the future' })
    expect(campaignCreateMock).not.toHaveBeenCalled()
  })

  it('rejects a deadline exactly at "now" — the boundary is exclusive', async () => {
    const res = await POST(postReq(validBody({ deadline: NOW.toISOString() })))

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Deadline must be in the future' })
    expect(campaignCreateMock).not.toHaveBeenCalled()
  })

  it('accepts a deadline one second in the future and stores it as a Date', async () => {
    const justAhead = new Date(NOW.getTime() + 1000).toISOString()

    const res = await POST(postReq(validBody({ deadline: justAhead })))

    expect(res.status).toBe(201)
    const { data } = campaignCreateMock.mock.calls[0][0]
    expect(data.deadline).toBeInstanceOf(Date)
    expect(data.deadline.toISOString()).toBe(justAhead)
  })
})

describe('POST /api/campaigns — text and list bounds', () => {
  it.each([
    ['title', 'four'],
    ['title', 'x'.repeat(101)],
    ['description', 'too short'],
    ['description', 'x'.repeat(2001)],
    ['objective', 'x'.repeat(241)],
    ['deliverables', 'x'.repeat(1201)],
    ['targetAudience', 'x'.repeat(241)],
    ['creatorRequirements', 'x'.repeat(1201)],
    ['callToAction', 'x'.repeat(241)],
    ['usageRights', 'x'.repeat(241)],
  ])('rejects an out-of-bounds %s', async (field, value) => {
    const res = await POST(postReq(validBody({ [field]: value })))

    expect(res.status).toBe(400)
    expect(campaignCreateMock).not.toHaveBeenCalled()
  })

  it('accepts title and description exactly at their length limits', async () => {
    const res = await POST(
      postReq(validBody({ title: 'x'.repeat(100), description: 'x'.repeat(2000) })),
    )

    expect(res.status).toBe(201)
  })

  it.each([
    ['an empty platforms array', { platforms: [] }],
    ['a non-array platforms value', { platforms: 'instagram' }],
    ['an empty niche', { niche: '' }],
    ['a missing niche', { niche: undefined }],
    ['creatorsNeeded of zero', { creatorsNeeded: 0 }],
    ['creatorsNeeded above 100', { creatorsNeeded: 101 }],
    ['a fractional creatorsNeeded', { creatorsNeeded: 2.5 }],
  ])('rejects %s', async (_label, overrides) => {
    const res = await POST(postReq(validBody(overrides)))

    expect(res.status).toBe(400)
    expect(campaignCreateMock).not.toHaveBeenCalled()
  })

  /**
   * KNOWN DEFECT (reported, not fixed here — this agent does not own
   * app/api/campaigns/route.ts). `req.json()` is called with no guard, so a
   * malformed body throws into the catch-all: the caller gets a 500 for what
   * is squarely a client error, and the failure is logged as a server fault.
   *
   * When a JSON guard is added this test SHOULD fail — flip it to expect 400.
   */
  it('KNOWN DEFECT: a body that is not valid JSON 500s instead of 400', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const res = await POST(
      new Request('https://creatordocks.com/api/campaigns', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{ not json',
      }),
    )

    expect(res.status).toBe(500)
    expect(campaignCreateMock).not.toHaveBeenCalled()
    consoleErrorSpy.mockRestore()
  })
})

describe('POST /api/campaigns — persistence', () => {
  it('creates the campaign owned by the calling brand and returns 201', async () => {
    const res = await POST(postReq(validBody()))
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.success).toBe(true)
    const { data } = campaignCreateMock.mock.calls[0][0]
    expect(data.brandId).toBe(BRAND.id)
    expect(data.status).toBe('ACTIVE')
    expect(data.title).toBe('Summer glow-up campaign')
  })

  it('looks the app user up by the Clerk id from the session, not from the body', async () => {
    await POST(postReq(validBody({ clerkId: 'clerk_someone_else' })))

    expect(userFindUniqueMock).toHaveBeenCalledWith({ where: { clerkId: BRAND.clerkId } })
  })

  // Mass-assignment guard: zod strips unknown keys, so an attacker-supplied
  // brandId/status/id must not survive into the create.
  it('ignores brandId, status and id supplied in the request body', async () => {
    const res = await POST(
      postReq(
        validBody({
          brandId: 'user_victim_brand',
          status: 'COMPLETE',
          id: 'camp_attacker_chosen',
          createdAt: '2020-01-01T00:00:00.000Z',
        }),
      ),
    )

    expect(res.status).toBe(201)
    const { data } = campaignCreateMock.mock.calls[0][0]
    expect(data.brandId).toBe(BRAND.id)
    expect(data.status).toBe('ACTIVE')
    expect(data).not.toHaveProperty('id')
    expect(data).not.toHaveProperty('createdAt')
  })

  it('normalizes blank optional strings to null rather than storing empty strings', async () => {
    await POST(
      postReq(
        validBody({
          objective: '',
          deliverables: '',
          targetAudience: '',
          creatorRequirements: '',
          callToAction: '',
          usageRights: '',
        }),
      ),
    )

    const { data } = campaignCreateMock.mock.calls[0][0]
    expect(data.objective).toBeNull()
    expect(data.deliverables).toBeNull()
    expect(data.targetAudience).toBeNull()
    expect(data.creatorRequirements).toBeNull()
    expect(data.callToAction).toBeNull()
    expect(data.usageRights).toBeNull()
  })

  it('stores an omitted creatorsNeeded as null', async () => {
    await POST(postReq(validBody()))

    expect(campaignCreateMock.mock.calls[0][0].data.creatorsNeeded).toBeNull()
  })

  it('returns a generic 500 without leaking the database error on write failure', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    campaignCreateMock.mockRejectedValue(new Error('unique constraint camp_pkey on db-prod-1'))

    const res = await POST(postReq(validBody()))
    const body = await res.json()

    expect(res.status).toBe(500)
    // Exact match: a leaked constraint/host detail cannot survive this.
    expect(body).toEqual({ error: 'Internal server error' })
    consoleErrorSpy.mockRestore()
  })
})
