import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * `POST /api/stripe/create-intent` is where a brand's card is authorized. It
 * builds a destination charge with `capture_method: 'manual'` and a 15%
 * `application_fee_amount` (docs/PROJECT-STATE.md §4); nothing is captured
 * here. These tests guard the money-shaped parameters and the ownership
 * boundary — the amount, the fee, the destination account, and who is allowed
 * to put a hold on whose card.
 */
const {
  authMock,
  requireTesterApiUserMock,
  userFindUniqueMock,
  applicationFindUniqueMock,
  applicationUpdateMock,
  paymentIntentsCreateMock,
  validateIntentMock,
  checkRateLimitMock,
  getRequestIpMock,
  isTrustedOriginMock,
  calculatePlatformFeeMock,
} = vi.hoisted(() => ({
  authMock: vi.fn(),
  requireTesterApiUserMock: vi.fn(),
  userFindUniqueMock: vi.fn(),
  applicationFindUniqueMock: vi.fn(),
  applicationUpdateMock: vi.fn(),
  paymentIntentsCreateMock: vi.fn(),
  validateIntentMock: vi.fn(),
  checkRateLimitMock: vi.fn(),
  getRequestIpMock: vi.fn(),
  isTrustedOriginMock: vi.fn(),
  calculatePlatformFeeMock: vi.fn(),
}))

vi.mock('@clerk/nextjs/server', () => ({ auth: authMock }))

vi.mock('@/lib/admin-api-guard', () => ({ requireTesterApiUser: requireTesterApiUserMock }))

vi.mock('@/lib/prisma', () => ({
  default: {
    user: { findUnique: userFindUniqueMock },
    application: { findUnique: applicationFindUniqueMock, update: applicationUpdateMock },
  },
}))

vi.mock('@/lib/stripe', () => ({
  stripe: { paymentIntents: { create: paymentIntentsCreateMock } },
}))

vi.mock('@/lib/stripe-payments', () => ({
  validatePaymentIntentForApplication: validateIntentMock,
}))

vi.mock('@/lib/request-security', () => ({
  checkRateLimit: checkRateLimitMock,
  getRequestIp: getRequestIpMock,
  isTrustedOrigin: isTrustedOriginMock,
}))

/**
 * `calculatePlatformFee` runs for real by default — the fee arithmetic below is
 * genuinely exercised, not stubbed. The seam exists only so one test can
 * simulate a misconfigured fee rate (`PLATFORM_FEE_RATE` is a function, so a
 * rate of 1.0 or more is a one-line change away) and prove the route refuses to
 * charge a card when the platform's cut would swallow the whole payment.
 */
vi.mock('@/lib/utils', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/utils')>()
  return { ...actual, calculatePlatformFee: calculatePlatformFeeMock }
})

const { calculatePlatformFee } = await vi.importActual<typeof import('@/lib/utils')>('@/lib/utils')

const { POST } = await import('./route')

const BRAND_ID = 'user_brand'
const OTHER_BRAND_ID = 'user_other_brand'
const APPLICATION_ID = 'app_1'
const CAMPAIGN_ID = 'camp_1'
/** The creator's connected account — the only legitimate destination. */
const CREATOR_ACCOUNT = 'acct_creator_live'
/** The platform's own account. Money must never be routed here. */
const PLATFORM_ACCOUNT = 'acct_platform_house'

/** $99.99 — deliberately does not divide evenly by 15%. */
const RATE_CENTS = 9_999
const FEE_CENTS = 1_500

const CREATOR_CLERK_ID = 'clerk_creator_secret'
const CREATOR_EMAIL = 'creator@example.com'

function post(body: unknown): Request {
  return new Request('https://www.creatordocks.com/api/stripe/create-intent', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

function buildBrand(overrides: Record<string, unknown> = {}) {
  return { id: BRAND_ID, clerkId: 'clerk_brand', role: 'BRAND', ...overrides }
}

/** The full creator row, as Prisma returns it — the shape that must NOT be echoed. */
function buildCreator(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user_creator',
    clerkId: CREATOR_CLERK_ID,
    email: CREATOR_EMAIL,
    name: 'Creator Person',
    stripeAccountId: CREATOR_ACCOUNT,
    stripeOnboarded: true,
    ...overrides,
  }
}

function buildCampaign(overrides: Record<string, unknown> = {}) {
  return {
    id: CAMPAIGN_ID,
    brandId: BRAND_ID,
    budget: 500_000,
    creatorsNeeded: 1,
    status: 'ACTIVE',
    ...overrides,
  }
}

function buildApplication(overrides: Record<string, unknown> = {}) {
  return {
    id: APPLICATION_ID,
    status: 'PENDING',
    paymentIntentId: null,
    proposedRate: RATE_CENTS,
    campaignId: CAMPAIGN_ID,
    campaign: buildCampaign(),
    creator: buildCreator(),
    ...overrides,
  }
}

beforeEach(() => {
  authMock.mockReset()
  requireTesterApiUserMock.mockReset()
  userFindUniqueMock.mockReset()
  applicationFindUniqueMock.mockReset()
  applicationUpdateMock.mockReset()
  paymentIntentsCreateMock.mockReset()
  validateIntentMock.mockReset()
  checkRateLimitMock.mockReset()
  getRequestIpMock.mockReset()
  isTrustedOriginMock.mockReset()
  calculatePlatformFeeMock.mockReset()

  calculatePlatformFeeMock.mockImplementation(calculatePlatformFee)
  isTrustedOriginMock.mockReturnValue(true)
  requireTesterApiUserMock.mockResolvedValue({ response: null })
  authMock.mockResolvedValue({ userId: 'clerk_brand' })
  userFindUniqueMock.mockResolvedValue(buildBrand())
  applicationFindUniqueMock.mockResolvedValue(buildApplication())
  applicationUpdateMock.mockResolvedValue({ id: APPLICATION_ID })
  checkRateLimitMock.mockResolvedValue({ ok: true, retryAfterSeconds: 0 })
  getRequestIpMock.mockReturnValue('1.2.3.4')
  paymentIntentsCreateMock.mockResolvedValue({
    id: 'pi_new',
    client_secret: 'pi_new_secret_abc',
    status: 'requires_payment_method',
  })
})

describe('POST /api/stripe/create-intent — the destination charge it builds', () => {
  it('authorizes the exact proposed rate with a manual capture and a 15% fee', async () => {
    const res = await POST(post({ applicationId: APPLICATION_ID }))

    expect(res.status).toBe(200)
    expect(paymentIntentsCreateMock).toHaveBeenCalledTimes(1)

    const params = paymentIntentsCreateMock.mock.calls[0][0]
    expect(params.amount).toBe(RATE_CENTS)
    expect(params.currency).toBe('usd')
    expect(params.capture_method).toBe('manual')
    expect(params.application_fee_amount).toBe(FEE_CENTS)
    expect(params.application_fee_amount).toBe(calculatePlatformFee(RATE_CENTS))
    expect(Number.isInteger(params.amount)).toBe(true)
    expect(Number.isInteger(params.application_fee_amount)).toBe(true)
  })

  it('sends the money to the creator connected account, not the platform', async () => {
    await POST(post({ applicationId: APPLICATION_ID }))

    const params = paymentIntentsCreateMock.mock.calls[0][0]
    expect(params.transfer_data).toEqual({ destination: CREATOR_ACCOUNT })
    expect(params.transfer_data.destination).not.toBe(PLATFORM_ACCOUNT)
    expect(params.on_behalf_of).toBeUndefined()
  })

  it('stamps the intent with the application and campaign it belongs to', async () => {
    await POST(post({ applicationId: APPLICATION_ID }))

    const params = paymentIntentsCreateMock.mock.calls[0][0]
    expect(params.metadata).toEqual({ applicationId: APPLICATION_ID, campaignId: CAMPAIGN_ID })
  })

  it('uses a per-application idempotency key so a double click cannot double-authorize', async () => {
    await POST(post({ applicationId: APPLICATION_ID }))
    await POST(post({ applicationId: APPLICATION_ID }))

    const keys = paymentIntentsCreateMock.mock.calls.map(call => call[1].idempotencyKey)
    expect(keys).toEqual([
      `application:${APPLICATION_ID}:payment-intent`,
      `application:${APPLICATION_ID}:payment-intent`,
    ])
  })

  it('stores the intent id on the application so the capture can be matched later', async () => {
    await POST(post({ applicationId: APPLICATION_ID }))

    expect(applicationUpdateMock).toHaveBeenCalledWith({
      where: { id: APPLICATION_ID },
      data: { paymentIntentId: 'pi_new' },
    })
  })

  it('rounds an uneven rate to whole cents on both sides of the split', async () => {
    // $33.33 -> 15% is 499.95 cents. Neither side may see a fraction.
    applicationFindUniqueMock.mockResolvedValue(buildApplication({ proposedRate: 3_333 }))

    await POST(post({ applicationId: APPLICATION_ID }))

    const params = paymentIntentsCreateMock.mock.calls[0][0]
    expect(params.application_fee_amount).toBe(500)
    expect(params.amount - params.application_fee_amount).toBe(2_833)
    expect(Number.isInteger(params.application_fee_amount)).toBe(true)
  })
})

describe('POST /api/stripe/create-intent — who may authorize a payment', () => {
  it('rejects a request from an untrusted origin before touching Stripe', async () => {
    isTrustedOriginMock.mockReturnValue(false)

    const res = await POST(post({ applicationId: APPLICATION_ID }))

    expect(res.status).toBe(403)
    expect(paymentIntentsCreateMock).not.toHaveBeenCalled()
  })

  it('rejects an unauthenticated caller', async () => {
    authMock.mockResolvedValue({ userId: null })

    const res = await POST(post({ applicationId: APPLICATION_ID }))

    expect(res.status).toBe(401)
    expect(paymentIntentsCreateMock).not.toHaveBeenCalled()
  })

  it('honours the tester gate', async () => {
    requireTesterApiUserMock.mockResolvedValue({
      response: Response.json({ error: 'Forbidden' }, { status: 403 }),
    })

    const res = await POST(post({ applicationId: APPLICATION_ID }))

    expect(res.status).toBe(403)
    expect(paymentIntentsCreateMock).not.toHaveBeenCalled()
  })

  it('rejects a creator trying to authorize a payment to themselves', async () => {
    userFindUniqueMock.mockResolvedValue(buildBrand({ role: 'CREATOR' }))

    const res = await POST(post({ applicationId: APPLICATION_ID }))

    expect(res.status).toBe(403)
    expect(paymentIntentsCreateMock).not.toHaveBeenCalled()
  })

  it("refuses a brand funding another brand's application", async () => {
    applicationFindUniqueMock.mockResolvedValue(
      buildApplication({ campaign: buildCampaign({ brandId: OTHER_BRAND_ID }) }),
    )

    const res = await POST(post({ applicationId: APPLICATION_ID }))
    const body = await res.json()

    expect(res.status).toBe(403)
    expect(body.error).toBe('Forbidden')
    expect(paymentIntentsCreateMock).not.toHaveBeenCalled()
    expect(applicationUpdateMock).not.toHaveBeenCalled()
  })

  it('rate limits repeated authorization attempts', async () => {
    checkRateLimitMock.mockResolvedValue({ ok: false, retryAfterSeconds: 42 })

    const res = await POST(post({ applicationId: APPLICATION_ID }))

    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBe('42')
    expect(paymentIntentsCreateMock).not.toHaveBeenCalled()
  })

  it('404s on an unknown application rather than creating a stray intent', async () => {
    applicationFindUniqueMock.mockResolvedValue(null)

    const res = await POST(post({ applicationId: 'app_missing' }))

    expect(res.status).toBe(404)
    expect(paymentIntentsCreateMock).not.toHaveBeenCalled()
  })

  it.each([[''], [null], [123], [undefined]])(
    'rejects a malformed applicationId (%p)',
    async applicationId => {
      const res = await POST(post({ applicationId }))

      expect(res.status).toBe(400)
      expect(paymentIntentsCreateMock).not.toHaveBeenCalled()
    },
  )
})

describe('POST /api/stripe/create-intent — the creator must be payable', () => {
  it('refuses to authorize against a creator with no Stripe account', async () => {
    applicationFindUniqueMock.mockResolvedValue(
      buildApplication({ creator: buildCreator({ stripeAccountId: null }) }),
    )

    const res = await POST(post({ applicationId: APPLICATION_ID }))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toBe('Creator has not connected Stripe')
    expect(paymentIntentsCreateMock).not.toHaveBeenCalled()
    expect(applicationUpdateMock).not.toHaveBeenCalled()
  })

  it('refuses a creator whose Connect onboarding is unfinished', async () => {
    applicationFindUniqueMock.mockResolvedValue(
      buildApplication({ creator: buildCreator({ stripeOnboarded: false }) }),
    )

    const res = await POST(post({ applicationId: APPLICATION_ID }))

    expect(res.status).toBe(400)
    expect(paymentIntentsCreateMock).not.toHaveBeenCalled()
  })

  it('refuses an application that is no longer pending', async () => {
    applicationFindUniqueMock.mockResolvedValue(buildApplication({ status: 'ACCEPTED' }))

    const res = await POST(post({ applicationId: APPLICATION_ID }))

    expect(res.status).toBe(409)
    expect(paymentIntentsCreateMock).not.toHaveBeenCalled()
  })

  it('refuses to fund an application on a campaign that is not active', async () => {
    applicationFindUniqueMock.mockResolvedValue(
      buildApplication({ campaign: buildCampaign({ status: 'COMPLETE' }) }),
    )

    const res = await POST(post({ applicationId: APPLICATION_ID }))

    expect(res.status).toBe(409)
    expect(paymentIntentsCreateMock).not.toHaveBeenCalled()
  })
})

describe('POST /api/stripe/create-intent — an intent that already exists', () => {
  it('reports an existing authorization instead of holding the card twice', async () => {
    applicationFindUniqueMock.mockResolvedValue(buildApplication({ paymentIntentId: 'pi_existing' }))
    validateIntentMock.mockResolvedValue({
      status: 'requires_capture',
      client_secret: 'pi_existing_secret',
    })

    const res = await POST(post({ applicationId: APPLICATION_ID }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ paymentAuthorized: true })
    expect(paymentIntentsCreateMock).not.toHaveBeenCalled()
  })

  it('validates the existing intent against the creator account, not the platform', async () => {
    applicationFindUniqueMock.mockResolvedValue(buildApplication({ paymentIntentId: 'pi_existing' }))
    validateIntentMock.mockResolvedValue({
      status: 'requires_capture',
      client_secret: 'pi_existing_secret',
    })

    await POST(post({ applicationId: APPLICATION_ID }))

    expect(validateIntentMock).toHaveBeenCalledWith(
      expect.objectContaining({ destinationAccountId: CREATOR_ACCOUNT }),
    )
  })

  it('refuses a second authorization while a payment is already in flight', async () => {
    applicationFindUniqueMock.mockResolvedValue(buildApplication({ paymentIntentId: 'pi_existing' }))
    validateIntentMock.mockResolvedValue({ status: 'processing', client_secret: 'pi_existing_secret' })

    const res = await POST(post({ applicationId: APPLICATION_ID }))
    const body = await res.json()

    expect(res.status).toBe(409)
    expect(body.error).toBe('A payment is already in progress for this application')
    expect(paymentIntentsCreateMock).not.toHaveBeenCalled()
  })

  it('refuses to re-authorize an intent that already succeeded', async () => {
    applicationFindUniqueMock.mockResolvedValue(buildApplication({ paymentIntentId: 'pi_existing' }))
    validateIntentMock.mockResolvedValue({ status: 'succeeded', client_secret: 'pi_existing_secret' })

    const res = await POST(post({ applicationId: APPLICATION_ID }))

    expect(res.status).toBe(409)
    expect(paymentIntentsCreateMock).not.toHaveBeenCalled()
  })

  it('hands back the unfinished intent so the brand can finish paying it', async () => {
    applicationFindUniqueMock.mockResolvedValue(buildApplication({ paymentIntentId: 'pi_existing' }))
    validateIntentMock.mockResolvedValue({
      status: 'requires_confirmation',
      client_secret: 'pi_existing_secret',
    })

    const res = await POST(post({ applicationId: APPLICATION_ID }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ clientSecret: 'pi_existing_secret' })
    expect(paymentIntentsCreateMock).not.toHaveBeenCalled()
  })

  it('falls back to a fresh, correctly-shaped intent when the stored one does not validate', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    applicationFindUniqueMock.mockResolvedValue(buildApplication({ paymentIntentId: 'pi_stale' }))
    validateIntentMock.mockRejectedValue(new Error('Payment intent destination does not match'))

    const res = await POST(post({ applicationId: APPLICATION_ID }))

    expect(res.status).toBe(200)
    expect(paymentIntentsCreateMock).toHaveBeenCalledTimes(1)
    const params = paymentIntentsCreateMock.mock.calls[0][0]
    expect(params.transfer_data).toEqual({ destination: CREATOR_ACCOUNT })
    expect(params.application_fee_amount).toBe(FEE_CENTS)

    warnSpy.mockRestore()
  })
})

describe('POST /api/stripe/create-intent — what the brand is told', () => {
  it('returns only the client secret, never the creator identity', async () => {
    const res = await POST(post({ applicationId: APPLICATION_ID }))
    const body = await res.json()
    const serialized = JSON.stringify(body)

    expect(res.status).toBe(200)
    expect(body).toEqual({ clientSecret: 'pi_new_secret_abc' })
    expect(serialized).not.toContain(CREATOR_CLERK_ID)
    expect(serialized).not.toContain(CREATOR_ACCOUNT)
    expect(serialized).not.toContain(CREATOR_EMAIL)
  })

  it.each([
    ['forbidden', () => applicationFindUniqueMock.mockResolvedValue(
      buildApplication({ campaign: buildCampaign({ brandId: OTHER_BRAND_ID }) }),
    )],
    ['unpayable creator', () => applicationFindUniqueMock.mockResolvedValue(
      buildApplication({ creator: buildCreator({ stripeOnboarded: false }) }),
    )],
    ['already accepted', () => applicationFindUniqueMock.mockResolvedValue(
      buildApplication({ status: 'ACCEPTED' }),
    )],
  ])('never leaks the creator identity on the %s error path', async (_label, arrange) => {
    arrange()

    const res = await POST(post({ applicationId: APPLICATION_ID }))
    const serialized = JSON.stringify(await res.json())

    expect(res.ok).toBe(false)
    expect(serialized).not.toContain(CREATOR_CLERK_ID)
    expect(serialized).not.toContain(CREATOR_ACCOUNT)
    expect(serialized).not.toContain(CREATOR_EMAIL)
  })

  it('never leaks Stripe internals when the create call fails', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    paymentIntentsCreateMock.mockRejectedValue(
      new Error('No such account: acct_creator_live; api_key sk_live_must_not_leak'),
    )

    const res = await POST(post({ applicationId: APPLICATION_ID }))
    const body = await res.json()
    const serialized = JSON.stringify(body)

    expect(res.status).toBe(500)
    expect(body.error).toBe('Internal server error')
    expect(serialized).not.toContain('sk_live')
    expect(serialized).not.toContain(CREATOR_ACCOUNT)
    expect(applicationUpdateMock).not.toHaveBeenCalled()

    errorSpy.mockRestore()
  })
})

/**
 * The amount is the only number in this request that becomes a hold on a real
 * card. `Application.proposedRate` is a plain `Int` column with no database
 * check constraint; the 100..10,000,000 cent bound lives in the zod schemas of
 * POST /api/applications and POST /api/v1/applications, which run at a different
 * time, on a different request, possibly months earlier. This route re-checks
 * the amount itself rather than trusting the row — the money boundary is the
 * last place a bad number can still be stopped.
 */
describe('POST /api/stripe/create-intent — the amount must be fundable', () => {
  it.each([
    [0, 'zero'],
    [-1, 'one cent negative'],
    [-5_000, 'negative'],
  ])('refuses to authorize a %i cent (%s) rate, and never reaches Stripe', async rate => {
    applicationFindUniqueMock.mockResolvedValue(buildApplication({ proposedRate: rate }))

    const res = await POST(post({ applicationId: APPLICATION_ID }))
    const body = await res.json()

    expect(res.status).toBe(422)
    expect(body.error).toMatch(/valid rate/i)
    expect(paymentIntentsCreateMock).not.toHaveBeenCalled()
    expect(applicationUpdateMock).not.toHaveBeenCalled()
  })

  it.each([[1_999.5], [Number.NaN], [Number.POSITIVE_INFINITY]])(
    'refuses a rate that is not a whole number of cents (%p)',
    async rate => {
      applicationFindUniqueMock.mockResolvedValue(buildApplication({ proposedRate: rate }))

      const res = await POST(post({ applicationId: APPLICATION_ID }))

      expect(res.status).toBe(422)
      expect(paymentIntentsCreateMock).not.toHaveBeenCalled()
    },
  )

  it('refuses a rate below the 100 cent floor the application schema enforces', async () => {
    applicationFindUniqueMock.mockResolvedValue(buildApplication({ proposedRate: 50 }))

    const res = await POST(post({ applicationId: APPLICATION_ID }))
    const body = await res.json()

    expect(res.status).toBe(422)
    expect(body.error).toMatch(/minimum/i)
    expect(paymentIntentsCreateMock).not.toHaveBeenCalled()
  })

  it('refuses a rate above the 10,000,000 cent ceiling', async () => {
    applicationFindUniqueMock.mockResolvedValue(buildApplication({ proposedRate: 10_000_001 }))

    const res = await POST(post({ applicationId: APPLICATION_ID }))
    const body = await res.json()

    expect(res.status).toBe(422)
    expect(body.error).toMatch(/maximum/i)
    expect(paymentIntentsCreateMock).not.toHaveBeenCalled()
  })

  it.each([
    [100, 15],
    [10_000_000, 1_500_000],
  ])('still authorizes a legal boundary rate of %i cents (fee %i)', async (rate, fee) => {
    applicationFindUniqueMock.mockResolvedValue(buildApplication({ proposedRate: rate }))

    const res = await POST(post({ applicationId: APPLICATION_ID }))

    expect(res.status).toBe(200)
    const params = paymentIntentsCreateMock.mock.calls[0][0]
    expect(params.amount).toBe(rate)
    expect(params.application_fee_amount).toBe(fee)
    expect(params.application_fee_amount).toBeLessThan(params.amount)
  })

  it('blocks an unfundable rate before even looking at an intent that already exists', async () => {
    applicationFindUniqueMock.mockResolvedValue(
      buildApplication({ proposedRate: 0, paymentIntentId: 'pi_existing' }),
    )

    const res = await POST(post({ applicationId: APPLICATION_ID }))

    // No branch of this route may hand back a client secret for a zero-amount
    // application — not the create path, and not the resume path either.
    expect(res.status).toBe(422)
    expect(validateIntentMock).not.toHaveBeenCalled()
    expect(paymentIntentsCreateMock).not.toHaveBeenCalled()
    expect(applicationUpdateMock).not.toHaveBeenCalled()
  })

  it('does not name the creator when it rejects an unfundable rate', async () => {
    applicationFindUniqueMock.mockResolvedValue(buildApplication({ proposedRate: -5_000 }))

    const res = await POST(post({ applicationId: APPLICATION_ID }))
    const serialized = JSON.stringify(await res.json())

    expect(res.status).toBe(422)
    expect(serialized).not.toContain(CREATOR_CLERK_ID)
    expect(serialized).not.toContain(CREATOR_ACCOUNT)
    expect(serialized).not.toContain(CREATOR_EMAIL)
  })
})

describe('POST /api/stripe/create-intent — the platform fee may never swallow the payment', () => {
  it.each([
    [RATE_CENTS, 'equal to the whole charge'],
    [RATE_CENTS + 1, 'larger than the whole charge'],
  ])('refuses to charge the card when the fee is %i cents (%s)', async fee => {
    calculatePlatformFeeMock.mockReturnValue(fee)

    const res = await POST(post({ applicationId: APPLICATION_ID }))
    const body = await res.json()

    // A fee at or above the amount leaves the creator with nothing; Stripe
    // would reject it, but the card must not be reached at all.
    expect(res.status).toBe(422)
    expect(body.error).toMatch(/platform fee/i)
    expect(paymentIntentsCreateMock).not.toHaveBeenCalled()
    expect(applicationUpdateMock).not.toHaveBeenCalled()
  })

  it.each([[-1], [1_499.85]])('refuses a fee that is not a whole non-negative number of cents (%p)', async fee => {
    calculatePlatformFeeMock.mockReturnValue(fee)

    const res = await POST(post({ applicationId: APPLICATION_ID }))

    expect(res.status).toBe(422)
    expect(paymentIntentsCreateMock).not.toHaveBeenCalled()
  })

  it('sends the real 15% fee through untouched when it is valid', async () => {
    const res = await POST(post({ applicationId: APPLICATION_ID }))

    expect(res.status).toBe(200)
    expect(calculatePlatformFeeMock).toHaveBeenCalledWith(RATE_CENTS)
    expect(paymentIntentsCreateMock.mock.calls[0][0].application_fee_amount).toBe(
      calculatePlatformFee(RATE_CENTS),
    )
  })
})

/**
 * The window between `stripe.paymentIntents.create` returning and the row that
 * stores its id being written. Stripe knows about the intent; the database does
 * not. Nothing is captured or held yet — the intent is created unconfirmed, so
 * a hold only appears once the brand confirms with a client secret this path
 * never returns — but the id is, for the moment, lost. See the reported gap:
 * the route takes no compensating action, so recovery rests entirely on the
 * idempotency key below.
 */
describe('POST /api/stripe/create-intent — the intent id write fails after Stripe has the intent', () => {
  it('fails closed: 500, and no client secret escapes for an intent it cannot track', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    applicationUpdateMock.mockRejectedValue(new Error('connection terminated unexpectedly'))

    const res = await POST(post({ applicationId: APPLICATION_ID }))
    const body = await res.json()

    expect(paymentIntentsCreateMock).toHaveBeenCalledTimes(1)
    expect(applicationUpdateMock).toHaveBeenCalledTimes(1)
    expect(res.status).toBe(500)
    expect(body).toEqual({ error: 'Internal server error' })
    // The brand cannot confirm a payment it was never handed the secret for.
    expect(JSON.stringify(body)).not.toContain('pi_new_secret_abc')

    errorSpy.mockRestore()
  })

  it('replays the very same intent on retry rather than opening a second authorization', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    applicationUpdateMock.mockRejectedValueOnce(new Error('connection terminated unexpectedly'))

    const failed = await POST(post({ applicationId: APPLICATION_ID }))
    expect(failed.status).toBe(500)

    // The row still carries no paymentIntentId, so the retry takes the create
    // path again. The identical idempotency key is the only thing making Stripe
    // return the original intent instead of putting a second hold on the card.
    const retried = await POST(post({ applicationId: APPLICATION_ID }))
    const body = await retried.json()

    expect(retried.status).toBe(200)
    expect(body).toEqual({ clientSecret: 'pi_new_secret_abc' })

    const keys = paymentIntentsCreateMock.mock.calls.map(call => call[1].idempotencyKey)
    expect(keys).toEqual([
      `application:${APPLICATION_ID}:payment-intent`,
      `application:${APPLICATION_ID}:payment-intent`,
    ])
    expect(applicationUpdateMock).toHaveBeenLastCalledWith({
      where: { id: APPLICATION_ID },
      data: { paymentIntentId: 'pi_new' },
    })

    errorSpy.mockRestore()
  })
})
