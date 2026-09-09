import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * PATCH /api/submissions/[id] is the brand's APPROVE step: it captures a real
 * card and pays a real person. These tests drive the route with the REAL
 * `lib/payout.ts` and `lib/stripe-payments.ts` behind it, mocking only Prisma
 * and the Stripe SDK, so "the payout captured" means the actual
 * `stripe.paymentIntents.capture` call — not a stubbed helper.
 */
const {
  authMock,
  requireTesterApiUserMock,
  userFindUniqueMock,
  submissionFindUniqueMock,
  submissionFindUniqueOrThrowMock,
  submissionUpdateMock,
  transactionMock,
  payoutUpsertMock,
  payoutFindUniqueMock,
  txSubmissionUpdateMock,
  applicationCountMock,
  campaignUpdateMock,
  paymentIntentsRetrieveMock,
  paymentIntentsUpdateMock,
  paymentIntentsCaptureMock,
  checkRateLimitMock,
  getRequestIpMock,
  isTrustedOriginMock,
  sendSubmissionApprovedEmailMock,
  sendPayoutPaidEmailMock,
  sendPayoutPaidPushMock,
  sendSubmissionApprovedPushMock,
  sendSubmissionRejectedPushMock,
  sendSubmissionRevisionRequestedPushMock,
} = vi.hoisted(() => ({
  authMock: vi.fn(),
  requireTesterApiUserMock: vi.fn(),
  userFindUniqueMock: vi.fn(),
  submissionFindUniqueMock: vi.fn(),
  submissionFindUniqueOrThrowMock: vi.fn(),
  submissionUpdateMock: vi.fn(),
  transactionMock: vi.fn(),
  payoutUpsertMock: vi.fn(),
  payoutFindUniqueMock: vi.fn(),
  txSubmissionUpdateMock: vi.fn(),
  applicationCountMock: vi.fn(),
  campaignUpdateMock: vi.fn(),
  paymentIntentsRetrieveMock: vi.fn(),
  paymentIntentsUpdateMock: vi.fn(),
  paymentIntentsCaptureMock: vi.fn(),
  checkRateLimitMock: vi.fn(),
  getRequestIpMock: vi.fn(),
  isTrustedOriginMock: vi.fn(),
  sendSubmissionApprovedEmailMock: vi.fn(),
  sendPayoutPaidEmailMock: vi.fn(),
  sendPayoutPaidPushMock: vi.fn(),
  sendSubmissionApprovedPushMock: vi.fn(),
  sendSubmissionRejectedPushMock: vi.fn(),
  sendSubmissionRevisionRequestedPushMock: vi.fn(),
}))

vi.mock('@clerk/nextjs/server', () => ({ auth: authMock }))

vi.mock('@/lib/admin-api-guard', () => ({ requireTesterApiUser: requireTesterApiUserMock }))

vi.mock('@/lib/prisma', () => ({
  default: {
    user: { findUnique: userFindUniqueMock },
    submission: {
      findUnique: submissionFindUniqueMock,
      findUniqueOrThrow: submissionFindUniqueOrThrowMock,
      update: submissionUpdateMock,
    },
    $transaction: transactionMock,
  },
}))

vi.mock('@/lib/stripe', () => ({
  stripe: {
    paymentIntents: {
      retrieve: paymentIntentsRetrieveMock,
      update: paymentIntentsUpdateMock,
      capture: paymentIntentsCaptureMock,
    },
  },
}))

vi.mock('@/lib/request-security', () => ({
  checkRateLimit: checkRateLimitMock,
  getRequestIp: getRequestIpMock,
  isTrustedOrigin: isTrustedOriginMock,
}))

vi.mock('@/lib/email', () => ({
  sendSubmissionApprovedEmail: sendSubmissionApprovedEmailMock,
  // releasePayout tells the creator they were paid when this approval performs
  // the PAID transition, so the real module's export must exist on the mock.
  sendPayoutPaidEmail: sendPayoutPaidEmailMock,
}))

vi.mock('@/lib/push', () => ({
  sendSubmissionApprovedPush: sendSubmissionApprovedPushMock,
  sendPayoutPaidPush: sendPayoutPaidPushMock,
  sendSubmissionRejectedPush: sendSubmissionRejectedPushMock,
  sendSubmissionRevisionRequestedPush: sendSubmissionRevisionRequestedPushMock,
}))

const { PATCH } = await import('./route')

const BRAND_ID = 'user_brand'
const OTHER_BRAND_ID = 'user_other_brand'
const CREATOR_ID = 'user_creator'
const SUBMISSION_ID = 'sub_1'
const PROPOSED_RATE = 50_000
const PLATFORM_FEE = 7_500 // 15% of PROPOSED_RATE, per calculatePlatformFee

/** Secrets that live on the creator record and must never reach the brand. */
const CREATOR_CLERK_ID = 'clerk_creator_secret'
const CREATOR_STRIPE_ACCOUNT_ID = 'acct_creator_secret'
const CREATOR_EMAIL = 'creator@example.com'

const brandUser = {
  id: BRAND_ID,
  clerkId: 'clerk_brand',
  email: 'brand@example.com',
  role: 'BRAND' as const,
}

/** The bare submission row — the only shape the route is allowed to echo. */
function plainSubmission(status: string) {
  return {
    id: SUBMISSION_ID,
    creatorId: CREATOR_ID,
    applicationId: 'app_1',
    contentUrl: 'https://utfs.io/f/abcdef123456',
    caption: null,
    notes: null,
    status,
    reviewNote: null,
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
  }
}

const creatorWithSecrets = {
  id: CREATOR_ID,
  name: 'Creator',
  email: CREATOR_EMAIL,
  clerkId: CREATOR_CLERK_ID,
  stripeAccountId: CREATOR_STRIPE_ACCOUNT_ID,
}

type SubmissionOptions = {
  status?: string
  paymentIntentId?: string | null
  brandId?: string
  applicationStatus?: string
  refetchStatus?: string
}

/**
 * Installs the two different reads the route + payout make of the same row:
 * the route's relation-loaded read (which carries creator secrets) and the
 * bare re-read it echoes back. Returning distinct shapes is what lets the PII
 * assertions below actually bite.
 */
function useSubmission(options: SubmissionOptions = {}) {
  const status = options.status ?? 'PENDING'
  const paymentIntentId =
    'paymentIntentId' in options ? options.paymentIntentId ?? null : 'pi_1'
  const brandId = options.brandId ?? BRAND_ID
  const applicationStatus = options.applicationStatus ?? 'ACCEPTED'

  const base = plainSubmission(status)

  const application = {
    id: 'app_1',
    campaignId: 'camp_1',
    creatorId: CREATOR_ID,
    paymentIntentId,
    proposedRate: PROPOSED_RATE,
    status: applicationStatus,
  }

  const routeView = {
    ...base,
    creator: creatorWithSecrets,
    application: {
      ...application,
      campaign: { id: 'camp_1', brandId, title: 'Summer glow-up', creatorsNeeded: 1 },
    },
  }

  const payoutView = {
    ...base,
    application: {
      ...application,
      creator: creatorWithSecrets,
      campaign: { id: 'camp_1', brandId, title: 'Summer glow-up', creatorsNeeded: 1 },
    },
  }

  const refetched = plainSubmission(options.refetchStatus ?? 'APPROVED')

  submissionFindUniqueMock.mockImplementation((args: { include?: unknown }) =>
    Promise.resolve(args?.include ? routeView : refetched),
  )
  submissionFindUniqueOrThrowMock.mockResolvedValue(payoutView)

  return { routeView, payoutView, refetched }
}

function authorizedIntent(overrides: Record<string, unknown> = {}) {
  return {
    id: 'pi_1',
    amount: PROPOSED_RATE,
    currency: 'usd',
    capture_method: 'manual',
    application_fee_amount: PLATFORM_FEE,
    transfer_data: { destination: CREATOR_STRIPE_ACCOUNT_ID },
    status: 'requires_capture',
    metadata: { applicationId: 'app_1' },
    ...overrides,
  }
}

function patch(body: unknown, id = SUBMISSION_ID) {
  return [
    new Request(`https://www.creatordocks.com/api/submissions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
    }),
    { params: Promise.resolve({ id }) },
  ] as const
}

function silenceRouteErrors() {
  return vi.spyOn(console, 'error').mockImplementation(() => {})
}

describe('PATCH /api/submissions/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    isTrustedOriginMock.mockReturnValue(true)
    requireTesterApiUserMock.mockResolvedValue({ response: null })
    authMock.mockResolvedValue({ userId: brandUser.clerkId })
    userFindUniqueMock.mockResolvedValue(brandUser)
    checkRateLimitMock.mockResolvedValue({ ok: true })
    getRequestIpMock.mockReturnValue('127.0.0.1')

    paymentIntentsRetrieveMock.mockResolvedValue(authorizedIntent())
    paymentIntentsUpdateMock.mockResolvedValue(authorizedIntent())
    paymentIntentsCaptureMock.mockResolvedValue({
      id: 'pi_1',
      status: 'succeeded',
      latest_charge: 'ch_1',
    })

    transactionMock.mockImplementation(
      async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          // releasePayout reads the prior status before writing, so it can tell
          // whether THIS call performed the PAID transition and therefore owns
          // the creator's payout notification.
          payout: { upsert: payoutUpsertMock, findUnique: payoutFindUniqueMock },
          submission: { update: txSubmissionUpdateMock },
          application: { count: applicationCountMock },
          campaign: { update: campaignUpdateMock },
        }),
    )
    payoutUpsertMock.mockResolvedValue({})
    payoutFindUniqueMock.mockResolvedValue(null)
    txSubmissionUpdateMock.mockResolvedValue({})
    applicationCountMock.mockResolvedValue(1)
    campaignUpdateMock.mockResolvedValue({})
    submissionUpdateMock.mockImplementation((args: { data: { status: string } }) =>
      Promise.resolve({ ...plainSubmission(args.data.status) }),
    )
  })

  describe('gate matrix', () => {
    it('refuses an untrusted origin with 403 before touching auth or Stripe', async () => {
      isTrustedOriginMock.mockReturnValue(false)

      const res = await PATCH(...patch({ status: 'APPROVED' }))

      expect(res.status).toBe(403)
      expect(await res.json()).toEqual({ error: 'Invalid request origin' })
      expect(authMock).not.toHaveBeenCalled()
      expect(paymentIntentsCaptureMock).not.toHaveBeenCalled()
    })

    it('returns the tester gate response when the tester guard refuses', async () => {
      requireTesterApiUserMock.mockResolvedValue({
        response: Response.json({ error: 'Testers only' }, { status: 403 }),
      })

      const res = await PATCH(...patch({ status: 'APPROVED' }))

      expect(res.status).toBe(403)
      expect(authMock).not.toHaveBeenCalled()
      expect(paymentIntentsCaptureMock).not.toHaveBeenCalled()
    })

    it('refuses an unauthenticated caller with 401', async () => {
      authMock.mockResolvedValue({ userId: null })

      const res = await PATCH(...patch({ status: 'APPROVED' }))

      expect(res.status).toBe(401)
      expect(await res.json()).toEqual({ error: 'Unauthorized' })
      expect(paymentIntentsCaptureMock).not.toHaveBeenCalled()
    })

    it('returns 404 when the Clerk session has no local user row', async () => {
      userFindUniqueMock.mockResolvedValue(null)

      const res = await PATCH(...patch({ status: 'APPROVED' }))

      expect(res.status).toBe(404)
      expect(paymentIntentsCaptureMock).not.toHaveBeenCalled()
    })

    it.each([['CREATOR'], ['ADMIN']])('refuses a %s caller with 403', async role => {
      userFindUniqueMock.mockResolvedValue({ ...brandUser, role })

      const res = await PATCH(...patch({ status: 'APPROVED' }))

      expect(res.status).toBe(403)
      expect(await res.json()).toEqual({ error: 'Only brands can review submissions' })
      expect(paymentIntentsCaptureMock).not.toHaveBeenCalled()
    })

    it('refuses a rate-limited brand with 429 and a Retry-After header', async () => {
      checkRateLimitMock.mockResolvedValue({ ok: false, retryAfterSeconds: 42 })

      const res = await PATCH(...patch({ status: 'APPROVED' }))

      expect(res.status).toBe(429)
      expect(res.headers.get('Retry-After')).toBe('42')
      expect(submissionFindUniqueMock).not.toHaveBeenCalled()
      expect(paymentIntentsCaptureMock).not.toHaveBeenCalled()
    })

    it('scopes the rate limit to the brand and the request IP', async () => {
      useSubmission()

      await PATCH(...patch({ status: 'REJECTED' }))

      expect(checkRateLimitMock).toHaveBeenCalledWith(
        `submissions:review:${BRAND_ID}:127.0.0.1`,
        { limit: 20, windowMs: 60_000 },
      )
    })

    it('returns 404 when the submission does not exist', async () => {
      submissionFindUniqueMock.mockResolvedValue(null)

      const res = await PATCH(...patch({ status: 'APPROVED' }))

      expect(res.status).toBe(404)
      expect(paymentIntentsCaptureMock).not.toHaveBeenCalled()
    })
  })

  describe('cross-brand authorization', () => {
    it("refuses a brand approving a submission on another brand's campaign", async () => {
      useSubmission({ brandId: OTHER_BRAND_ID })

      const res = await PATCH(...patch({ status: 'APPROVED' }))

      expect(res.status).toBe(403)
      expect(await res.json()).toEqual({ error: 'Forbidden' })
      expect(paymentIntentsCaptureMock).not.toHaveBeenCalled()
      expect(submissionUpdateMock).not.toHaveBeenCalled()
    })

    it("refuses a brand rejecting a submission on another brand's campaign", async () => {
      useSubmission({ brandId: OTHER_BRAND_ID })

      const res = await PATCH(...patch({ status: 'REJECTED' }))

      expect(res.status).toBe(403)
      expect(submissionUpdateMock).not.toHaveBeenCalled()
      expect(sendSubmissionRejectedPushMock).not.toHaveBeenCalled()
    })

    it('does not leak the other brand’s submission data in the 403 body', async () => {
      useSubmission({ brandId: OTHER_BRAND_ID })

      const res = await PATCH(...patch({ status: 'APPROVED' }))
      const bodyText = JSON.stringify(await res.json())

      expect(bodyText).not.toContain(CREATOR_EMAIL)
      expect(bodyText).not.toContain('Summer glow-up')
    })
  })

  describe('input validation', () => {
    // An object table rather than tuples: vitest types a tuple row as the full
    // argument list, so a one-parameter callback fails to typecheck against it
    // (TS2345), and naming an unused second parameter trips no-unused-vars.
    it.each([
      { label: 'a status the brand may not set', body: { status: 'PENDING' } },
      { label: 'a lowercase status', body: { status: 'approved' } },
      { label: 'a missing status', body: {} },
      { label: 'an over-long review note', body: { status: 'APPROVED', reviewNote: 'x'.repeat(2001) } },
    ])('rejects $label with 400 and never captures', async ({ body }) => {
      useSubmission()

      const res = await PATCH(...patch(body))

      expect(res.status).toBe(400)
      expect(paymentIntentsCaptureMock).not.toHaveBeenCalled()
      expect(submissionUpdateMock).not.toHaveBeenCalled()
    })

    it('returns 500 without leaking internals when the body is not JSON', async () => {
      const consoleErrorSpy = silenceRouteErrors()
      useSubmission()

      const req = new Request(`https://www.creatordocks.com/api/submissions/${SUBMISSION_ID}`, {
        method: 'PATCH',
        body: 'not json',
        headers: { 'content-type': 'application/json' },
      })
      const res = await PATCH(req, { params: Promise.resolve({ id: SUBMISSION_ID }) })

      expect(res.status).toBe(500)
      expect(await res.json()).toEqual({ error: 'Internal server error' })
      expect(paymentIntentsCaptureMock).not.toHaveBeenCalled()

      consoleErrorSpy.mockRestore()
    })
  })

  describe('approval captures the payout exactly once', () => {
    it('captures once, marks the submission APPROVED and notifies the creator', async () => {
      useSubmission()

      const res = await PATCH(...patch({ status: 'APPROVED' }))
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.success).toBe(true)

      expect(paymentIntentsCaptureMock).toHaveBeenCalledTimes(1)
      expect(paymentIntentsCaptureMock).toHaveBeenCalledWith(
        'pi_1',
        {},
        { idempotencyKey: `submission:${SUBMISSION_ID}:capture` },
      )

      expect(payoutUpsertMock).toHaveBeenCalledTimes(1)
      expect(payoutUpsertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { submissionId: SUBMISSION_ID },
          create: expect.objectContaining({
            amount: PROPOSED_RATE,
            platformFee: PLATFORM_FEE,
            status: 'PAID',
          }),
        }),
      )

      expect(txSubmissionUpdateMock).toHaveBeenCalledWith({
        where: { id: SUBMISSION_ID },
        data: { status: 'APPROVED' },
      })

      expect(sendSubmissionApprovedEmailMock).toHaveBeenCalledTimes(1)
      expect(sendSubmissionApprovedEmailMock).toHaveBeenCalledWith(CREATOR_EMAIL, {
        campaignTitle: 'Summer glow-up',
      })
      expect(sendSubmissionApprovedPushMock).toHaveBeenCalledTimes(1)

      // End-to-end guard on a regression that shipped briefly: the capture
      // writes PAID here, so gating the payout notification on the webhook
      // seeing a transition meant the creator was never told they were paid.
      // Whoever performs the transition notifies, and here that is this request.
      expect(sendPayoutPaidEmailMock).toHaveBeenCalledTimes(1)
      expect(sendPayoutPaidEmailMock).toHaveBeenCalledWith(CREATOR_EMAIL, {
        campaignTitle: 'Summer glow-up',
        netAmountCents: PROPOSED_RATE - PLATFORM_FEE,
        platformFeeCents: PLATFORM_FEE,
      })
      expect(sendPayoutPaidPushMock).toHaveBeenCalledTimes(1)
      expect(sendPayoutPaidPushMock).toHaveBeenCalledWith(CREATOR_ID, {
        netAmount: PROPOSED_RATE - PLATFORM_FEE,
      })
    })

    it('captures a REVISION_REQUESTED submission that is finally approved', async () => {
      useSubmission({ status: 'REVISION_REQUESTED' })

      const res = await PATCH(...patch({ status: 'APPROVED' }))

      expect(res.status).toBe(200)
      expect(paymentIntentsCaptureMock).toHaveBeenCalledTimes(1)
    })

    it('refuses an already-APPROVED submission with 409 and does not capture twice', async () => {
      useSubmission({ status: 'APPROVED' })

      const res = await PATCH(...patch({ status: 'APPROVED' }))

      expect(res.status).toBe(409)
      expect(await res.json()).toEqual({
        error: 'Approved submissions can no longer be moved to another state',
      })
      expect(paymentIntentsCaptureMock).not.toHaveBeenCalled()
      expect(payoutUpsertMock).not.toHaveBeenCalled()
    })

    it('refuses to re-open an approved submission as REJECTED', async () => {
      useSubmission({ status: 'APPROVED' })

      const res = await PATCH(...patch({ status: 'REJECTED' }))

      expect(res.status).toBe(409)
      expect(submissionUpdateMock).not.toHaveBeenCalled()
    })

    it('two concurrent-ish approvals capture once when the first one won', async () => {
      useSubmission()
      await PATCH(...patch({ status: 'APPROVED' }))
      expect(paymentIntentsCaptureMock).toHaveBeenCalledTimes(1)

      // The row is APPROVED now; a second click must not reach Stripe again.
      useSubmission({ status: 'APPROVED' })
      const res = await PATCH(...patch({ status: 'APPROVED' }))

      expect(res.status).toBe(409)
      expect(paymentIntentsCaptureMock).toHaveBeenCalledTimes(1)
    })

    it('refuses approval with 400 when the application has no payment authorization', async () => {
      useSubmission({ paymentIntentId: null })

      const res = await PATCH(...patch({ status: 'APPROVED' }))

      expect(res.status).toBe(400)
      expect(await res.json()).toEqual({
        error: 'No payment authorization was found for this application',
      })
      expect(paymentIntentsCaptureMock).not.toHaveBeenCalled()
    })
  })

  describe('rejection and revision paths never capture', () => {
    it('records REVISION_REQUESTED without touching Stripe', async () => {
      useSubmission()

      const res = await PATCH(...patch({ status: 'REVISION_REQUESTED', reviewNote: 'Reshoot' }))

      expect(res.status).toBe(200)
      expect(paymentIntentsCaptureMock).not.toHaveBeenCalled()
      expect(paymentIntentsUpdateMock).not.toHaveBeenCalled()
      expect(payoutUpsertMock).not.toHaveBeenCalled()
      expect(submissionUpdateMock).toHaveBeenCalledWith({
        where: { id: SUBMISSION_ID },
        data: { status: 'REVISION_REQUESTED', reviewNote: 'Reshoot' },
      })
      expect(sendSubmissionRevisionRequestedPushMock).toHaveBeenCalledTimes(1)
      expect(sendSubmissionRejectedPushMock).not.toHaveBeenCalled()
      expect(sendSubmissionApprovedEmailMock).not.toHaveBeenCalled()
    })

    it('records REJECTED without touching Stripe', async () => {
      useSubmission()

      const res = await PATCH(...patch({ status: 'REJECTED' }))

      expect(res.status).toBe(200)
      expect(paymentIntentsCaptureMock).not.toHaveBeenCalled()
      expect(payoutUpsertMock).not.toHaveBeenCalled()
      expect(sendSubmissionRejectedPushMock).toHaveBeenCalledTimes(1)
      expect(sendSubmissionRevisionRequestedPushMock).not.toHaveBeenCalled()
    })

    it('omits reviewNote from the update when the brand sent none', async () => {
      useSubmission()

      await PATCH(...patch({ status: 'REJECTED' }))

      expect(submissionUpdateMock).toHaveBeenCalledWith({
        where: { id: SUBMISSION_ID },
        data: { status: 'REJECTED' },
      })
    })
  })

  describe('capture failures', () => {
    it('leaves the submission un-approved and unpaid when Stripe capture throws', async () => {
      const consoleErrorSpy = silenceRouteErrors()
      useSubmission()
      paymentIntentsCaptureMock.mockRejectedValue(
        new Error('card_declined: pi_secret_internal; sk_live_should_not_leak'),
      )

      const res = await PATCH(...patch({ status: 'APPROVED' }))
      const body = await res.json()

      expect(res.status).toBe(500)
      expect(body).toEqual({ error: 'Internal server error' })
      expect(JSON.stringify(body)).not.toContain('sk_live')

      // Nothing downstream of the capture ran: no payout row, no APPROVED flip,
      // no "you got paid" email or push.
      expect(payoutUpsertMock).not.toHaveBeenCalled()
      expect(txSubmissionUpdateMock).not.toHaveBeenCalled()
      expect(submissionUpdateMock).not.toHaveBeenCalled()
      expect(sendSubmissionApprovedEmailMock).not.toHaveBeenCalled()
      expect(sendSubmissionApprovedPushMock).not.toHaveBeenCalled()

      consoleErrorSpy.mockRestore()
    })

    it('does not capture when the payment intent fails validation', async () => {
      const consoleErrorSpy = silenceRouteErrors()
      useSubmission()
      // A brand that tampered with the rate, or an intent that drifted.
      paymentIntentsRetrieveMock.mockResolvedValue(authorizedIntent({ amount: 1 }))

      const res = await PATCH(...patch({ status: 'APPROVED' }))

      expect(res.status).toBe(500)
      expect(paymentIntentsCaptureMock).not.toHaveBeenCalled()
      expect(payoutUpsertMock).not.toHaveBeenCalled()

      consoleErrorSpy.mockRestore()
    })

    it('does not capture when the creator has no Stripe payout account', async () => {
      const consoleErrorSpy = silenceRouteErrors()
      useSubmission()
      submissionFindUniqueOrThrowMock.mockResolvedValue({
        ...plainSubmission('PENDING'),
        application: {
          id: 'app_1',
          campaignId: 'camp_1',
          paymentIntentId: 'pi_1',
          proposedRate: PROPOSED_RATE,
          status: 'ACCEPTED',
          creator: { ...creatorWithSecrets, stripeAccountId: null },
          campaign: { id: 'camp_1', brandId: BRAND_ID, title: 'Summer glow-up', creatorsNeeded: 1 },
        },
      })

      const res = await PATCH(...patch({ status: 'APPROVED' }))

      expect(res.status).toBe(500)
      expect(paymentIntentsCaptureMock).not.toHaveBeenCalled()

      consoleErrorSpy.mockRestore()
    })

    it('does not capture when the application was never ACCEPTED', async () => {
      const consoleErrorSpy = silenceRouteErrors()
      useSubmission({ applicationStatus: 'PENDING' })

      const res = await PATCH(...patch({ status: 'APPROVED' }))

      expect(res.status).toBe(500)
      expect(paymentIntentsCaptureMock).not.toHaveBeenCalled()

      consoleErrorSpy.mockRestore()
    })

    /**
     * HIGH finding, documented as a characterization test.
     *
     * `releasePayout` captures the card BEFORE opening the transaction that
     * writes the Payout row and flips the submission to APPROVED. If that
     * transaction fails (a DB blip is enough), the brand's card is already
     * charged while the submission stays PENDING with no Payout row.
     *
     * Retrying does not heal it: the intent is now `succeeded`, so
     * `validatePaymentIntentForApplication({ requireAuthorized: true })` throws
     * "Payment has not been authorized yet" BEFORE the idempotent capture is
     * reached. The brand is stuck on a permanent 500 and the creator is never
     * marked paid, even though the money moved.
     */
    it('captures the card but leaves no payout and no APPROVED row when the write transaction fails', async () => {
      const consoleErrorSpy = silenceRouteErrors()
      useSubmission()
      transactionMock.mockRejectedValue(new Error('could not serialize access'))

      const res = await PATCH(...patch({ status: 'APPROVED' }))

      expect(res.status).toBe(500)
      // The money moved...
      expect(paymentIntentsCaptureMock).toHaveBeenCalledTimes(1)
      // ...but nothing recorded it.
      expect(payoutUpsertMock).not.toHaveBeenCalled()
      expect(txSubmissionUpdateMock).not.toHaveBeenCalled()
      expect(sendSubmissionApprovedEmailMock).not.toHaveBeenCalled()

      consoleErrorSpy.mockRestore()
    })

    it('cannot recover on retry: the captured intent now fails the authorization check', async () => {
      const consoleErrorSpy = silenceRouteErrors()
      useSubmission()
      transactionMock.mockRejectedValue(new Error('could not serialize access'))

      const first = await PATCH(...patch({ status: 'APPROVED' }))
      expect(first.status).toBe(500)
      expect(paymentIntentsCaptureMock).toHaveBeenCalledTimes(1)

      // Stripe now reports the intent as captured, and the submission row was
      // never advanced, so the brand retries the same approval.
      paymentIntentsRetrieveMock.mockResolvedValue(authorizedIntent({ status: 'succeeded' }))
      transactionMock.mockImplementation(
        async (fn: (tx: unknown) => Promise<unknown>) =>
          fn({
            payout: { upsert: payoutUpsertMock },
            submission: { update: txSubmissionUpdateMock },
            application: { count: applicationCountMock },
            campaign: { update: campaignUpdateMock },
          }),
      )

      const second = await PATCH(...patch({ status: 'APPROVED' }))

      expect(second.status).toBe(500)
      // The retry never reaches the idempotent capture, so the payout can never
      // be recorded through this endpoint.
      expect(paymentIntentsCaptureMock).toHaveBeenCalledTimes(1)
      expect(payoutUpsertMock).not.toHaveBeenCalled()
      expect(txSubmissionUpdateMock).not.toHaveBeenCalled()

      consoleErrorSpy.mockRestore()
    })
  })

  describe('response never leaks creator PII', () => {
    it('returns only the bare submission row on approval', async () => {
      useSubmission()

      const res = await PATCH(...patch({ status: 'APPROVED' }))
      const body = await res.json()
      const bodyText = JSON.stringify(body)

      expect(res.status).toBe(200)
      expect(bodyText).not.toContain(CREATOR_CLERK_ID)
      expect(bodyText).not.toContain(CREATOR_STRIPE_ACCOUNT_ID)
      expect(bodyText).not.toContain(CREATOR_EMAIL)
      expect(body.data).not.toHaveProperty('creator')
      expect(body.data).not.toHaveProperty('application')
    })

    it.each([['REJECTED'], ['REVISION_REQUESTED']])(
      'returns only the bare submission row on %s',
      async status => {
        useSubmission()

        const res = await PATCH(...patch({ status }))
        const body = await res.json()
        const bodyText = JSON.stringify(body)

        expect(res.status).toBe(200)
        expect(bodyText).not.toContain(CREATOR_CLERK_ID)
        expect(bodyText).not.toContain(CREATOR_STRIPE_ACCOUNT_ID)
        expect(bodyText).not.toContain(CREATOR_EMAIL)
        expect(body.data).not.toHaveProperty('creator')
      },
    )
  })
})
