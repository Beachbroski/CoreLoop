import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * GET/POST /api/applications — the campaign application list + apply endpoints.
 *
 * The regression this file was reopened for: the GET creator branch asked for
 * `campaign: { select: {...}, include: { brand: ... } }`. Prisma rejects `select`
 * and `include` on the same selection node while serializing the query
 * (`PrismaClientValidationError` — "Please either use `include` or `select`, but
 * not both at the same time"), so every creator listing their own applications
 * got a blanket 500. Note this is a RUNTIME error only: the generated
 * `CampaignDefaultArgs` declares `select?`, `include?` and `omit?` as plain
 * optional properties with no XOR between them, so `tsc` is happy either way and
 * the shape assertion below is the only thing standing between this and prod.
 *
 * Mocking follows `app/api/applications/[id]/route.test.ts`: Prisma, Clerk, the
 * rate limiter and the origin check are mocked, while the *real* tester guard
 * and the *real* CREATOR_WEB_MODE gate run (only `isTesterEmailAllowed` is
 * stubbed, and the mode is driven through the env var it actually reads), so the
 * gate cases exercise the guards rather than stand-ins for them.
 */

const { authMock, currentUserMock, prismaMock, securityMocks, isTesterEmailAllowedMock } =
  vi.hoisted(() => ({
    authMock: vi.fn(),
    currentUserMock: vi.fn(),
    prismaMock: {
      user: { findUnique: vi.fn() },
      campaign: { findUnique: vi.fn() },
      application: {
        findUnique: vi.fn(),
        create: vi.fn(),
        findMany: vi.fn(),
      },
    },
    securityMocks: {
      checkRateLimit: vi.fn(),
      getRequestIp: vi.fn(),
      isTrustedOrigin: vi.fn(),
    },
    isTesterEmailAllowedMock: vi.fn(),
  }))

vi.mock('@clerk/nextjs/server', () => ({ auth: authMock, currentUser: currentUserMock }))
vi.mock('@/lib/prisma', () => ({ default: prismaMock }))
vi.mock('@/lib/request-security', () => securityMocks)
vi.mock('@/lib/admin-config', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/admin-config')>()
  return { ...actual, isTesterEmailAllowed: isTesterEmailAllowedMock }
})

const { GET, POST } = await import('./route')
const { CREATOR_WRITE_BLOCKED_ERROR } = await import('@/lib/creator-web-mode')

const CREATOR_ID = 'user_creator'
const BRAND_ID = 'user_brand'
const CAMPAIGN_ID = 'camp_1'
const REQUEST_IP = '203.0.113.7'
const ENDPOINT = 'https://app.example.test/api/applications'

const CREATOR = {
  id: CREATOR_ID,
  clerkId: 'clerk_creator',
  email: 'creator@example.com',
  name: 'Creator Person',
  role: 'CREATOR' as const,
  stripeOnboarded: true,
}

const BRAND = {
  id: BRAND_ID,
  clerkId: 'clerk_brand',
  email: 'brand@example.com',
  name: 'Brand Co',
  role: 'BRAND' as const,
  stripeOnboarded: true,
}

/** Campaign columns the POST path reads. Never mutated — overrides spread a copy. */
const ACTIVE_CAMPAIGN = {
  id: CAMPAIGN_ID,
  brandId: BRAND_ID,
  title: 'Summer glow-up',
  budget: 500_000,
  niche: 'Beauty',
  status: 'ACTIVE',
  deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
}

function campaign(overrides: Record<string, unknown> = {}) {
  return { ...ACTIVE_CAMPAIGN, ...overrides }
}

const VALID_BODY = {
  campaignId: CAMPAIGN_ID,
  pitch: 'I have run three campaigns in this exact niche and can turn it around fast.',
  proposedRate: 50_000,
}

/** A row shaped like what the fixed creator-branch query returns. */
const CREATOR_VISIBLE_ROW = {
  id: 'app_1',
  campaignId: CAMPAIGN_ID,
  creatorId: CREATOR_ID,
  pitch: VALID_BODY.pitch,
  proposedRate: VALID_BODY.proposedRate,
  status: 'PENDING',
  paymentIntentId: null,
  createdAt: new Date('2026-08-01T00:00:00.000Z'),
  updatedAt: new Date('2026-08-01T00:00:00.000Z'),
  campaign: {
    id: CAMPAIGN_ID,
    title: ACTIVE_CAMPAIGN.title,
    budget: ACTIVE_CAMPAIGN.budget,
    niche: ACTIVE_CAMPAIGN.niche,
    brand: { name: BRAND.name, avatarUrl: null },
  },
}

/** A row shaped like what the brand-branch query returns. */
const BRAND_VISIBLE_ROW = {
  ...CREATOR_VISIBLE_ROW,
  campaign: { id: CAMPAIGN_ID, title: ACTIVE_CAMPAIGN.title },
  creator: { name: CREATOR.name, avatarUrl: null },
}

function post(body: unknown): Request {
  return new Request(ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'https://app.example.test' },
    body: JSON.stringify(body),
  })
}

/** Same request with the body sent verbatim — the only way to break `req.json()`. */
function postRaw(rawBody: string): Request {
  return new Request(ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'https://app.example.test' },
    body: rawBody,
  })
}

function silenceRouteErrors() {
  return vi.spyOn(console, 'error').mockImplementation(() => {})
}

/** The single argument object the route handed `application.findMany`. */
function findManyArgs<T>(): T {
  expect(prismaMock.application.findMany).toHaveBeenCalledTimes(1)
  return prismaMock.application.findMany.mock.calls[0][0] as T
}

beforeEach(() => {
  vi.clearAllMocks()

  // Creator web is `full` in production today; the freeze modes get their own test.
  vi.stubEnv('CREATOR_WEB_MODE', 'full')

  isTesterEmailAllowedMock.mockReturnValue(true)
  securityMocks.isTrustedOrigin.mockReturnValue(true)
  securityMocks.getRequestIp.mockReturnValue(REQUEST_IP)
  securityMocks.checkRateLimit.mockResolvedValue({ ok: true, retryAfterSeconds: 0 })

  authMock.mockResolvedValue({ userId: CREATOR.clerkId })
  currentUserMock.mockResolvedValue(null)
  prismaMock.user.findUnique.mockResolvedValue(CREATOR)
  prismaMock.campaign.findUnique.mockResolvedValue(campaign())
  prismaMock.application.findUnique.mockResolvedValue(null)
  prismaMock.application.create.mockImplementation(
    async ({ data }: { data: Record<string, unknown> }) => ({
      id: 'app_new',
      status: 'PENDING',
      paymentIntentId: null,
      createdAt: new Date('2026-09-01T00:00:00.000Z'),
      updatedAt: new Date('2026-09-01T00:00:00.000Z'),
      ...data,
    }),
  )
  prismaMock.application.findMany.mockResolvedValue([CREATOR_VISIBLE_ROW])
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('POST /api/applications — gates', () => {
  it('refuses an untrusted origin with 403 before authenticating', async () => {
    securityMocks.isTrustedOrigin.mockReturnValue(false)

    const res = await POST(post(VALID_BODY))

    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'Invalid request origin' })
    expect(authMock).not.toHaveBeenCalled()
    expect(prismaMock.application.create).not.toHaveBeenCalled()
  })

  it('refuses an unauthenticated caller with 401', async () => {
    authMock.mockResolvedValue({ userId: null })

    const res = await POST(post(VALID_BODY))

    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'Unauthorized' })
    expect(prismaMock.application.create).not.toHaveBeenCalled()
  })

  it('refuses a signed-in caller who is not on the tester allowlist with 403', async () => {
    isTesterEmailAllowedMock.mockReturnValue(false)

    const res = await POST(post(VALID_BODY))

    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'Forbidden' })
    expect(prismaMock.campaign.findUnique).not.toHaveBeenCalled()
    expect(prismaMock.application.create).not.toHaveBeenCalled()
  })

  // W7-4: applying is a creator mutation, so it closes in readonly/sunset.
  it.each([['readonly'], ['sunset'], ['bogus'], ['']])(
    'refuses the write with 403 when CREATOR_WEB_MODE is %j',
    async mode => {
      vi.stubEnv('CREATOR_WEB_MODE', mode)

      const res = await POST(post(VALID_BODY))

      expect(res.status).toBe(403)
      expect(await res.json()).toEqual({ error: CREATOR_WRITE_BLOCKED_ERROR })
      expect(prismaMock.campaign.findUnique).not.toHaveBeenCalled()
      expect(prismaMock.application.create).not.toHaveBeenCalled()
    },
  )

  it('returns 404 when the Clerk session has no local user row', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null)

    const res = await POST(post(VALID_BODY))

    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'User not found' })
    expect(prismaMock.application.create).not.toHaveBeenCalled()
  })

  it.each([['BRAND'], ['ADMIN']])('refuses a %s caller with 403', async role => {
    prismaMock.user.findUnique.mockResolvedValue({ ...CREATOR, role })

    const res = await POST(post(VALID_BODY))

    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'Only creators can apply to campaigns' })
    expect(prismaMock.application.create).not.toHaveBeenCalled()
  })

  it('refuses a rate-limited creator with 429 and a Retry-After header', async () => {
    securityMocks.checkRateLimit.mockResolvedValue({ ok: false, retryAfterSeconds: 30 })

    const res = await POST(post(VALID_BODY))

    expect(res.status).toBe(429)
    expect(res.headers.get('retry-after')).toBe('30')
    expect(prismaMock.campaign.findUnique).not.toHaveBeenCalled()
    expect(prismaMock.application.create).not.toHaveBeenCalled()
  })

  it('scopes the rate limit to the creator and the request IP', async () => {
    await POST(post(VALID_BODY))

    expect(securityMocks.checkRateLimit).toHaveBeenCalledWith(
      `applications:create:${CREATOR_ID}:${REQUEST_IP}`,
      { limit: 15, windowMs: 60_000 },
    )
  })

  it('refuses a creator who has not finished Stripe onboarding with 403', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ ...CREATOR, stripeOnboarded: false })

    const res = await POST(post(VALID_BODY))

    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({
      error: 'Complete Stripe onboarding before applying to campaigns',
    })
    expect(prismaMock.application.create).not.toHaveBeenCalled()
  })
})

/**
 * `proposedRate` is a whole number of cents that flows straight into the payment
 * path (the brand is charged it on accept, and it is summed against the campaign
 * budget). A zero, negative or fractional value is a money bug, so every one of
 * these must die at the schema.
 */
describe('POST /api/applications — proposedRate must be positive integer cents', () => {
  it.each([
    ['zero', 0],
    ['negative', -50_000],
    ['negative and below the floor', -1],
    ['below the 100-cent floor', 99],
    ['fractional cents', 500.5],
    ['a hair under an integer', 99_999.999],
    ['above the 10,000,000-cent cap', 10_000_001],
    ['beyond a safe integer', Number.MAX_SAFE_INTEGER + 2],
    ['a numeric string', '50000'],
    ['null', null],
    ['a boolean', true],
    ['missing', undefined],
  ])('rejects %s with 400 and creates nothing', async (_label, proposedRate) => {
    const res = await POST(post({ ...VALID_BODY, proposedRate }))

    expect(res.status).toBe(400)
    expect(prismaMock.application.create).not.toHaveBeenCalled()
  })

  it.each([
    ['the 100-cent floor', 100],
    ['the 10,000,000-cent cap', 10_000_000],
  ])('accepts %s', async (_label, proposedRate) => {
    const res = await POST(post({ ...VALID_BODY, proposedRate }))

    expect(res.status).toBe(201)
    expect(prismaMock.application.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ proposedRate }),
    })
  })

  it('persists the rate exactly as sent — no coercion, no rounding', async () => {
    await POST(post({ ...VALID_BODY, proposedRate: 123_456 }))

    const [{ data }] = prismaMock.application.create.mock.calls[0] as [
      { data: { proposedRate: unknown } },
    ]
    expect(data.proposedRate).toBe(123_456)
    expect(Number.isInteger(data.proposedRate)).toBe(true)
  })
})

describe('POST /api/applications — other input validation', () => {
  it.each([
    ['an empty campaignId', { ...VALID_BODY, campaignId: '' }],
    ['a missing campaignId', { ...VALID_BODY, campaignId: undefined }],
    ['a non-string campaignId', { ...VALID_BODY, campaignId: 7 }],
    ['a pitch under 20 chars', { ...VALID_BODY, pitch: 'too short' }],
    ['a pitch over 2000 chars', { ...VALID_BODY, pitch: 'x'.repeat(2001) }],
    ['a missing pitch', { ...VALID_BODY, pitch: undefined }],
    ['a null body', null],
    ['an array body', []],
  ])('rejects %s with 400', async (_label, body) => {
    const res = await POST(post(body))

    expect(res.status).toBe(400)
    expect(prismaMock.application.create).not.toHaveBeenCalled()
  })

  it('accepts a pitch at exactly the 20-char floor', async () => {
    const res = await POST(post({ ...VALID_BODY, pitch: 'x'.repeat(20) }))

    expect(res.status).toBe(201)
  })

  it('returns a generic 500 when the body is not JSON at all', async () => {
    const consoleErrorSpy = silenceRouteErrors()

    const res = await POST(postRaw('not json'))

    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'Internal server error' })
    expect(prismaMock.application.create).not.toHaveBeenCalled()

    consoleErrorSpy.mockRestore()
  })

  it('never leaks internal error details when Prisma throws', async () => {
    const consoleErrorSpy = silenceRouteErrors()
    prismaMock.application.create.mockRejectedValue(
      new Error('connect ECONNREFUSED postgres://user:hunter2@10.0.0.5:5432/prod'),
    )

    const res = await POST(post(VALID_BODY))
    const serialized = JSON.stringify(await res.json())

    expect(res.status).toBe(500)
    expect(serialized).toBe(JSON.stringify({ error: 'Internal server error' }))
    expect(serialized).not.toContain('hunter2')
    expect(serialized).not.toContain('10.0.0.5')

    consoleErrorSpy.mockRestore()
  })
})

describe('POST /api/applications — campaign eligibility', () => {
  it('returns 404 for a campaign that does not exist', async () => {
    prismaMock.campaign.findUnique.mockResolvedValue(null)

    const res = await POST(post(VALID_BODY))

    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'Campaign not found' })
    expect(prismaMock.application.create).not.toHaveBeenCalled()
  })

  it.each([['DRAFT'], ['IN_PROGRESS'], ['COMPLETE'], ['CANCELLED']])(
    'refuses a %s campaign with 400',
    async status => {
      prismaMock.campaign.findUnique.mockResolvedValue(campaign({ status }))

      const res = await POST(post(VALID_BODY))

      expect(res.status).toBe(400)
      expect(await res.json()).toEqual({ error: 'Campaign is not accepting applications' })
      expect(prismaMock.application.create).not.toHaveBeenCalled()
    },
  )

  it('refuses a campaign whose deadline has passed with 400', async () => {
    prismaMock.campaign.findUnique.mockResolvedValue(
      campaign({ deadline: new Date(Date.now() - 60_000) }),
    )

    const res = await POST(post(VALID_BODY))

    expect(res.status).toBe(400)
    expect((await res.json()).error).toContain('deadline has passed')
    expect(prismaMock.application.create).not.toHaveBeenCalled()
  })

  it('refuses an application to the caller’s own campaign with 403', async () => {
    prismaMock.campaign.findUnique.mockResolvedValue(campaign({ brandId: CREATOR_ID }))

    const res = await POST(post(VALID_BODY))

    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'Cannot apply to your own campaign' })
    expect(prismaMock.application.create).not.toHaveBeenCalled()
  })

  it('refuses a duplicate application with 409, checked per creator and campaign', async () => {
    prismaMock.application.findUnique.mockResolvedValue({ id: 'app_existing' })

    const res = await POST(post(VALID_BODY))

    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'Already applied to this campaign' })
    expect(prismaMock.application.findUnique).toHaveBeenCalledWith({
      where: { campaignId_creatorId: { campaignId: CAMPAIGN_ID, creatorId: CREATOR_ID } },
    })
    expect(prismaMock.application.create).not.toHaveBeenCalled()
  })
})

describe('POST /api/applications — creation', () => {
  it('creates the application scoped to the authenticated creator and returns 201', async () => {
    const res = await POST(post(VALID_BODY))
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.success).toBe(true)
    expect(body.data.campaignId).toBe(CAMPAIGN_ID)
    expect(prismaMock.application.create).toHaveBeenCalledTimes(1)
    expect(prismaMock.application.create).toHaveBeenCalledWith({
      data: {
        campaignId: CAMPAIGN_ID,
        creatorId: CREATOR_ID,
        pitch: VALID_BODY.pitch,
        proposedRate: VALID_BODY.proposedRate,
      },
    })
  })

  it('ignores client-supplied ownership, status and payment fields', async () => {
    await POST(
      post({
        ...VALID_BODY,
        id: 'app_forced',
        creatorId: 'user_someone_else',
        status: 'ACCEPTED',
        paymentIntentId: 'pi_attacker',
        createdAt: '1999-01-01T00:00:00.000Z',
      }),
    )

    const [{ data }] = prismaMock.application.create.mock.calls[0] as [
      { data: Record<string, unknown> },
    ]
    expect(data.creatorId).toBe(CREATOR_ID)
    expect(Object.keys(data).sort()).toEqual(
      ['campaignId', 'creatorId', 'pitch', 'proposedRate'].sort(),
    )
  })

  it('does not echo the caller’s account identifiers back in the response', async () => {
    const res = await POST(post(VALID_BODY))
    const serialized = JSON.stringify(await res.json())

    expect(serialized).not.toContain(CREATOR.clerkId)
    expect(serialized).not.toContain(CREATOR.email)
    expect(serialized).not.toContain('stripeAccountId')
  })
})

describe('GET /api/applications — gates', () => {
  it('refuses an unauthenticated caller with 401', async () => {
    authMock.mockResolvedValue({ userId: null })

    const res = await GET()

    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'Unauthorized' })
    expect(prismaMock.application.findMany).not.toHaveBeenCalled()
  })

  it('refuses a caller who is not on the tester allowlist with 403', async () => {
    isTesterEmailAllowedMock.mockReturnValue(false)

    const res = await GET()

    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'Forbidden' })
    expect(prismaMock.application.findMany).not.toHaveBeenCalled()
  })

  it('returns 404 when the Clerk session has no local user row', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null)

    const res = await GET()

    expect(res.status).toBe(404)
    expect(prismaMock.application.findMany).not.toHaveBeenCalled()
  })

  it('resolves the caller from the Clerk id, never from client input', async () => {
    await GET()

    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
      where: { clerkId: CREATOR.clerkId },
    })
  })

  it('returns a generic 500 when the query fails', async () => {
    const consoleErrorSpy = silenceRouteErrors()
    prismaMock.application.findMany.mockRejectedValue(new Error('db exploded at 10.0.0.5'))

    const res = await GET()
    const serialized = JSON.stringify(await res.json())

    expect(res.status).toBe(500)
    expect(serialized).toBe(JSON.stringify({ error: 'Internal server error' }))
    expect(serialized).not.toContain('10.0.0.5')

    consoleErrorSpy.mockRestore()
  })
})

describe('GET /api/applications — brand listing', () => {
  beforeEach(() => {
    authMock.mockResolvedValue({ userId: BRAND.clerkId })
    prismaMock.user.findUnique.mockResolvedValue(BRAND)
    prismaMock.application.findMany.mockResolvedValue([BRAND_VISIBLE_ROW])
  })

  it('returns 200 scoped to campaigns the brand owns, newest first', async () => {
    const res = await GET()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data).toHaveLength(1)

    const args = findManyArgs<Record<string, unknown>>()
    expect(args.where).toEqual({ campaign: { brandId: BRAND_ID } })
    expect(args.orderBy).toEqual({ createdAt: 'desc' })
  })

  it('asks only for non-sensitive creator columns', async () => {
    await GET()

    const args = findManyArgs<{
      include: { creator: { select: Record<string, boolean> } }
    }>()
    const creatorSelect = args.include.creator.select

    expect(creatorSelect).toEqual({ name: true, avatarUrl: true })
    expect(creatorSelect).not.toHaveProperty('email')
    expect(creatorSelect).not.toHaveProperty('clerkId')
    expect(creatorSelect).not.toHaveProperty('stripeAccountId')
  })

  it('puts no creator PII in the response body', async () => {
    const res = await GET()
    const serialized = JSON.stringify(await res.json())

    expect(serialized).not.toContain(CREATOR.email)
    expect(serialized).not.toContain(CREATOR.clerkId)
    expect(serialized).not.toContain('stripeAccountId')
  })
})

describe('GET /api/applications — creator listing', () => {
  /**
   * THE REGRESSION. `campaign` must carry exactly one selection key. Prisma
   * raises `PrismaClientValidationError` ("Please either use `include` or
   * `select`, but not both at the same time") while serializing a node that has
   * both, before the query reaches the database — which is what turned this
   * whole branch into a 500 for every creator. The generated types do NOT catch
   * it (`CampaignDefaultArgs` allows `select` and `include` side by side), so
   * this assertion is the guard.
   */
  it('asks for the campaign relation through a single select node', async () => {
    await GET()

    const args = findManyArgs<{ include: { campaign: Record<string, unknown> } }>()
    const campaignNode = args.include.campaign

    expect(Object.keys(campaignNode)).toEqual(['select'])
    expect(campaignNode).not.toHaveProperty('include')
    expect(campaignNode).toEqual({
      select: {
        id: true,
        title: true,
        budget: true,
        niche: true,
        brand: { select: { name: true, avatarUrl: true } },
      },
    })
  })

  it('returns 200 with the creator’s own applications, newest first', async () => {
    const res = await GET()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data).toHaveLength(1)
    expect(body.data[0].campaign.brand.name).toBe(BRAND.name)

    const args = findManyArgs<Record<string, unknown>>()
    expect(args.where).toEqual({ creatorId: CREATOR_ID })
    expect(args.orderBy).toEqual({ createdAt: 'desc' })
  })

  it('keeps the campaign fields the creator dashboard renders', async () => {
    await GET()

    const args = findManyArgs<{
      include: { campaign: { select: Record<string, unknown> } }
    }>()
    const campaignSelect = args.include.campaign.select

    for (const field of ['id', 'title', 'budget', 'niche']) {
      expect(campaignSelect[field]).toBe(true)
    }
  })

  it('asks only for non-sensitive brand columns', async () => {
    await GET()

    const args = findManyArgs<{
      include: { campaign: { select: { brand: { select: Record<string, boolean> } } } }
    }>()
    const brandSelect = args.include.campaign.select.brand.select

    expect(brandSelect).toEqual({ name: true, avatarUrl: true })
    expect(brandSelect).not.toHaveProperty('email')
    expect(brandSelect).not.toHaveProperty('clerkId')
    expect(brandSelect).not.toHaveProperty('stripeAccountId')
  })

  // A non-BRAND role must never fall through to the brand-wide query: that would
  // list every application on someone else's campaigns.
  it.each([['CREATOR'], ['ADMIN']])(
    'scopes a %s caller to their own applications only',
    async role => {
      prismaMock.user.findUnique.mockResolvedValue({ ...CREATOR, role })

      const res = await GET()

      expect(res.status).toBe(200)
      const args = findManyArgs<Record<string, unknown>>()
      expect(args.where).toEqual({ creatorId: CREATOR_ID })
    },
  )

  it('puts no brand PII in the response body', async () => {
    const res = await GET()
    const serialized = JSON.stringify(await res.json())

    expect(serialized).not.toContain(BRAND.email)
    expect(serialized).not.toContain(BRAND.clerkId)
    expect(serialized).not.toContain('stripeAccountId')
  })
})
