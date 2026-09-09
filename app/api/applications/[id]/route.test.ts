import type { ApplicationStatus, CampaignStatus } from '@prisma/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * PATCH /api/applications/[id] — the brand-side review endpoint.
 *
 * The regression this file was opened for: the handler loaded the application
 * with `include: { creator: true }` and the no-op branch (`status` already
 * equals the requested status) returned that row verbatim. Any brand could
 * PATCH an application on their own campaign with its *current* status — a
 * no-op that changes nothing and passes every ownership check — and receive the
 * creator's whole User row: `email`, `bio`, `clerkId` and `stripeAccountId`.
 * The last two are exactly what the `/api/v1` contract refuses to expose, and
 * `stripeAccountId` is a Stripe Connect identifier.
 *
 * Mocking follows `tests/api-v1-authz-matrix.test.ts`: Prisma, Clerk, the rate
 * limiter and the origin check are mocked, while the *real* tester guard runs
 * (only `isTesterEmailAllowed` is stubbed), so the 401 case exercises the guard
 * rather than a stand-in for it.
 */

const {
  authMock,
  currentUserMock,
  checkRateLimitMock,
  isTrustedOriginMock,
  prismaMock,
  emailMocks,
  pushMocks,
  stripeMocks,
} = vi.hoisted(() => ({
  authMock: vi.fn(),
  currentUserMock: vi.fn(),
  checkRateLimitMock: vi.fn(),
  isTrustedOriginMock: vi.fn(),
  prismaMock: {
    user: { findUnique: vi.fn() },
    application: {
      findUnique: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
      aggregate: vi.fn(),
    },
    campaign: { update: vi.fn() },
    $transaction: vi.fn(),
  },
  emailMocks: {
    sendApplicationAcceptedEmail: vi.fn(),
    sendApplicationRejectedEmail: vi.fn(),
  },
  pushMocks: {
    sendApplicationAcceptedPush: vi.fn(),
    sendApplicationRejectedPush: vi.fn(),
  },
  stripeMocks: {
    validatePaymentIntentForApplication: vi.fn(),
    cancelPaymentIntentIfCancelable: vi.fn(),
  },
}))

vi.mock('@clerk/nextjs/server', () => ({ auth: authMock, currentUser: currentUserMock }))
vi.mock('@/lib/prisma', () => ({ default: prismaMock }))
vi.mock('@/lib/request-security', () => ({
  checkRateLimit: checkRateLimitMock,
  getRequestIp: () => '203.0.113.7',
  isTrustedOrigin: isTrustedOriginMock,
}))
vi.mock('@/lib/email', () => emailMocks)
vi.mock('@/lib/push', () => pushMocks)
vi.mock('@/lib/stripe-payments', () => stripeMocks)
vi.mock('@/lib/admin-config', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/admin-config')>()
  return { ...actual, isTesterEmailAllowed: () => true }
})

const { PATCH } = await import('./route')

const BRAND = {
  id: 'user_brand',
  clerkId: 'clerk_brand',
  email: 'brand@example.com',
  name: 'Brand',
  role: 'BRAND' as const,
}

const CREATOR_ID = 'user_creator'

/** The creator columns the handler is allowed to read. */
const CREATOR = {
  id: CREATOR_ID,
  email: 'creator@example.com',
  stripeAccountId: 'acct_creator_1',
}

/**
 * Everything the pre-fix `creator: true` pulled in. Seeded on purpose so a
 * response that echoes the relation has something recognisable to leak.
 */
const CREATOR_FULL_ROW = {
  ...CREATOR,
  clerkId: 'clerk_creator_secret',
  role: 'CREATOR' as const,
  name: 'Creator Person',
  avatarUrl: null,
  bio: 'Beauty creator in Austin. Private-ish.',
  stripeOnboarded: true,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
}

const CAMPAIGN = {
  id: 'camp_1',
  brandId: BRAND.id,
  title: 'Spring Launch',
  description: 'desc',
  objective: null,
  deliverables: null,
  targetAudience: null,
  creatorRequirements: null,
  callToAction: null,
  usageRights: null,
  creatorsNeeded: 1,
  budget: 100_000,
  deadline: new Date('2026-12-01T00:00:00.000Z'),
  niche: 'Beauty',
  platforms: ['TikTok'],
  status: 'ACTIVE' as CampaignStatus,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
}

const APPLICATION = {
  id: 'app_1',
  campaignId: CAMPAIGN.id,
  creatorId: CREATOR_ID,
  pitch: 'my pitch',
  proposedRate: 25_000,
  status: 'PENDING' as ApplicationStatus,
  paymentIntentId: 'pi_1',
  createdAt: new Date('2026-02-01T00:00:00.000Z'),
  updatedAt: new Date('2026-02-01T00:00:00.000Z'),
}

/** Every Application scalar column — the shape both success branches return. */
const APPLICATION_COLUMNS = [
  'id',
  'campaignId',
  'creatorId',
  'pitch',
  'proposedRate',
  'status',
  'paymentIntentId',
  'createdAt',
  'updatedAt',
] as const

type Overrides = {
  application?: Partial<typeof APPLICATION>
  campaign?: Partial<typeof CAMPAIGN>
  creator?: Record<string, unknown>
}

/** Seeds the joined row the handler loads. Never mutates the fixtures. */
function seedApplication(overrides: Overrides = {}) {
  prismaMock.application.findUnique.mockResolvedValue({
    ...APPLICATION,
    ...overrides.application,
    campaign: { ...CAMPAIGN, ...overrides.campaign },
    creator: { ...CREATOR, ...overrides.creator },
  })
}

function patch(body: unknown, id = APPLICATION.id): Promise<Response> {
  const req = new Request(`https://www.creatordocks.com/api/applications/${id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', origin: 'https://www.creatordocks.com' },
    body: JSON.stringify(body),
  })

  return PATCH(req, { params: Promise.resolve({ id }) })
}

/**
 * Same request, but the body is sent verbatim instead of being JSON-encoded —
 * the only way to reach `req.json()` with something it cannot parse.
 */
function patchRaw(rawBody: string, id = APPLICATION.id): Promise<Response> {
  const req = new Request(`https://www.creatordocks.com/api/applications/${id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', origin: 'https://www.creatordocks.com' },
    body: rawBody,
  })

  return PATCH(req, { params: Promise.resolve({ id }) })
}

beforeEach(() => {
  vi.clearAllMocks()

  isTrustedOriginMock.mockReturnValue(true)
  checkRateLimitMock.mockResolvedValue({ ok: true, retryAfterSeconds: 0 })
  authMock.mockResolvedValue({ userId: BRAND.clerkId })
  currentUserMock.mockResolvedValue(null)
  prismaMock.user.findUnique.mockResolvedValue(BRAND)

  seedApplication()

  // Neutral accept-path defaults: room for one more creator, budget to spare.
  prismaMock.application.count.mockResolvedValue(0)
  prismaMock.application.aggregate.mockResolvedValue({ _sum: { proposedRate: 0 } })
  prismaMock.application.update.mockImplementation(
    async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => ({
      ...APPLICATION,
      ...data,
      id: where.id,
    }),
  )
  prismaMock.campaign.update.mockResolvedValue({ ...CAMPAIGN, status: 'IN_PROGRESS' })
  prismaMock.$transaction.mockImplementation(
    async (fn: (tx: typeof prismaMock) => Promise<unknown>) => fn(prismaMock),
  )
  stripeMocks.validatePaymentIntentForApplication.mockResolvedValue({ id: 'pi_1' })
  stripeMocks.cancelPaymentIntentIfCancelable.mockResolvedValue(true)
})

/**
 * THE REGRESSION. Against the pre-fix handler these assertions fail: the no-op
 * branch returned the joined row, so `data.creator.email`, `.bio`, `.clerkId`
 * and `.stripeAccountId` were all present in the body.
 */
describe('PATCH /api/applications/[id] — the no-op branch leaks no creator PII', () => {
  const LEAKED_KEYS = ['email', 'bio', 'clerkId', 'stripeAccountId'] as const

  it('returns no creator relation at all when the status is unchanged', async () => {
    seedApplication({ application: { status: 'ACCEPTED' }, creator: CREATOR_FULL_ROW })

    const res = await patch({ status: 'ACCEPTED' })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data).not.toHaveProperty('creator')
    expect(body.data).not.toHaveProperty('campaign')
    for (const key of LEAKED_KEYS) {
      expect(body.data).not.toHaveProperty(key)
    }
  })

  it('puts none of those values anywhere in the serialized response', async () => {
    seedApplication({ application: { status: 'REJECTED' }, creator: CREATOR_FULL_ROW })

    const res = await patch({ status: 'REJECTED' })
    const serialized = JSON.stringify(await res.json())

    expect(serialized).not.toContain(CREATOR_FULL_ROW.email)
    expect(serialized).not.toContain(CREATOR_FULL_ROW.clerkId)
    expect(serialized).not.toContain(CREATOR_FULL_ROW.stripeAccountId)
    expect(serialized).not.toContain(CREATOR_FULL_ROW.bio)
  })

  it('answers with the same flat shape the update path returns', async () => {
    seedApplication({ application: { status: 'ACCEPTED' }, creator: CREATOR_FULL_ROW })
    const noop = await (await patch({ status: 'ACCEPTED' })).json()

    seedApplication({ application: { status: 'PENDING' }, creator: CREATOR_FULL_ROW })
    const updated = await (await patch({ status: 'REJECTED' })).json()

    expect(Object.keys(noop.data).sort()).toEqual([...APPLICATION_COLUMNS].sort())
    expect(Object.keys(noop.data).sort()).toEqual(Object.keys(updated.data).sort())
  })

  it('changes nothing — no update, no email, no push', async () => {
    seedApplication({ application: { status: 'ACCEPTED' } })

    await patch({ status: 'ACCEPTED' })

    expect(prismaMock.application.update).not.toHaveBeenCalled()
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
    expect(emailMocks.sendApplicationAcceptedEmail).not.toHaveBeenCalled()
    expect(pushMocks.sendApplicationAcceptedPush).not.toHaveBeenCalled()
  })

  /**
   * The narrowing is the fix; the response shape is the symptom. Asserting the
   * query itself keeps a future `creator: true` from passing because some other
   * branch happens to strip the row on the way out.
   */
  it('never asks the database for the columns it must not expose', async () => {
    await patch({ status: 'REJECTED' })

    const args = prismaMock.application.findUnique.mock.calls.at(-1)?.[0] as {
      include: { creator: { select: Record<string, boolean> } }
    }

    expect(args.include.creator.select).toEqual({ id: true, email: true, stripeAccountId: true })
    expect(args.include.creator.select).not.toHaveProperty('clerkId')
    expect(args.include.creator.select).not.toHaveProperty('bio')
  })
})

describe('PATCH /api/applications/[id] — access control', () => {
  it('rejects an untrusted origin with 403', async () => {
    isTrustedOriginMock.mockReturnValue(false)

    const res = await patch({ status: 'ACCEPTED' })

    expect(res.status).toBe(403)
    expect((await res.json()).error).toBe('Invalid request origin')
    expect(prismaMock.application.findUnique).not.toHaveBeenCalled()
  })

  it('rejects an unauthenticated caller with 401', async () => {
    authMock.mockResolvedValue({ userId: null })

    const res = await patch({ status: 'ACCEPTED' })

    expect(res.status).toBe(401)
    expect(prismaMock.application.update).not.toHaveBeenCalled()
  })

  it('rejects a non-BRAND account with 403', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ ...BRAND, role: 'CREATOR' })

    const res = await patch({ status: 'ACCEPTED' })

    expect(res.status).toBe(403)
    expect((await res.json()).error).toBe('Only brands can review applications')
  })

  it("rejects a brand reviewing an application on someone else's campaign with 403", async () => {
    seedApplication({ campaign: { brandId: 'user_other_brand' }, creator: CREATOR_FULL_ROW })

    const res = await patch({ status: 'ACCEPTED' })
    const serialized = JSON.stringify(await res.json())

    expect(res.status).toBe(403)
    expect(prismaMock.application.update).not.toHaveBeenCalled()
    // A 403 must not become a consolation prize of creator data either.
    expect(serialized).not.toContain(CREATOR_FULL_ROW.email)
    expect(serialized).not.toContain(CREATOR_FULL_ROW.stripeAccountId)
  })

  it('returns 404 when the application does not exist', async () => {
    prismaMock.application.findUnique.mockResolvedValue(null)

    const res = await patch({ status: 'ACCEPTED' })

    expect(res.status).toBe(404)
  })

  it('returns 429 with Retry-After when the rate limit is exceeded', async () => {
    checkRateLimitMock.mockResolvedValue({ ok: false, retryAfterSeconds: 37 })

    const res = await patch({ status: 'ACCEPTED' })

    expect(res.status).toBe(429)
    expect(res.headers.get('retry-after')).toBe('37')
    expect(prismaMock.application.findUnique).not.toHaveBeenCalled()
  })
})

describe('PATCH /api/applications/[id] — request validation', () => {
  it.each([
    ['an unknown status', { status: 'MAYBE' }],
    ['a missing status', {}],
    ['a non-string status', { status: 7 }],
  ])('rejects %s with 400', async (_label, body) => {
    const res = await patch(body)

    expect(res.status).toBe(400)
    expect(prismaMock.application.update).not.toHaveBeenCalled()
  })

  /**
   * Unparseable input is still bad input, not a server fault. Against an
   * unguarded `await req.json()` these are 500s: the parse error escapes to the
   * outer catch, so the client is told to retry a request that can never
   * succeed and the log fills with a "server error" nobody can act on.
   */
  it.each([
    ['a malformed JSON body', '{"status":'],
    ['an empty body', ''],
    ['a JSON literal that is not an object', 'null'],
  ])('rejects %s with 400, not 500', async (_label, rawBody) => {
    const res = await patchRaw(rawBody)

    expect(res.status).toBe(400)
    expect(await res.json()).not.toEqual({ error: 'Internal server error' })
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
    expect(prismaMock.application.update).not.toHaveBeenCalled()
  })
})

describe('PATCH /api/applications/[id] — accept preconditions', () => {
  it('refuses to accept when the creator has no payout account (400)', async () => {
    seedApplication({ creator: { stripeAccountId: null } })

    const res = await patch({ status: 'ACCEPTED' })

    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('Creator does not have a payout account connected')
    expect(stripeMocks.validatePaymentIntentForApplication).not.toHaveBeenCalled()
  })

  it('refuses to review an application that is no longer pending (409)', async () => {
    seedApplication({ application: { status: 'REJECTED' } })

    const res = await patch({ status: 'ACCEPTED' })

    expect(res.status).toBe(409)
    expect((await res.json()).error).toBe('Only pending applications can be reviewed')
  })

  it('refuses to review when the campaign is not ACTIVE (409)', async () => {
    seedApplication({ campaign: { status: 'CANCELLED' } })

    const res = await patch({ status: 'ACCEPTED' })

    expect(res.status).toBe(409)
    expect((await res.json()).error).toBe('This campaign is no longer accepting applications')
  })

  it('surfaces an unauthorized payment intent as 409', async () => {
    stripeMocks.validatePaymentIntentForApplication.mockRejectedValue(
      new Error('Payment has not been authorized yet'),
    )

    const res = await patch({ status: 'ACCEPTED' })

    expect(res.status).toBe(409)
    expect((await res.json()).error).toBe('Payment has not been authorized yet')
    expect(prismaMock.application.update).not.toHaveBeenCalled()
  })

  it('validates the payment intent against the creator account, not an arbitrary one', async () => {
    await patch({ status: 'ACCEPTED' })

    expect(stripeMocks.validatePaymentIntentForApplication).toHaveBeenCalledWith(
      expect.objectContaining({
        destinationAccountId: CREATOR.stripeAccountId,
        requireAuthorized: true,
      }),
    )
  })

  it('refuses to accept past creatorsNeeded (409)', async () => {
    seedApplication({ campaign: { creatorsNeeded: 2 } })
    prismaMock.application.count.mockResolvedValue(2)

    const res = await patch({ status: 'ACCEPTED' })

    expect(res.status).toBe(409)
    expect((await res.json()).error).toBe('Campaign already has enough accepted creators')
    expect(prismaMock.application.update).not.toHaveBeenCalled()
  })

  it('refuses to accept past the campaign budget (409)', async () => {
    seedApplication({ campaign: { budget: 30_000, creatorsNeeded: 5 } })
    prismaMock.application.count.mockResolvedValue(0)
    prismaMock.application.aggregate.mockResolvedValue({ _sum: { proposedRate: 20_000 } })

    const res = await patch({ status: 'ACCEPTED' })

    expect(res.status).toBe(409)
    expect((await res.json()).error).toBe(
      'Accepting this application would exceed the campaign budget',
    )
    expect(prismaMock.application.update).not.toHaveBeenCalled()
  })
})

describe('PATCH /api/applications/[id] — a successful ACCEPT', () => {
  it('flips the application, notifies the creator, and starts the campaign', async () => {
    // 0 accepted before the update, 1 after — the last creator this campaign needs.
    prismaMock.application.count.mockResolvedValueOnce(0).mockResolvedValueOnce(1)

    const res = await patch({ status: 'ACCEPTED' })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.status).toBe('ACCEPTED')
    expect(body.data).not.toHaveProperty('creator')

    expect(prismaMock.application.update).toHaveBeenCalledWith({
      where: { id: APPLICATION.id },
      data: { status: 'ACCEPTED' },
    })
    expect(prismaMock.campaign.update).toHaveBeenCalledWith({
      where: { id: CAMPAIGN.id },
      data: { status: 'IN_PROGRESS' },
    })
    expect(emailMocks.sendApplicationAcceptedEmail).toHaveBeenCalledWith(CREATOR.email, {
      campaignTitle: CAMPAIGN.title,
    })
    expect(pushMocks.sendApplicationAcceptedPush).toHaveBeenCalledWith(CREATOR.id, {
      campaignTitle: CAMPAIGN.title,
    })
    expect(stripeMocks.cancelPaymentIntentIfCancelable).not.toHaveBeenCalled()
  })

  it('leaves the campaign ACTIVE while it still needs more creators', async () => {
    seedApplication({ campaign: { creatorsNeeded: 3 } })
    prismaMock.application.count.mockResolvedValueOnce(0).mockResolvedValueOnce(1)

    const res = await patch({ status: 'ACCEPTED' })

    expect(res.status).toBe(200)
    expect(prismaMock.campaign.update).not.toHaveBeenCalled()
  })
})

describe('PATCH /api/applications/[id] — a successful REJECT', () => {
  it('cancels the payment intent and clears it from the row', async () => {
    const res = await patch({ status: 'REJECTED' })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(stripeMocks.cancelPaymentIntentIfCancelable).toHaveBeenCalledWith(
      APPLICATION.paymentIntentId,
    )
    expect(prismaMock.application.update).toHaveBeenCalledWith({
      where: { id: APPLICATION.id },
      data: { status: 'REJECTED', paymentIntentId: null },
    })
    expect(body.data.paymentIntentId).toBeNull()
    expect(body.data).not.toHaveProperty('creator')
    expect(emailMocks.sendApplicationRejectedEmail).toHaveBeenCalledWith(CREATOR.email, {
      campaignTitle: CAMPAIGN.title,
    })
    expect(pushMocks.sendApplicationRejectedPush).toHaveBeenCalledWith(CREATOR.id, {
      campaignTitle: CAMPAIGN.title,
    })
  })

  // A Stripe outage must not strand the application in PENDING forever.
  it('still rejects when Stripe refuses to cancel the intent', async () => {
    stripeMocks.cancelPaymentIntentIfCancelable.mockRejectedValue(new Error('stripe is down'))

    const res = await patch({ status: 'REJECTED' })

    expect(res.status).toBe(200)
    expect(prismaMock.application.update).toHaveBeenCalled()
  })

  it('does not require a payout account to reject', async () => {
    seedApplication({ creator: { stripeAccountId: null } })

    const res = await patch({ status: 'REJECTED' })

    expect(res.status).toBe(200)
    expect(stripeMocks.validatePaymentIntentForApplication).not.toHaveBeenCalled()
  })
})

/**
 * The decision is committed inside `$transaction`; the email and push run after
 * it returns. An outage there must stay cosmetic.
 *
 * Against the pre-fix handler every case below is a 500: the rejected promise
 * escapes to the outer catch. The brand's UI then reports "Failed to accept
 * application" for a review that is already durable, and the natural retry
 * re-PATCHes a row that is no longer PENDING and comes back 409 — on REJECT,
 * after the payment intent has already been cancelled and cleared.
 */
describe('PATCH /api/applications/[id] — a notification outage does not undo a committed review', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    warnSpy.mockRestore()
  })

  const OUTAGE = new Error('notification provider is unreachable')

  it('still returns 200 and still commits the ACCEPT when the email provider is down', async () => {
    emailMocks.sendApplicationAcceptedEmail.mockRejectedValue(OUTAGE)

    const res = await patch({ status: 'ACCEPTED' })

    expect(res.status).toBe(200)
    expect(prismaMock.application.update).toHaveBeenCalledWith({
      where: { id: APPLICATION.id },
      data: { status: 'ACCEPTED' },
    })
  })

  it('still returns 200 and still commits the ACCEPT when push delivery is down', async () => {
    pushMocks.sendApplicationAcceptedPush.mockRejectedValue(OUTAGE)

    const res = await patch({ status: 'ACCEPTED' })

    expect(res.status).toBe(200)
    expect(prismaMock.application.update).toHaveBeenCalledWith({
      where: { id: APPLICATION.id },
      data: { status: 'ACCEPTED' },
    })
  })

  // The worst case: the intent is already cancelled, so a 500 here invites a
  // retry that can only ever answer 409.
  it('still returns 200 and still clears the intent on REJECT when both channels are down', async () => {
    emailMocks.sendApplicationRejectedEmail.mockRejectedValue(OUTAGE)
    pushMocks.sendApplicationRejectedPush.mockRejectedValue(OUTAGE)

    const res = await patch({ status: 'REJECTED' })

    expect(res.status).toBe(200)
    expect(prismaMock.application.update).toHaveBeenCalledWith({
      where: { id: APPLICATION.id },
      data: { status: 'REJECTED', paymentIntentId: null },
    })
  })

  it('still attempts the push after the email fails — one dead channel is not two', async () => {
    emailMocks.sendApplicationAcceptedEmail.mockRejectedValue(OUTAGE)

    const res = await patch({ status: 'ACCEPTED' })

    expect(res.status).toBe(200)
    expect(pushMocks.sendApplicationAcceptedPush).toHaveBeenCalledWith(CREATOR.id, {
      campaignTitle: CAMPAIGN.title,
    })
  })

  // Swallowed is not the same as hidden: the failure has to leave a trace.
  it('logs the failure rather than dropping it silently', async () => {
    emailMocks.sendApplicationAcceptedEmail.mockRejectedValue(OUTAGE)

    await patch({ status: 'ACCEPTED' })

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('/api/applications/[id]'), OUTAGE)
  })
})
