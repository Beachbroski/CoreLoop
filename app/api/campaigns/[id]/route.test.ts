import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Brand-facing web route: single-campaign read (GET) and update (PATCH).
 *
 * Harness mirrors app/api/stripe/onboard/route.test.ts — the other web
 * (non-/api/v1) route test — so the guard seams are mocked identically:
 * `vi.hoisted` fns, module mocks, then a dynamic `await import('./route')`.
 */

const {
  authMock,
  requireTesterApiUserMock,
  userFindUniqueMock,
  campaignFindUniqueMock,
  campaignUpdateMock,
  applicationFindManyMock,
  checkRateLimitMock,
  getRequestIpMock,
  isTrustedOriginMock,
  cancelPaymentIntentIfCancelableMock,
} = vi.hoisted(() => ({
  authMock: vi.fn(),
  requireTesterApiUserMock: vi.fn(),
  userFindUniqueMock: vi.fn(),
  campaignFindUniqueMock: vi.fn(),
  campaignUpdateMock: vi.fn(),
  applicationFindManyMock: vi.fn(),
  checkRateLimitMock: vi.fn(),
  getRequestIpMock: vi.fn(),
  isTrustedOriginMock: vi.fn(),
  cancelPaymentIntentIfCancelableMock: vi.fn(),
}))

vi.mock('@clerk/nextjs/server', () => ({ auth: authMock }))

vi.mock('@/lib/admin-api-guard', () => ({ requireTesterApiUser: requireTesterApiUserMock }))

vi.mock('@/lib/prisma', () => ({
  default: {
    user: { findUnique: userFindUniqueMock },
    campaign: { findUnique: campaignFindUniqueMock, update: campaignUpdateMock },
    application: { findMany: applicationFindManyMock },
  },
}))

vi.mock('@/lib/request-security', () => ({
  checkRateLimit: checkRateLimitMock,
  getRequestIp: getRequestIpMock,
  isTrustedOrigin: isTrustedOriginMock,
}))

vi.mock('@/lib/stripe-payments', () => ({
  cancelPaymentIntentIfCancelable: cancelPaymentIntentIfCancelableMock,
}))

const { GET, PATCH } = await import('./route')

const NOW = new Date('2026-09-08T12:00:00.000Z')
const FUTURE = '2026-12-01T00:00:00.000Z'
const PAST = '2026-01-01T00:00:00.000Z'

const OWNER_BRAND = {
  id: 'user_brand_owner',
  clerkId: 'clerk_brand_owner',
  email: 'owner@example.com',
  role: 'BRAND',
  name: 'Acme Co',
}

const OTHER_BRAND = {
  id: 'user_brand_rival',
  clerkId: 'clerk_brand_rival',
  email: 'rival@example.com',
  role: 'BRAND',
  name: 'Rival Inc',
}

const CREATOR = {
  id: 'user_creator_1',
  clerkId: 'clerk_creator_1',
  email: 'creator@example.com',
  role: 'CREATOR',
  name: 'Casey',
}

function campaignRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'camp_1',
    brandId: OWNER_BRAND.id,
    title: 'Summer glow-up campaign',
    description: 'A full brief with more than twenty characters of detail.',
    objective: null,
    deliverables: null,
    targetAudience: null,
    creatorRequirements: null,
    callToAction: null,
    usageRights: null,
    creatorsNeeded: 3,
    budget: 500_000,
    deadline: new Date(FUTURE),
    niche: 'beauty',
    platforms: ['instagram'],
    status: 'ACTIVE',
    createdAt: NOW,
    updatedAt: NOW,
    brand: { name: 'Acme Co', avatarUrl: null },
    applications: [],
    ...overrides,
  }
}

function ctx(id = 'camp_1') {
  return { params: Promise.resolve({ id }) }
}

function getReq(id = 'camp_1') {
  return new Request(`https://creatordocks.com/api/campaigns/${id}`)
}

function patchReq(body: unknown, id = 'camp_1') {
  return new Request(`https://creatordocks.com/api/campaigns/${id}`, {
    method: 'PATCH',
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
  campaignFindUniqueMock.mockReset()
  campaignUpdateMock.mockReset()
  applicationFindManyMock.mockReset()
  checkRateLimitMock.mockReset()
  getRequestIpMock.mockReset()
  isTrustedOriginMock.mockReset()
  cancelPaymentIntentIfCancelableMock.mockReset()

  isTrustedOriginMock.mockReturnValue(true)
  requireTesterApiUserMock.mockResolvedValue({ user: null, response: null })
  authMock.mockResolvedValue({ userId: OWNER_BRAND.clerkId })
  userFindUniqueMock.mockResolvedValue(OWNER_BRAND)
  campaignFindUniqueMock.mockResolvedValue(campaignRow())
  campaignUpdateMock.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
    ...campaignRow(),
    ...data,
  }))
  applicationFindManyMock.mockResolvedValue([])
  checkRateLimitMock.mockResolvedValue({ ok: true })
  getRequestIpMock.mockReturnValue('203.0.113.9')
  cancelPaymentIntentIfCancelableMock.mockResolvedValue(undefined)

  vi.useFakeTimers()
  vi.setSystemTime(NOW)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('GET /api/campaigns/[id] — access control', () => {
  it('returns 401 when the tester gate rejects an unauthenticated caller', async () => {
    requireTesterApiUserMock.mockResolvedValue(unauthorized())

    const res = await GET(getReq(), ctx())

    expect(res.status).toBe(401)
    expect(campaignFindUniqueMock).not.toHaveBeenCalled()
  })

  it('returns 403 when the caller is not on the tester allowlist', async () => {
    requireTesterApiUserMock.mockResolvedValue(forbidden())

    const res = await GET(getReq(), ctx())

    expect(res.status).toBe(403)
    expect(campaignFindUniqueMock).not.toHaveBeenCalled()
  })

  it('returns 401 when Clerk has no session user', async () => {
    authMock.mockResolvedValue({ userId: null })

    const res = await GET(getReq(), ctx())

    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'Unauthorized' })
    expect(campaignFindUniqueMock).not.toHaveBeenCalled()
  })

  it('returns 404 when the Clerk session has no app user row', async () => {
    userFindUniqueMock.mockResolvedValue(null)

    const res = await GET(getReq(), ctx())

    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'User not found' })
    expect(campaignFindUniqueMock).not.toHaveBeenCalled()
  })

  it('reads the role with a narrow select, not the whole user row', async () => {
    await GET(getReq(), ctx())

    expect(userFindUniqueMock).toHaveBeenCalledWith({
      where: { clerkId: OWNER_BRAND.clerkId },
      select: { id: true, role: true },
    })
  })
})

describe('GET /api/campaigns/[id] — brand owner scoping', () => {
  it('returns the campaign with its applications to the owning brand', async () => {
    const res = await GET(getReq(), ctx())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data.id).toBe('camp_1')
    expect(campaignFindUniqueMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'camp_1' } }),
    )
  })

  it('does not return another brand\'s campaign body', async () => {
    userFindUniqueMock.mockResolvedValue(OTHER_BRAND)
    campaignFindUniqueMock.mockResolvedValue(campaignRow({ brandId: OWNER_BRAND.id }))

    const res = await GET(getReq(), ctx())
    const body = await res.json()

    expect(res.status).not.toBe(200)
    expect(body).not.toHaveProperty('data')
    expect(JSON.stringify(body)).not.toContain('Summer glow-up campaign')
    expect(JSON.stringify(body)).not.toContain('500000')
  })

  /**
   * KNOWN DEFECT (MEDIUM, reported — not fixed here, this agent does not own
   * app/api/campaigns/[id]/route.ts): enumeration oracle.
   *
   * The handler fetches the campaign first, 404s when it is missing, then 403s
   * when `brandId !== user.id`. So the two statuses are distinguishable: a rival
   * brand walking ids learns *which ids exist* (403) versus which do not (404),
   * without ever being authorized to see one. Owner-scoped reads should return
   * the same 404 in both cases (or scope the query with
   * `findFirst({ where: { id, brandId: user.id } })`, which is what
   * app/api/v1/campaigns/[id] already does).
   *
   * The two tests below record what ships today; they do NOT endorse it. The
   * control that actually matters — a rival never receives the campaign body —
   * is asserted separately above and survives either status code. When the
   * oracle is closed these two SHOULD fail: update them to expect 404/404.
   */
  it('KNOWN DEFECT: another brand gets 403, not 404, which confirms the id exists', async () => {
    userFindUniqueMock.mockResolvedValue(OTHER_BRAND)
    campaignFindUniqueMock.mockResolvedValue(campaignRow({ brandId: OWNER_BRAND.id }))

    const res = await GET(getReq(), ctx())

    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'Forbidden' })
  })

  it('returns 404 for a campaign id that does not exist', async () => {
    userFindUniqueMock.mockResolvedValue(OTHER_BRAND)
    campaignFindUniqueMock.mockResolvedValue(null)

    const res = await GET(getReq('camp_missing'), ctx('camp_missing'))

    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'Campaign not found' })
  })

  it('KNOWN DEFECT: 403 for a real id vs 404 for a fake one lets a rival enumerate ids', async () => {
    userFindUniqueMock.mockResolvedValue(OTHER_BRAND)

    campaignFindUniqueMock.mockResolvedValue(campaignRow({ brandId: OWNER_BRAND.id }))
    const existing = await GET(getReq(), ctx())

    campaignFindUniqueMock.mockResolvedValue(null)
    const missing = await GET(getReq('camp_nope'), ctx('camp_nope'))

    // Documented gap, not an endorsement: these should be indistinguishable.
    // (The third assertion of the original test could never fail on its own
    // once the two above passed, so it is gone.)
    expect(existing.status).toBe(403)
    expect(missing.status).toBe(404)
  })
})

describe('GET /api/campaigns/[id] — PII in nested relations', () => {
  it('exposes only name and avatarUrl for the brand', async () => {
    await GET(getReq(), ctx())

    const { include } = campaignFindUniqueMock.mock.calls[0][0]
    expect(include.brand.select).toEqual({ name: true, avatarUrl: true })
  })

  it('exposes only name and avatarUrl for each applying creator', async () => {
    await GET(getReq(), ctx())

    // Exact match: any added creator column fails here, so a per-field loop
    // afterwards could never fail on its own.
    const { include } = campaignFindUniqueMock.mock.calls[0][0]
    expect(include.applications.include.creator.select).toEqual({ name: true, avatarUrl: true })
  })

  it('never selects creator email or Stripe identifiers anywhere in the query', async () => {
    await GET(getReq(), ctx())

    const serialized = JSON.stringify(campaignFindUniqueMock.mock.calls[0][0])
    expect(serialized).not.toContain('email')
    expect(serialized).not.toContain('clerkId')
    expect(serialized).not.toContain('stripeAccountId')
  })

  /**
   * KNOWN DEFECT (LOW, reported — not fixed here). The brand branch uses
   * `include` on `applications`, which pulls every Application scalar,
   * `paymentIntentId` among them. That is the brand's own Stripe payment intent
   * rather than someone else's data, but it is an internal payments identifier
   * reaching the browser for no UI reason. The creator branch next door already
   * uses an explicit `select`.
   *
   * Recorded, not endorsed: when the branch is narrowed to an explicit `select`
   * this test SHOULD fail — replace it with the select-shape assertion then.
   */
  it('KNOWN DEFECT: the brand branch pulls every Application scalar, paymentIntentId included', async () => {
    await GET(getReq(), ctx())

    const { include } = campaignFindUniqueMock.mock.calls[0][0]
    expect(include.applications).not.toHaveProperty('select')
    expect(include.applications).toHaveProperty('include')
  })
})

describe('GET /api/campaigns/[id] — creator branch', () => {
  beforeEach(() => {
    userFindUniqueMock.mockResolvedValue(CREATOR)
  })

  it('returns an ACTIVE campaign with a null myApplication', async () => {
    campaignFindUniqueMock.mockResolvedValue(campaignRow({ status: 'ACTIVE', applications: [] }))

    const res = await GET(getReq(), ctx())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.myApplication).toBeNull()
  })

  it('scopes the applications relation to the calling creator only', async () => {
    await GET(getReq(), ctx())

    const { include } = campaignFindUniqueMock.mock.calls[0][0]
    expect(include.applications.where).toEqual({ creatorId: CREATOR.id })
    expect(include.applications.select).toEqual({
      id: true,
      status: true,
      proposedRate: true,
      createdAt: true,
    })
  })

  it('never returns the raw applications array — only the caller\'s own', async () => {
    campaignFindUniqueMock.mockResolvedValue(
      campaignRow({
        status: 'ACTIVE',
        applications: [{ id: 'app_1', status: 'PENDING', proposedRate: 25_000, createdAt: NOW }],
      }),
    )

    const res = await GET(getReq(), ctx())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data).not.toHaveProperty('applications')
    expect(body.data.myApplication.id).toBe('app_1')
  })

  it.each([['DRAFT'], ['CANCELLED'], ['COMPLETE'], ['IN_PROGRESS']])(
    'refuses a %s campaign the creator never applied to',
    async status => {
      campaignFindUniqueMock.mockResolvedValue(campaignRow({ status, applications: [] }))

      const res = await GET(getReq(), ctx())
      const body = await res.json()

      // Exact match: the campaign body cannot hide inside a two-key error object.
      expect(res.status).toBe(403)
      expect(body).toEqual({ error: 'Forbidden' })
    },
  )

  it('still shows a non-ACTIVE campaign the creator has an application on', async () => {
    campaignFindUniqueMock.mockResolvedValue(
      campaignRow({
        status: 'IN_PROGRESS',
        applications: [{ id: 'app_1', status: 'ACCEPTED', proposedRate: 25_000, createdAt: NOW }],
      }),
    )

    const res = await GET(getReq(), ctx())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.myApplication.status).toBe('ACCEPTED')
  })

  it('returns 404 for a campaign that does not exist', async () => {
    campaignFindUniqueMock.mockResolvedValue(null)

    const res = await GET(getReq('camp_missing'), ctx('camp_missing'))

    expect(res.status).toBe(404)
  })

  it('returns a generic 500 without leaking the database error', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    campaignFindUniqueMock.mockRejectedValue(new Error('relation "Campaign" does not exist on db-prod-1'))

    const res = await GET(getReq(), ctx())
    const body = await res.json()

    expect(res.status).toBe(500)
    // Exact match: a leaked driver message cannot survive this.
    expect(body).toEqual({ error: 'Internal server error' })
    consoleErrorSpy.mockRestore()
  })
})

describe('PATCH /api/campaigns/[id] — access control', () => {
  it('returns 403 for an untrusted origin before touching auth or the database', async () => {
    isTrustedOriginMock.mockReturnValue(false)

    const res = await PATCH(patchReq({ title: 'Renamed campaign' }), ctx())

    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'Invalid request origin' })
    expect(requireTesterApiUserMock).not.toHaveBeenCalled()
    expect(campaignUpdateMock).not.toHaveBeenCalled()
  })

  it('returns 401 when the tester gate rejects an unauthenticated caller', async () => {
    requireTesterApiUserMock.mockResolvedValue(unauthorized())

    const res = await PATCH(patchReq({ title: 'Renamed campaign' }), ctx())

    expect(res.status).toBe(401)
    expect(campaignUpdateMock).not.toHaveBeenCalled()
  })

  it('returns 403 when the caller is not on the tester allowlist', async () => {
    requireTesterApiUserMock.mockResolvedValue(forbidden())

    const res = await PATCH(patchReq({ title: 'Renamed campaign' }), ctx())

    expect(res.status).toBe(403)
    expect(campaignUpdateMock).not.toHaveBeenCalled()
  })

  it('returns 401 when Clerk has no session user', async () => {
    authMock.mockResolvedValue({ userId: null })

    const res = await PATCH(patchReq({ title: 'Renamed campaign' }), ctx())

    expect(res.status).toBe(401)
    expect(campaignUpdateMock).not.toHaveBeenCalled()
  })

  it('returns 404 when the Clerk session has no app user row', async () => {
    userFindUniqueMock.mockResolvedValue(null)

    const res = await PATCH(patchReq({ title: 'Renamed campaign' }), ctx())

    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'User not found' })
    expect(campaignUpdateMock).not.toHaveBeenCalled()
  })

  it.each([['CREATOR'], ['ADMIN']])('returns 403 for role %s — brands only', async role => {
    userFindUniqueMock.mockResolvedValue({ ...CREATOR, role })

    const res = await PATCH(patchReq({ title: 'Renamed campaign' }), ctx())

    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'Only brands can update campaigns' })
    expect(campaignUpdateMock).not.toHaveBeenCalled()
  })

  it('returns 429 with Retry-After when the rate limit is exhausted', async () => {
    checkRateLimitMock.mockResolvedValue({ ok: false, retryAfterSeconds: 17 })

    const res = await PATCH(patchReq({ title: 'Renamed campaign' }), ctx())

    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBe('17')
    expect(campaignFindUniqueMock).not.toHaveBeenCalled()
    expect(campaignUpdateMock).not.toHaveBeenCalled()
  })

  it('scopes the rate-limit key to the app user id and the request IP', async () => {
    await PATCH(patchReq({ title: 'Renamed campaign' }), ctx())

    expect(checkRateLimitMock).toHaveBeenCalledWith(
      `campaigns:update:${OWNER_BRAND.id}:203.0.113.9`,
      { limit: 20, windowMs: 60_000 },
    )
  })
})

describe('PATCH /api/campaigns/[id] — owner scoping', () => {
  it('refuses to update a campaign owned by another brand', async () => {
    userFindUniqueMock.mockResolvedValue(OTHER_BRAND)
    campaignFindUniqueMock.mockResolvedValue(campaignRow({ brandId: OWNER_BRAND.id }))

    const res = await PATCH(patchReq({ title: 'Hijacked title here' }), ctx())
    const body = await res.json()

    expect(res.status).toBe(403)
    expect(body).toEqual({ error: 'Forbidden' })
    expect(campaignUpdateMock).not.toHaveBeenCalled()
  })

  it('returns 404 when the campaign does not exist', async () => {
    campaignFindUniqueMock.mockResolvedValue(null)

    const res = await PATCH(patchReq({ title: 'Renamed campaign' }), ctx('camp_missing'))

    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'Campaign not found' })
    expect(campaignUpdateMock).not.toHaveBeenCalled()
  })

  /** Same enumeration oracle as GET — see the KNOWN DEFECT note in the GET block. */
  it('KNOWN DEFECT: PATCH leaks existence too — 403 for a real id, 404 for a fake one', async () => {
    userFindUniqueMock.mockResolvedValue(OTHER_BRAND)

    campaignFindUniqueMock.mockResolvedValue(campaignRow({ brandId: OWNER_BRAND.id }))
    const existing = await PATCH(patchReq({ title: 'Renamed campaign' }), ctx())

    campaignFindUniqueMock.mockResolvedValue(null)
    const missing = await PATCH(patchReq({ title: 'Renamed campaign' }), ctx('camp_nope'))

    expect(existing.status).toBe(403)
    expect(missing.status).toBe(404)
    expect(campaignUpdateMock).not.toHaveBeenCalled()
  })

  // Ownership is checked before the body is even read, so a malformed payload
  // from a non-owner must not turn into a 400 that implies write access.
  it('checks ownership before validating the payload', async () => {
    userFindUniqueMock.mockResolvedValue(OTHER_BRAND)
    campaignFindUniqueMock.mockResolvedValue(campaignRow({ brandId: OWNER_BRAND.id }))

    const res = await PATCH(patchReq({ budget: -1 }), ctx())

    expect(res.status).toBe(403)
  })

  // Asserted on `where.id` rather than on the whole `where` object: narrowing
  // the update to `{ id, brandId }` would be a defence-in-depth improvement,
  // and this test must not fail the day someone adds it.
  it('writes to the campaign id from the route params, not one from the body', async () => {
    await PATCH(patchReq({ title: 'Renamed campaign', id: 'camp_attacker_chosen' }), ctx())

    expect(campaignUpdateMock.mock.calls[0][0].where.id).toBe('camp_1')
  })
})

describe('PATCH /api/campaigns/[id] — status transitions', () => {
  it.each([['IN_PROGRESS'], ['COMPLETE']])(
    'refuses the %s status, which the schema does not allow',
    async status => {
      const res = await PATCH(patchReq({ status }), ctx())

      expect(res.status).toBe(400)
      expect(campaignUpdateMock).not.toHaveBeenCalled()
    },
  )

  it.each([['active'], ['Cancelled'], ['DELETED'], [''], [null], [42]])(
    'refuses the invalid status value %s',
    async status => {
      const res = await PATCH(patchReq({ status }), ctx())

      expect(res.status).toBe(400)
      expect(campaignUpdateMock).not.toHaveBeenCalled()
    },
  )

  it.each([['DRAFT'], ['ACTIVE']])('accepts the %s status', async status => {
    const res = await PATCH(patchReq({ status }), ctx())

    expect(res.status).toBe(200)
    expect(campaignUpdateMock.mock.calls[0][0].data.status).toBe(status)
  })

  /**
   * OPEN PRODUCT QUESTION (reported, not decided here — and the route file is
   * not owned by this agent). There is no from-state check: the schema
   * validates the target status in isolation, so a campaign in any state can be
   * flipped straight back to ACTIVE. Whether that is legal is a product call,
   * not a test-author's call, so the two tests below record what ships today
   * and take no position on what it should be.
   *
   * Risks, if these transitions are meant to be illegal:
   *  - CANCELLED -> ACTIVE re-opens a campaign whose creators' payment intents
   *    the CANCELLED branch already cancelled, so it is live again with no
   *    funding attached.
   *  - COMPLETE -> ACTIVE re-opens a campaign after payouts have been released,
   *    inviting new applications against work that is already paid for.
   *
   * When a transition guard lands these two SHOULD fail — replace them with the
   * 400 the guard returns.
   */
  it('DOCUMENTS CURRENT BEHAVIOUR (product question): a CANCELLED campaign can be flipped back to ACTIVE', async () => {
    campaignFindUniqueMock.mockResolvedValue(campaignRow({ status: 'CANCELLED' }))

    const res = await PATCH(patchReq({ status: 'ACTIVE' }), ctx())

    expect(res.status).toBe(200)
    expect(campaignUpdateMock.mock.calls[0][0].data.status).toBe('ACTIVE')
  })

  it('DOCUMENTS CURRENT BEHAVIOUR (product question): a COMPLETE campaign can be flipped back to ACTIVE', async () => {
    campaignFindUniqueMock.mockResolvedValue(campaignRow({ status: 'COMPLETE' }))

    const res = await PATCH(patchReq({ status: 'ACTIVE' }), ctx())

    expect(res.status).toBe(200)
    expect(campaignUpdateMock.mock.calls[0][0].data.status).toBe('ACTIVE')
  })
})

describe('PATCH /api/campaigns/[id] — cancellation side effects', () => {
  it('cancels every cancelable payment intent on the campaign', async () => {
    applicationFindManyMock.mockResolvedValue([
      { paymentIntentId: 'pi_1' },
      { paymentIntentId: 'pi_2' },
    ])

    const res = await PATCH(patchReq({ status: 'CANCELLED' }), ctx())

    expect(res.status).toBe(200)
    expect(applicationFindManyMock).toHaveBeenCalledWith({
      where: { campaignId: 'camp_1', paymentIntentId: { not: null } },
      select: { paymentIntentId: true },
    })
    expect(cancelPaymentIntentIfCancelableMock).toHaveBeenCalledTimes(2)
    expect(cancelPaymentIntentIfCancelableMock).toHaveBeenCalledWith('pi_1')
    expect(cancelPaymentIntentIfCancelableMock).toHaveBeenCalledWith('pi_2')
  })

  it('scopes the payment-intent sweep to this campaign only', async () => {
    applicationFindManyMock.mockResolvedValue([])

    await PATCH(patchReq({ status: 'CANCELLED' }, 'camp_other'), ctx('camp_other'))

    expect(applicationFindManyMock.mock.calls[0][0].where.campaignId).toBe('camp_other')
  })

  it('does not touch Stripe for a non-cancelling update', async () => {
    await PATCH(patchReq({ title: 'Renamed campaign' }), ctx())

    expect(applicationFindManyMock).not.toHaveBeenCalled()
    expect(cancelPaymentIntentIfCancelableMock).not.toHaveBeenCalled()
  })

  it('still cancels the campaign when a Stripe cancellation fails', async () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    applicationFindManyMock.mockResolvedValue([{ paymentIntentId: 'pi_broken' }])
    cancelPaymentIntentIfCancelableMock.mockRejectedValue(new Error('pi already captured'))

    const res = await PATCH(patchReq({ status: 'CANCELLED' }), ctx())

    expect(res.status).toBe(200)
    expect(campaignUpdateMock.mock.calls[0][0].data.status).toBe('CANCELLED')
    expect(consoleWarnSpy).toHaveBeenCalled()
    consoleWarnSpy.mockRestore()
  })

  it('does not cancel a payment intent for a non-owner cancelling another brand\'s campaign', async () => {
    userFindUniqueMock.mockResolvedValue(OTHER_BRAND)
    campaignFindUniqueMock.mockResolvedValue(campaignRow({ brandId: OWNER_BRAND.id }))
    applicationFindManyMock.mockResolvedValue([{ paymentIntentId: 'pi_1' }])

    const res = await PATCH(patchReq({ status: 'CANCELLED' }), ctx())

    expect(res.status).toBe(403)
    expect(applicationFindManyMock).not.toHaveBeenCalled()
    expect(cancelPaymentIntentIfCancelableMock).not.toHaveBeenCalled()
  })
})

describe('PATCH /api/campaigns/[id] — field validation', () => {
  it.each([
    ['a float', 500.5],
    ['a numeric string', '5000'],
    // JSON.stringify renders both of these as null, so the handler receives
    // null rather than a real NaN/Infinity — labelled for what reaches it.
    ['NaN, which serializes to null', Number.NaN],
    ['Infinity, which serializes to null', Number.POSITIVE_INFINITY],
    ['a negative amount', -5000],
    ['zero', 0],
    ['below the 500-cent floor', 499],
    ['null', null],
    ['a boolean', true],
  ])('rejects %s as a budget', async (_label, budget) => {
    const res = await PATCH(patchReq({ budget }), ctx())

    expect(res.status).toBe(400)
    expect(campaignUpdateMock).not.toHaveBeenCalled()
  })

  it('accepts an integer budget at the floor', async () => {
    const res = await PATCH(patchReq({ budget: 500 }), ctx())

    expect(res.status).toBe(200)
    expect(campaignUpdateMock.mock.calls[0][0].data.budget).toBe(500)
  })

  /**
   * KNOWN DEFECT (reported, not fixed here) — same missing upper bound as
   * POST /api/campaigns. Campaign.budget is a Postgres signed 32-bit Int, so
   * this value passes validation, reaches the driver and 500s in production.
   * When a `.max()` is added this test SHOULD fail — expect 400 then.
   */
  it('KNOWN DEFECT: accepts a budget far beyond a 32-bit Postgres Int (no max bound)', async () => {
    const res = await PATCH(patchReq({ budget: Number.MAX_SAFE_INTEGER }), ctx())

    expect(res.status).toBe(200)
    expect(campaignUpdateMock.mock.calls[0][0].data.budget).toBe(Number.MAX_SAFE_INTEGER)
  })

  it.each([
    ['a bare date', '2026-12-01'],
    ['free text', 'next tuesday'],
    ['an empty string', ''],
    ['a number', 1_800_000_000],
    ['null', null],
  ])('rejects %s as a deadline', async (_label, deadline) => {
    const res = await PATCH(patchReq({ deadline }), ctx())

    expect(res.status).toBe(400)
    expect(campaignUpdateMock).not.toHaveBeenCalled()
  })

  it('rejects a deadline in the past', async () => {
    const res = await PATCH(patchReq({ deadline: PAST }), ctx())

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Deadline must be in the future' })
    expect(campaignUpdateMock).not.toHaveBeenCalled()
  })

  it('rejects a deadline exactly at "now"', async () => {
    const res = await PATCH(patchReq({ deadline: NOW.toISOString() }), ctx())

    expect(res.status).toBe(400)
    expect(campaignUpdateMock).not.toHaveBeenCalled()
  })

  it('stores an accepted deadline as a Date, not the raw string', async () => {
    const res = await PATCH(patchReq({ deadline: FUTURE }), ctx())

    expect(res.status).toBe(200)
    const { data } = campaignUpdateMock.mock.calls[0][0]
    expect(data.deadline).toBeInstanceOf(Date)
    expect(data.deadline.toISOString()).toBe(FUTURE)
  })

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
    const res = await PATCH(patchReq({ [field]: value }), ctx())

    expect(res.status).toBe(400)
    expect(campaignUpdateMock).not.toHaveBeenCalled()
  })

  it.each([
    ['an empty platforms array', { platforms: [] }],
    ['a non-array platforms value', { platforms: 'instagram' }],
    ['an empty niche', { niche: '' }],
    ['creatorsNeeded of zero', { creatorsNeeded: 0 }],
    ['creatorsNeeded above 100', { creatorsNeeded: 101 }],
    ['a fractional creatorsNeeded', { creatorsNeeded: 2.5 }],
  ])('rejects %s', async (_label, body) => {
    const res = await PATCH(patchReq(body), ctx())

    expect(res.status).toBe(400)
    expect(campaignUpdateMock).not.toHaveBeenCalled()
  })

  it('accepts a null creatorsNeeded, which clears the field', async () => {
    const res = await PATCH(patchReq({ creatorsNeeded: null }), ctx())

    expect(res.status).toBe(200)
    expect(campaignUpdateMock.mock.calls[0][0].data.creatorsNeeded).toBeNull()
  })

  it('normalizes blank optional strings to null', async () => {
    const res = await PATCH(
      patchReq({ objective: '', deliverables: '', callToAction: '', usageRights: '' }),
      ctx(),
    )

    expect(res.status).toBe(200)
    const { data } = campaignUpdateMock.mock.calls[0][0]
    expect(data.objective).toBeNull()
    expect(data.deliverables).toBeNull()
    expect(data.callToAction).toBeNull()
    expect(data.usageRights).toBeNull()
  })

  it('only writes the fields present in the payload', async () => {
    await PATCH(patchReq({ title: 'A brand new title' }), ctx())

    const { data } = campaignUpdateMock.mock.calls[0][0]
    expect(data).toEqual({ title: 'A brand new title' })
  })
})

describe('PATCH /api/campaigns/[id] — mass assignment', () => {
  it('strips brandId from the payload so ownership cannot be reassigned', async () => {
    const res = await PATCH(
      patchReq({ title: 'A brand new title', brandId: OTHER_BRAND.id }),
      ctx(),
    )

    expect(res.status).toBe(200)
    expect(campaignUpdateMock.mock.calls[0][0].data).not.toHaveProperty('brandId')
  })

  it.each([['id'], ['createdAt'], ['updatedAt'], ['applications'], ['brand']])(
    'strips the unknown key %s from the update',
    async key => {
      const res = await PATCH(patchReq({ title: 'A brand new title', [key]: 'tampered' }), ctx())

      expect(res.status).toBe(200)
      expect(campaignUpdateMock.mock.calls[0][0].data).not.toHaveProperty(key)
    },
  )

  it('applies nothing when the payload is an empty object', async () => {
    const res = await PATCH(patchReq({}), ctx())

    expect(res.status).toBe(200)
    expect(campaignUpdateMock.mock.calls[0][0].data).toEqual({})
  })
})

describe('PATCH /api/campaigns/[id] — failure handling', () => {
  it('returns a generic 500 without leaking the database error', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    campaignUpdateMock.mockRejectedValue(new Error('deadlock detected on db-prod-1.internal'))

    const res = await PATCH(patchReq({ title: 'A brand new title' }), ctx())
    const body = await res.json()

    expect(res.status).toBe(500)
    // Exact match: a leaked deadlock/host detail cannot survive this.
    expect(body).toEqual({ error: 'Internal server error' })
    consoleErrorSpy.mockRestore()
  })

  /**
   * KNOWN DEFECT (reported, not fixed here). `req.json()` has no guard, so a
   * malformed body throws into the catch-all: a client error is returned as a
   * 500 and logged as a server fault. When a JSON guard is added this test
   * SHOULD fail — flip it to expect 400.
   */
  it('KNOWN DEFECT: a body that is not valid JSON 500s instead of 400', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const res = await PATCH(
      new Request('https://creatordocks.com/api/campaigns/camp_1', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: '{ not json',
      }),
      ctx(),
    )

    expect(res.status).toBe(500)
    expect(campaignUpdateMock).not.toHaveBeenCalled()
    consoleErrorSpy.mockRestore()
  })
})
