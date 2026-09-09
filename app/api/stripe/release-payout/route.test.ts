import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * `POST /api/stripe/release-payout` is the button that actually moves money:
 * it hands the submission and the stored intent id to `lib/payout.ts`, which
 * captures the authorization. This route owns the authorization boundary —
 * only the brand that owns the campaign may release a creator's money — and
 * the guarantee that nothing is captured on a half-formed record.
 *
 * `releasePayout` itself is mocked here; its behaviour is covered in
 * `lib/payout.test.ts`.
 */
const {
  authMock,
  requireTesterApiUserMock,
  userFindUniqueMock,
  submissionFindUniqueMock,
  releasePayoutMock,
  checkRateLimitMock,
  getRequestIpMock,
  isTrustedOriginMock,
} = vi.hoisted(() => ({
  authMock: vi.fn(),
  requireTesterApiUserMock: vi.fn(),
  userFindUniqueMock: vi.fn(),
  submissionFindUniqueMock: vi.fn(),
  releasePayoutMock: vi.fn(),
  checkRateLimitMock: vi.fn(),
  getRequestIpMock: vi.fn(),
  isTrustedOriginMock: vi.fn(),
}))

vi.mock('@clerk/nextjs/server', () => ({ auth: authMock }))

vi.mock('@/lib/admin-api-guard', () => ({ requireTesterApiUser: requireTesterApiUserMock }))

vi.mock('@/lib/prisma', () => ({
  default: {
    user: { findUnique: userFindUniqueMock },
    submission: { findUnique: submissionFindUniqueMock },
  },
}))

vi.mock('@/lib/payout', () => ({ releasePayout: releasePayoutMock }))

vi.mock('@/lib/request-security', () => ({
  checkRateLimit: checkRateLimitMock,
  getRequestIp: getRequestIpMock,
  isTrustedOrigin: isTrustedOriginMock,
}))

const { POST } = await import('./route')

const BRAND_ID = 'user_brand'
const OTHER_BRAND_ID = 'user_other_brand'
const SUBMISSION_ID = 'sub_1'
const APPLICATION_ID = 'app_1'
const CAMPAIGN_ID = 'camp_1'
const INTENT_ID = 'pi_authorized'
const CREATOR_CLERK_ID = 'clerk_creator_secret'
const CREATOR_ACCOUNT = 'acct_creator_live'
const CREATOR_EMAIL = 'creator@example.com'

function post(body: unknown): Request {
  return new Request('https://www.creatordocks.com/api/stripe/release-payout', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

function buildBrand(overrides: Record<string, unknown> = {}) {
  return { id: BRAND_ID, role: 'BRAND', ...overrides }
}

function buildCampaign(overrides: Record<string, unknown> = {}) {
  return { id: CAMPAIGN_ID, brandId: BRAND_ID, budget: 500_000, status: 'ACTIVE', ...overrides }
}

/** The creator identity rides along on the include — it must not be echoed. */
function buildCreator(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user_creator',
    clerkId: CREATOR_CLERK_ID,
    email: CREATOR_EMAIL,
    stripeAccountId: CREATOR_ACCOUNT,
    ...overrides,
  }
}

function buildApplication(overrides: Record<string, unknown> = {}) {
  return {
    id: APPLICATION_ID,
    status: 'ACCEPTED',
    paymentIntentId: INTENT_ID,
    proposedRate: 9_999,
    campaignId: CAMPAIGN_ID,
    campaign: buildCampaign(),
    creator: buildCreator(),
    ...overrides,
  }
}

function buildSubmission(overrides: Record<string, unknown> = {}) {
  return {
    id: SUBMISSION_ID,
    status: 'PENDING',
    creatorId: 'user_creator',
    applicationId: APPLICATION_ID,
    application: buildApplication(),
    ...overrides,
  }
}

beforeEach(() => {
  authMock.mockReset()
  requireTesterApiUserMock.mockReset()
  userFindUniqueMock.mockReset()
  submissionFindUniqueMock.mockReset()
  releasePayoutMock.mockReset()
  checkRateLimitMock.mockReset()
  getRequestIpMock.mockReset()
  isTrustedOriginMock.mockReset()

  isTrustedOriginMock.mockReturnValue(true)
  requireTesterApiUserMock.mockResolvedValue({ response: null })
  authMock.mockResolvedValue({ userId: 'clerk_brand' })
  userFindUniqueMock.mockResolvedValue(buildBrand())
  submissionFindUniqueMock.mockResolvedValue(buildSubmission())
  releasePayoutMock.mockResolvedValue(undefined)
  checkRateLimitMock.mockResolvedValue({ ok: true, retryAfterSeconds: 0 })
  getRequestIpMock.mockReturnValue('1.2.3.4')
})

describe('POST /api/stripe/release-payout — the happy path', () => {
  it('releases the payout for the stored intent, not one supplied by the caller', async () => {
    const res = await POST(post({ submissionId: SUBMISSION_ID, paymentIntentId: 'pi_attacker' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ success: true })
    // The intent id comes from the application row; the request body is ignored.
    expect(releasePayoutMock).toHaveBeenCalledTimes(1)
    expect(releasePayoutMock).toHaveBeenCalledWith(SUBMISSION_ID, INTENT_ID)
  })

  it('looks the caller up by their Clerk id and selects no more than it needs', async () => {
    await POST(post({ submissionId: SUBMISSION_ID }))

    expect(userFindUniqueMock).toHaveBeenCalledWith({
      where: { clerkId: 'clerk_brand' },
      select: { id: true, role: true },
    })
  })
})

describe('POST /api/stripe/release-payout — who may release money', () => {
  it('rejects a request from an untrusted origin', async () => {
    isTrustedOriginMock.mockReturnValue(false)

    const res = await POST(post({ submissionId: SUBMISSION_ID }))

    expect(res.status).toBe(403)
    expect(releasePayoutMock).not.toHaveBeenCalled()
  })

  it('rejects an unauthenticated caller', async () => {
    authMock.mockResolvedValue({ userId: null })

    const res = await POST(post({ submissionId: SUBMISSION_ID }))

    expect(res.status).toBe(401)
    expect(releasePayoutMock).not.toHaveBeenCalled()
  })

  it('honours the tester gate', async () => {
    requireTesterApiUserMock.mockResolvedValue({
      response: Response.json({ error: 'Forbidden' }, { status: 403 }),
    })

    const res = await POST(post({ submissionId: SUBMISSION_ID }))

    expect(res.status).toBe(403)
    expect(releasePayoutMock).not.toHaveBeenCalled()
  })

  it('404s when the caller has no user row', async () => {
    userFindUniqueMock.mockResolvedValue(null)

    const res = await POST(post({ submissionId: SUBMISSION_ID }))

    expect(res.status).toBe(404)
    expect(releasePayoutMock).not.toHaveBeenCalled()
  })

  it.each(['CREATOR', 'ADMIN'])('refuses a %s: only the paying brand may release', async role => {
    userFindUniqueMock.mockResolvedValue(buildBrand({ role }))

    const res = await POST(post({ submissionId: SUBMISSION_ID }))

    expect(res.status).toBe(403)
    expect(releasePayoutMock).not.toHaveBeenCalled()
  })

  it("refuses a brand releasing money on another brand's campaign", async () => {
    submissionFindUniqueMock.mockResolvedValue(
      buildSubmission({
        application: buildApplication({ campaign: buildCampaign({ brandId: OTHER_BRAND_ID }) }),
      }),
    )

    const res = await POST(post({ submissionId: SUBMISSION_ID }))
    const body = await res.json()

    expect(res.status).toBe(403)
    expect(body.error).toBe('Forbidden')
    expect(releasePayoutMock).not.toHaveBeenCalled()
  })

  it('rate limits repeated payout attempts', async () => {
    checkRateLimitMock.mockResolvedValue({ ok: false, retryAfterSeconds: 30 })

    const res = await POST(post({ submissionId: SUBMISSION_ID }))

    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBe('30')
    expect(releasePayoutMock).not.toHaveBeenCalled()
  })

  it('keys the rate limit to the caller so one brand cannot lock out another', async () => {
    await POST(post({ submissionId: SUBMISSION_ID }))

    expect(checkRateLimitMock).toHaveBeenCalledWith(
      `stripe:release-payout:${BRAND_ID}:1.2.3.4`,
      { limit: 10, windowMs: 60_000 },
    )
  })
})

describe('POST /api/stripe/release-payout — nothing is captured on a bad record', () => {
  it.each([[''], [null], [42], [undefined]])(
    'rejects a malformed submissionId (%p)',
    async submissionId => {
      const res = await POST(post({ submissionId }))

      expect(res.status).toBe(400)
      expect(releasePayoutMock).not.toHaveBeenCalled()
    },
  )

  it('404s on an unknown submission', async () => {
    submissionFindUniqueMock.mockResolvedValue(null)

    const res = await POST(post({ submissionId: 'sub_missing' }))

    expect(res.status).toBe(404)
    expect(releasePayoutMock).not.toHaveBeenCalled()
  })

  it('refuses to release when no card was ever authorized', async () => {
    submissionFindUniqueMock.mockResolvedValue(
      buildSubmission({ application: buildApplication({ paymentIntentId: null }) }),
    )

    const res = await POST(post({ submissionId: SUBMISSION_ID }))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toBe('No payment authorization was found for this application')
    expect(releasePayoutMock).not.toHaveBeenCalled()
  })

  it('surfaces a generic failure when the capture throws, without leaking Stripe internals', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    releasePayoutMock.mockRejectedValue(
      new Error(`No such payment_intent: ${INTENT_ID}; api_key sk_live_must_not_leak`),
    )

    const res = await POST(post({ submissionId: SUBMISSION_ID }))
    const body = await res.json()
    const serialized = JSON.stringify(body)

    expect(res.status).toBe(500)
    expect(body.error).toBe('Internal server error')
    expect(serialized).not.toContain('sk_live')
    expect(serialized).not.toContain(INTENT_ID)

    // The detail still reaches the server log for debugging.
    expect(errorSpy).toHaveBeenCalledWith('[POST /api/stripe/release-payout]', expect.any(Error))

    errorSpy.mockRestore()
  })

  it('reports a rejected payout as a failure, not a success', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    releasePayoutMock.mockRejectedValue(new Error('Only accepted applications can release payouts'))

    const res = await POST(post({ submissionId: SUBMISSION_ID }))
    const body = await res.json()

    expect(res.ok).toBe(false)
    expect(body.success).toBeUndefined()

    errorSpy.mockRestore()
  })
})

describe('POST /api/stripe/release-payout — what the brand is told', () => {
  it('returns a bare success and none of the creator identity', async () => {
    const res = await POST(post({ submissionId: SUBMISSION_ID }))
    const body = await res.json()
    const serialized = JSON.stringify(body)

    expect(body).toEqual({ success: true })
    expect(serialized).not.toContain(CREATOR_CLERK_ID)
    expect(serialized).not.toContain(CREATOR_ACCOUNT)
    expect(serialized).not.toContain(CREATOR_EMAIL)
    expect(serialized).not.toContain(INTENT_ID)
  })

  it.each([
    ['forbidden', () => submissionFindUniqueMock.mockResolvedValue(
      buildSubmission({
        application: buildApplication({ campaign: buildCampaign({ brandId: OTHER_BRAND_ID }) }),
      }),
    )],
    ['unauthorized payment', () => submissionFindUniqueMock.mockResolvedValue(
      buildSubmission({ application: buildApplication({ paymentIntentId: null }) }),
    )],
  ])('never leaks the creator identity on the %s error path', async (_label, arrange) => {
    arrange()

    const res = await POST(post({ submissionId: SUBMISSION_ID }))
    const serialized = JSON.stringify(await res.json())

    expect(res.ok).toBe(false)
    expect(serialized).not.toContain(CREATOR_CLERK_ID)
    expect(serialized).not.toContain(CREATOR_ACCOUNT)
    expect(serialized).not.toContain(CREATOR_EMAIL)
  })
})
