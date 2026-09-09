import { beforeEach, describe, expect, it, vi } from 'vitest'
import { calculatePlatformFee } from './utils'

/**
 * `lib/payout.ts` is the only code path that turns a card authorization into
 * real money. Everything here is integer cents (docs/PROJECT-STATE.md §4).
 *
 * Only `@/lib/prisma` and `@/lib/stripe` are mocked. `lib/stripe-payments.ts`
 * and `lib/utils.ts` run for real, so the destination-account, amount,
 * capture-method and platform-fee checks are genuinely exercised rather than
 * stubbed away.
 */
const {
  findUniqueOrThrowMock,
  transactionMock,
  payoutUpsertMock,
  payoutFindUniqueMock,
  submissionUpdateMock,
  applicationCountMock,
  campaignUpdateMock,
  retrieveIntentMock,
  updateIntentMock,
  captureIntentMock,
  sendPayoutPaidEmailMock,
  sendPayoutPaidPushMock,
} = vi.hoisted(() => ({
  findUniqueOrThrowMock: vi.fn(),
  transactionMock: vi.fn(),
  payoutUpsertMock: vi.fn(),
  payoutFindUniqueMock: vi.fn(),
  submissionUpdateMock: vi.fn(),
  applicationCountMock: vi.fn(),
  campaignUpdateMock: vi.fn(),
  retrieveIntentMock: vi.fn(),
  updateIntentMock: vi.fn(),
  captureIntentMock: vi.fn(),
  sendPayoutPaidEmailMock: vi.fn(),
  sendPayoutPaidPushMock: vi.fn(),
}))

vi.mock('@/lib/email', () => ({ sendPayoutPaidEmail: sendPayoutPaidEmailMock }))
vi.mock('@/lib/push', () => ({ sendPayoutPaidPush: sendPayoutPaidPushMock }))

vi.mock('@/lib/prisma', () => ({
  default: {
    submission: { findUniqueOrThrow: findUniqueOrThrowMock },
    $transaction: transactionMock,
  },
}))

vi.mock('@/lib/stripe', () => ({
  stripe: {
    paymentIntents: {
      retrieve: retrieveIntentMock,
      update: updateIntentMock,
      capture: captureIntentMock,
    },
  },
}))

const { releasePayout } = await import('./payout')

const SUBMISSION_ID = 'sub_1'
const APPLICATION_ID = 'app_1'
const CAMPAIGN_ID = 'camp_1'
const CREATOR_ID = 'user_creator'
/** The connected account the money must land in. */
const CREATOR_ACCOUNT = 'acct_creator_live'
/** The platform's own account — money must never be routed here. */
const PLATFORM_ACCOUNT = 'acct_platform_house'
const INTENT_ID = 'pi_authorized'
const CHARGE_ID = 'ch_captured'
const CREATOR_EMAIL = 'creator@example.com'
/** The payout email quotes this, so the fixture has to carry it. */
const CAMPAIGN_TITLE = 'Spring patio launch'

/** $99.99 — deliberately does not divide evenly by 15%. */
const RATE_CENTS = 9999
/** Math.round(9999 * 0.15) === 1500 */
const FEE_CENTS = 1500
/**
 * The fee Stripe reports back on the *updated* intent in one test below.
 * Deliberately one cent away from FEE_CENTS: the payout row reads the fee from
 * Stripe and only recomputes it locally as a fallback, and the two sources have
 * to be different numbers for a test to tell those branches apart.
 */
const STRIPE_REPORTED_FEE_CENTS = 1499

function buildCreator(overrides: Record<string, unknown> = {}) {
  return {
    id: CREATOR_ID,
    clerkId: 'clerk_creator_secret',
    email: CREATOR_EMAIL,
    stripeAccountId: CREATOR_ACCOUNT,
    stripeOnboarded: true,
    ...overrides,
  }
}

function buildCampaign(overrides: Record<string, unknown> = {}) {
  return {
    id: CAMPAIGN_ID,
    brandId: 'user_brand',
    title: CAMPAIGN_TITLE,
    budget: 500_000,
    creatorsNeeded: 1,
    status: 'ACTIVE',
    ...overrides,
  }
}

function buildApplication(overrides: Record<string, unknown> = {}) {
  return {
    id: APPLICATION_ID,
    status: 'ACCEPTED',
    paymentIntentId: INTENT_ID,
    proposedRate: RATE_CENTS,
    campaignId: CAMPAIGN_ID,
    creator: buildCreator(),
    campaign: buildCampaign(),
    ...overrides,
  }
}

function buildSubmission(overrides: Record<string, unknown> = {}) {
  return {
    id: SUBMISSION_ID,
    status: 'PENDING',
    creatorId: CREATOR_ID,
    applicationId: APPLICATION_ID,
    application: buildApplication(),
    ...overrides,
  }
}

/** A correctly-formed manual-capture destination charge, as Stripe returns it. */
function buildIntent(overrides: Record<string, unknown> = {}) {
  return {
    id: INTENT_ID,
    amount: RATE_CENTS,
    currency: 'usd',
    capture_method: 'manual',
    application_fee_amount: FEE_CENTS,
    status: 'requires_capture',
    transfer_data: { destination: CREATOR_ACCOUNT },
    metadata: { applicationId: APPLICATION_ID, campaignId: CAMPAIGN_ID },
    client_secret: 'pi_authorized_secret_abc',
    ...overrides,
  }
}

function buildCapturedIntent(overrides: Record<string, unknown> = {}) {
  return { ...buildIntent(), status: 'succeeded', latest_charge: CHARGE_ID, ...overrides }
}

beforeEach(() => {
  findUniqueOrThrowMock.mockReset()
  transactionMock.mockReset()
  payoutUpsertMock.mockReset()
  payoutFindUniqueMock.mockReset()
  sendPayoutPaidEmailMock.mockReset()
  sendPayoutPaidPushMock.mockReset()
  submissionUpdateMock.mockReset()
  applicationCountMock.mockReset()
  campaignUpdateMock.mockReset()
  retrieveIntentMock.mockReset()
  updateIntentMock.mockReset()
  captureIntentMock.mockReset()

  findUniqueOrThrowMock.mockResolvedValue(buildSubmission())
  retrieveIntentMock.mockResolvedValue(buildIntent())
  updateIntentMock.mockResolvedValue(buildIntent())
  captureIntentMock.mockResolvedValue(buildCapturedIntent())
  applicationCountMock.mockResolvedValue(1)
  payoutUpsertMock.mockResolvedValue({ id: 'payout_1' })
  // No prior row is the ordinary case: the brand approves, this is the first
  // write, so the release performs the PAID transition and owns the notification.
  payoutFindUniqueMock.mockResolvedValue(null)
  sendPayoutPaidEmailMock.mockResolvedValue(undefined)
  sendPayoutPaidPushMock.mockResolvedValue(undefined)
  submissionUpdateMock.mockResolvedValue({ id: SUBMISSION_ID, status: 'APPROVED' })
  campaignUpdateMock.mockResolvedValue({ id: CAMPAIGN_ID, status: 'COMPLETE' })

  transactionMock.mockImplementation(async (run: (tx: unknown) => Promise<unknown>) =>
    run({
      payout: { upsert: payoutUpsertMock, findUnique: payoutFindUniqueMock },
      submission: { update: submissionUpdateMock },
      application: { count: applicationCountMock },
      campaign: { update: campaignUpdateMock },
    }),
  )
})

/**
 * Two writers can move a payout into PAID: this function, when the manual
 * capture settles immediately (the normal case), and the
 * `payment_intent.succeeded` webhook, when it does not. Whoever performs the
 * transition owns the notification. Gating both on the transition is what
 * prevents a creator being told twice; notifying from BOTH writers is what
 * prevents them never being told at all — a regression that existed briefly
 * when only the webhook spoke and this function had already written PAID.
 */
describe('releasePayout — who tells the creator they were paid', () => {
  it('emails and pushes the net amount when this release performs the PAID transition', async () => {
    await releasePayout(SUBMISSION_ID, INTENT_ID)

    expect(sendPayoutPaidEmailMock).toHaveBeenCalledTimes(1)
    expect(sendPayoutPaidEmailMock).toHaveBeenCalledWith(CREATOR_EMAIL, {
      campaignTitle: CAMPAIGN_TITLE,
      netAmountCents: RATE_CENTS - FEE_CENTS,
      platformFeeCents: FEE_CENTS,
    })
    expect(sendPayoutPaidPushMock).toHaveBeenCalledTimes(1)
    expect(sendPayoutPaidPushMock).toHaveBeenCalledWith(CREATOR_ID, {
      netAmount: RATE_CENTS - FEE_CENTS,
    })
  })

  it('says nothing when the row was already PAID, so a repeat release cannot double-notify', async () => {
    payoutFindUniqueMock.mockResolvedValue({ status: 'PAID' })

    await releasePayout(SUBMISSION_ID, INTENT_ID)

    expect(sendPayoutPaidEmailMock).not.toHaveBeenCalled()
    expect(sendPayoutPaidPushMock).not.toHaveBeenCalled()
  })

  it('stays silent when the capture has not settled, leaving the webhook to notify', async () => {
    captureIntentMock.mockResolvedValue(buildCapturedIntent({ status: 'processing' }))

    await releasePayout(SUBMISSION_ID, INTENT_ID)

    expect(payoutUpsertMock.mock.calls[0][0].create.status).toBe('PROCESSING')
    expect(sendPayoutPaidEmailMock).not.toHaveBeenCalled()
    expect(sendPayoutPaidPushMock).not.toHaveBeenCalled()
  })

  it('still pushes when the email fails, and does not fail the release', async () => {
    sendPayoutPaidEmailMock.mockRejectedValue(new Error('resend is down'))
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    // The card is already captured. Throwing here would tell the brand the
    // approval failed for money that has genuinely moved.
    await expect(releasePayout(SUBMISSION_ID, INTENT_ID)).resolves.toBeUndefined()

    expect(sendPayoutPaidPushMock).toHaveBeenCalledTimes(1)
    expect(consoleError).toHaveBeenCalled()
    consoleError.mockRestore()
  })

  it('reads the prior status inside the transaction, before the write', async () => {
    await releasePayout(SUBMISSION_ID, INTENT_ID)

    expect(payoutFindUniqueMock).toHaveBeenCalledWith({
      where: { submissionId: SUBMISSION_ID },
      select: { status: true },
    })
    expect(payoutFindUniqueMock.mock.invocationCallOrder[0]).toBeLessThan(
      payoutUpsertMock.mock.invocationCallOrder[0],
    )
  })
})

/**
 * The fee is the platform's entire revenue and the creator's entire loss, so
 * the arithmetic is asserted directly, not just through the happy path.
 */
describe('calculatePlatformFee — the 15% cut, in integer cents', () => {
  /**
   * Both halves of the split are literals. Most of these grosses are amounts
   * where 15% lands mid-cent, so the split is decided by the rounding rule
   * rather than by exact division: the fee has to be the stated whole number of
   * cents, and what is left for the creator has to be the stated remainder —
   * neither half may quietly gain or lose a cent.
   */
  it.each([
    [0, 0, 0],
    [1, 0, 1], // 0.15 rounds down; the platform earns nothing on a 1c job
    [7, 1, 6], // 1.05
    [10, 2, 8], // exactly 1.5 — rounds away from zero, so 20% of a dime
    [33, 5, 28], // 4.95
    [100, 15, 85], // $1.00 — divides evenly
    [105, 16, 89], // 15.75
    [333, 50, 283], // 49.95
    [999, 150, 849], // 149.85
    [1_000, 150, 850],
    [1_234, 185, 1_049], // 185.1 — rounds down
    [9_999, 1_500, 8_499], // $99.99 — 1499.85 rounds up
    [12_345, 1_852, 10_493], // 1851.75
    [99_999, 15_000, 84_999], // 14999.85
    [250_000, 37_500, 212_500], // $2,500 — divides evenly
  ])('splits %i cents into a %i fee and %i for the creator', (gross, expectedFee, expectedNet) => {
    expect(calculatePlatformFee(gross)).toBe(expectedFee)
    expect(gross - calculatePlatformFee(gross)).toBe(expectedNet)
  })

  it('always returns an integer', () => {
    for (let amount = 1; amount <= 5_000; amount += 1) {
      expect(Number.isInteger(calculatePlatformFee(amount))).toBe(true)
    }
  })

  it('never hands the platform a negative fee or more than the whole gross', () => {
    for (let amount = 1; amount <= 20_000; amount += 1) {
      const fee = calculatePlatformFee(amount)
      expect(fee).toBeGreaterThanOrEqual(0)
      expect(fee).toBeLessThanOrEqual(amount)
    }
  })

  /**
   * `Math.round(amount * 0.15)` goes through a float. This pins the exact
   * rounding rule (half away from zero on the true rational value) and proves
   * the float never drifts off it across the whole legal rate range
   * (`proposedRate` is capped at 10,000,000 cents by the application schema).
   */
  it('matches exact half-up rational rounding — no floating point drift', () => {
    const exactHalfUp = (amount: number) => Math.floor((6 * amount + 20) / 40)

    for (let amount = 1; amount <= 50_000; amount += 1) {
      expect(calculatePlatformFee(amount)).toBe(exactHalfUp(amount))
    }
    for (let amount = 50_000; amount <= 10_000_000; amount += 997) {
      expect(calculatePlatformFee(amount)).toBe(exactHalfUp(amount))
    }
    for (const amount of [999_999, 1_000_000, 4_999_999, 9_999_999, 10_000_000]) {
      expect(calculatePlatformFee(amount)).toBe(exactHalfUp(amount))
    }
  })
})

describe('releasePayout — capture', () => {
  it('captures the authorization and records the payout in integer cents', async () => {
    await releasePayout(SUBMISSION_ID, INTENT_ID)

    expect(captureIntentMock).toHaveBeenCalledTimes(1)
    expect(payoutUpsertMock).toHaveBeenCalledTimes(1)

    const upsertArgs = payoutUpsertMock.mock.calls[0][0]
    expect(upsertArgs.where).toEqual({ submissionId: SUBMISSION_ID })
    // `toEqual`, not `toMatchObject`: the ledger row must carry these six
    // columns and nothing else — 9999 cents gross, 1500 of fee.
    expect(upsertArgs.create).toEqual({
      submissionId: SUBMISSION_ID,
      creatorId: CREATOR_ID,
      amount: 9_999,
      platformFee: 1_500,
      stripeTransferId: CHARGE_ID,
      status: 'PAID',
    })
  })

  it('passes a deterministic idempotency key scoped to the submission', async () => {
    await releasePayout(SUBMISSION_ID, INTENT_ID)

    expect(captureIntentMock).toHaveBeenCalledWith(
      INTENT_ID,
      {},
      { idempotencyKey: `submission:${SUBMISSION_ID}:capture` },
    )
  })

  it('reuses the identical idempotency key when a release is retried', async () => {
    // First attempt captures, then the database write blows up, leaving the
    // submission PENDING. The retry must present the same key so Stripe
    // replays the original capture instead of charging the card twice.
    transactionMock.mockRejectedValueOnce(new Error('connection terminated'))

    await expect(releasePayout(SUBMISSION_ID, INTENT_ID)).rejects.toThrow('connection terminated')
    await releasePayout(SUBMISSION_ID, INTENT_ID)

    expect(captureIntentMock).toHaveBeenCalledTimes(2)
    const [firstKey, secondKey] = captureIntentMock.mock.calls.map(call => call[2].idempotencyKey)
    expect(firstKey).toBe(secondKey)
    expect(firstKey).toBe(`submission:${SUBMISSION_ID}:capture`)
  })

  it('marks the payout PROCESSING when the capture has not settled yet', async () => {
    captureIntentMock.mockResolvedValue(buildCapturedIntent({ status: 'processing' }))

    await releasePayout(SUBMISSION_ID, INTENT_ID)

    expect(payoutUpsertMock.mock.calls[0][0].create.status).toBe('PROCESSING')
  })

  it('records a null transfer id rather than the string "undefined" when no charge exists', async () => {
    captureIntentMock.mockResolvedValue(buildCapturedIntent({ latest_charge: null }))

    await releasePayout(SUBMISSION_ID, INTENT_ID)

    expect(payoutUpsertMock.mock.calls[0][0].create.stripeTransferId).toBeNull()
  })

  it('records the fee Stripe reports on the updated intent, not a recomputed one', async () => {
    // Stripe's number and the local computation must be different here, or the
    // next test cannot tell which of the two branches produced the fee.
    updateIntentMock.mockResolvedValue(
      buildIntent({ application_fee_amount: STRIPE_REPORTED_FEE_CENTS }),
    )

    await releasePayout(SUBMISSION_ID, INTENT_ID)

    expect(payoutUpsertMock.mock.calls[0][0].create.platformFee).toBe(1_499)
  })

  it('falls back to a locally computed fee if Stripe returns no application fee', async () => {
    // The intent that was validated a moment earlier still carries 1500, so the
    // fallback is only observable because the branch that reads Stripe's number
    // would have produced 1499 (see the test above) and null here.
    updateIntentMock.mockResolvedValue(buildIntent({ application_fee_amount: null }))

    await releasePayout(SUBMISSION_ID, INTENT_ID)

    // Math.round(9999 * 0.15), computed here rather than taken from Stripe.
    expect(payoutUpsertMock.mock.calls[0][0].create.platformFee).toBe(1_500)
  })

  it('approves the submission as part of the same transaction as the payout', async () => {
    await releasePayout(SUBMISSION_ID, INTENT_ID)

    expect(transactionMock).toHaveBeenCalledTimes(1)
    expect(submissionUpdateMock).toHaveBeenCalledWith({
      where: { id: SUBMISSION_ID },
      data: { status: 'APPROVED' },
    })
  })
})

describe('releasePayout — idempotency', () => {
  it('is a no-op for an already approved submission: no second capture, no second payout', async () => {
    findUniqueOrThrowMock.mockResolvedValue(buildSubmission({ status: 'APPROVED' }))

    await releasePayout(SUBMISSION_ID, INTENT_ID)

    expect(captureIntentMock).not.toHaveBeenCalled()
    expect(updateIntentMock).not.toHaveBeenCalled()
    expect(transactionMock).not.toHaveBeenCalled()
    expect(payoutUpsertMock).not.toHaveBeenCalled()
  })

  it('does not create a second payout when the same application is released twice', async () => {
    findUniqueOrThrowMock
      .mockResolvedValueOnce(buildSubmission())
      .mockResolvedValueOnce(buildSubmission({ status: 'APPROVED' }))

    await releasePayout(SUBMISSION_ID, INTENT_ID)
    await releasePayout(SUBMISSION_ID, INTENT_ID)

    expect(captureIntentMock).toHaveBeenCalledTimes(1)
    expect(payoutUpsertMock).toHaveBeenCalledTimes(1)
  })

  it('writes the payout through the unique submissionId so a retry updates instead of duplicating', async () => {
    await releasePayout(SUBMISSION_ID, INTENT_ID)

    const upsertArgs = payoutUpsertMock.mock.calls[0][0]
    expect(upsertArgs.where).toEqual({ submissionId: SUBMISSION_ID })
    expect(upsertArgs.update).toMatchObject({ amount: RATE_CENTS, platformFee: FEE_CENTS })
  })
})

describe('releasePayout — a Stripe failure must not leave a half-written payout', () => {
  it('writes nothing when the capture fails', async () => {
    captureIntentMock.mockRejectedValue(new Error('card_declined'))

    await expect(releasePayout(SUBMISSION_ID, INTENT_ID)).rejects.toThrow('card_declined')

    expect(transactionMock).not.toHaveBeenCalled()
    expect(payoutUpsertMock).not.toHaveBeenCalled()
    expect(submissionUpdateMock).not.toHaveBeenCalled()
    expect(campaignUpdateMock).not.toHaveBeenCalled()
  })

  it('does not capture when the metadata update fails', async () => {
    updateIntentMock.mockRejectedValue(new Error('stripe unavailable'))

    await expect(releasePayout(SUBMISSION_ID, INTENT_ID)).rejects.toThrow('stripe unavailable')

    expect(captureIntentMock).not.toHaveBeenCalled()
    expect(payoutUpsertMock).not.toHaveBeenCalled()
  })

  it('does not approve the submission when the payout row cannot be written', async () => {
    payoutUpsertMock.mockRejectedValue(new Error('unique constraint'))

    await expect(releasePayout(SUBMISSION_ID, INTENT_ID)).rejects.toThrow('unique constraint')

    // Both writes share one transaction, so the approval rolls back with it.
    expect(submissionUpdateMock).not.toHaveBeenCalled()
  })
})

describe('releasePayout — the destination account', () => {
  it('captures the intent as-is, taking only the platform fee and nothing else', async () => {
    await releasePayout(SUBMISSION_ID, INTENT_ID)

    // The capture is where the money actually moves. The intent already carries
    // `transfer_data.destination` and `application_fee_amount`, so the capture
    // call must not restate either: any override here would re-cut the split
    // after the brand already authorized the original one.
    expect(captureIntentMock).toHaveBeenCalledTimes(1)
    const [capturedId, captureParams] = captureIntentMock.mock.calls[0]
    expect(capturedId).toBe(INTENT_ID)
    expect(captureParams).toEqual({})

    // Same for the metadata update that runs just before it: metadata only.
    const [updatedId, updateParams] = updateIntentMock.mock.calls[0]
    expect(updatedId).toBe(INTENT_ID)
    expect(Object.keys(updateParams)).toEqual(['metadata'])

    // And the ledger row credits the creator the gross, with the platform's
    // entire take recorded as the fee — nothing routed anywhere else.
    const created = payoutUpsertMock.mock.calls[0][0].create
    expect(created.creatorId).toBe(CREATOR_ID)
    expect(created.amount).toBe(9_999)
    expect(created.platformFee).toBe(1_500)
  })

  it('validates the intent against the creator own connected account, not a fixed one', async () => {
    // The destination the code must check against comes from the creator row.
    // Move that row to a different connected account, leave the authorized
    // intent pointing at the old one, and the capture must not happen — which
    // is only true if the creator record, not a constant, drives the routing.
    const RELOCATED_ACCOUNT = 'acct_creator_relocated'
    findUniqueOrThrowMock.mockResolvedValue(
      buildSubmission({
        application: buildApplication({
          creator: buildCreator({ stripeAccountId: RELOCATED_ACCOUNT }),
        }),
      }),
    )
    retrieveIntentMock.mockResolvedValue(
      buildIntent({ transfer_data: { destination: CREATOR_ACCOUNT } }),
    )

    await expect(releasePayout(SUBMISSION_ID, INTENT_ID)).rejects.toThrow(
      /destination does not match the creator account/i,
    )
    expect(captureIntentMock).not.toHaveBeenCalled()
    expect(payoutUpsertMock).not.toHaveBeenCalled()
  })

  it('refuses to capture an intent pointed at any other account', async () => {
    retrieveIntentMock.mockResolvedValue(
      buildIntent({ transfer_data: { destination: PLATFORM_ACCOUNT } }),
    )

    await expect(releasePayout(SUBMISSION_ID, INTENT_ID)).rejects.toThrow(
      /destination does not match the creator account/i,
    )
    expect(captureIntentMock).not.toHaveBeenCalled()
  })

  it('refuses to capture a plain charge with no destination at all', async () => {
    retrieveIntentMock.mockResolvedValue(buildIntent({ transfer_data: null }))

    await expect(releasePayout(SUBMISSION_ID, INTENT_ID)).rejects.toThrow(
      /destination does not match the creator account/i,
    )
    expect(captureIntentMock).not.toHaveBeenCalled()
  })

  it('refuses to pay a creator who has no Stripe account', async () => {
    findUniqueOrThrowMock.mockResolvedValue(
      buildSubmission({
        application: buildApplication({ creator: buildCreator({ stripeAccountId: null }) }),
      }),
    )

    await expect(releasePayout(SUBMISSION_ID, INTENT_ID)).rejects.toThrow(
      /Creator payout account is missing/i,
    )
    expect(retrieveIntentMock).not.toHaveBeenCalled()
    expect(captureIntentMock).not.toHaveBeenCalled()
  })
})

describe('releasePayout — the intent must match the application', () => {
  it('refuses a payment intent id that is not the one stored on the application', async () => {
    await expect(releasePayout(SUBMISSION_ID, 'pi_someone_elses')).rejects.toThrow(
      /does not match the application record/i,
    )
    expect(captureIntentMock).not.toHaveBeenCalled()
  })

  it('refuses an intent whose amount is not the agreed rate', async () => {
    retrieveIntentMock.mockResolvedValue(buildIntent({ amount: RATE_CENTS - 1 }))

    await expect(releasePayout(SUBMISSION_ID, INTENT_ID)).rejects.toThrow(
      /amount does not match the application rate/i,
    )
    expect(captureIntentMock).not.toHaveBeenCalled()
  })

  /**
   * `validatePaymentIntentForApplication` checks the amount and the currency in
   * one `if`, and that branch throws an amount-only message. So a EUR intent for
   * exactly the right number of cents is correctly refused, but the operator is
   * told the amount is wrong when the amount is fine. The refusal is what
   * protects the money and is asserted here; the misleading message is recorded
   * in the test name because the fix belongs in lib/stripe-payments.ts.
   */
  it('refuses a non-USD intent, but blames the amount in the error message', async () => {
    retrieveIntentMock.mockResolvedValue(buildIntent({ currency: 'eur', amount: RATE_CENTS }))

    await expect(releasePayout(SUBMISSION_ID, INTENT_ID)).rejects.toThrow(
      /amount does not match the application rate/i,
    )
    expect(captureIntentMock).not.toHaveBeenCalled()
  })

  it('refuses an intent whose platform fee has been tampered with', async () => {
    retrieveIntentMock.mockResolvedValue(buildIntent({ application_fee_amount: 1 }))

    await expect(releasePayout(SUBMISSION_ID, INTENT_ID)).rejects.toThrow(
      /platform fee does not match/i,
    )
    expect(captureIntentMock).not.toHaveBeenCalled()
  })

  it('refuses an intent belonging to a different application', async () => {
    retrieveIntentMock.mockResolvedValue(
      buildIntent({ metadata: { applicationId: 'app_other', campaignId: CAMPAIGN_ID } }),
    )

    await expect(releasePayout(SUBMISSION_ID, INTENT_ID)).rejects.toThrow(
      /metadata does not match the application/i,
    )
    expect(captureIntentMock).not.toHaveBeenCalled()
  })

  it('refuses an automatic-capture intent (the card would already be charged)', async () => {
    retrieveIntentMock.mockResolvedValue(buildIntent({ capture_method: 'automatic' }))

    await expect(releasePayout(SUBMISSION_ID, INTENT_ID)).rejects.toThrow(
      /not configured for manual capture/i,
    )
    expect(captureIntentMock).not.toHaveBeenCalled()
  })

  it('refuses to capture an intent the brand never authorized', async () => {
    retrieveIntentMock.mockResolvedValue(buildIntent({ status: 'requires_payment_method' }))

    await expect(releasePayout(SUBMISSION_ID, INTENT_ID)).rejects.toThrow(
      /has not been authorized yet/i,
    )
    expect(captureIntentMock).not.toHaveBeenCalled()
  })
})

describe('releasePayout — state guards', () => {
  it.each(['APPROVED_ELSEWHERE', 'REJECTED', 'DRAFT'])(
    'refuses to pay out a submission in status %s',
    async status => {
      findUniqueOrThrowMock.mockResolvedValue(buildSubmission({ status }))

      await expect(releasePayout(SUBMISSION_ID, INTENT_ID)).rejects.toThrow(
        /Only pending submissions can be approved for payout/i,
      )
      expect(captureIntentMock).not.toHaveBeenCalled()
    },
  )

  it('allows a payout after a revision request', async () => {
    findUniqueOrThrowMock.mockResolvedValue(buildSubmission({ status: 'REVISION_REQUESTED' }))

    await releasePayout(SUBMISSION_ID, INTENT_ID)

    expect(captureIntentMock).toHaveBeenCalledTimes(1)
  })

  it.each(['PENDING', 'REJECTED', 'WITHDRAWN'])(
    'refuses to pay out against a %s application',
    async status => {
      findUniqueOrThrowMock.mockResolvedValue(
        buildSubmission({ application: buildApplication({ status }) }),
      )

      await expect(releasePayout(SUBMISSION_ID, INTENT_ID)).rejects.toThrow(
        /Only accepted applications can release payouts/i,
      )
      expect(captureIntentMock).not.toHaveBeenCalled()
    },
  )
})

describe('releasePayout — campaign completion', () => {
  it('completes the campaign once every needed creator is approved', async () => {
    applicationCountMock.mockResolvedValue(2)
    findUniqueOrThrowMock.mockResolvedValue(
      buildSubmission({ application: buildApplication({ campaign: buildCampaign({ creatorsNeeded: 2 }) }) }),
    )

    await releasePayout(SUBMISSION_ID, INTENT_ID)

    expect(campaignUpdateMock).toHaveBeenCalledWith({
      where: { id: CAMPAIGN_ID },
      data: { status: 'COMPLETE' },
    })
  })

  it('leaves the campaign open while creators are still outstanding', async () => {
    applicationCountMock.mockResolvedValue(1)
    findUniqueOrThrowMock.mockResolvedValue(
      buildSubmission({ application: buildApplication({ campaign: buildCampaign({ creatorsNeeded: 3 }) }) }),
    )

    await releasePayout(SUBMISSION_ID, INTENT_ID)

    expect(campaignUpdateMock).not.toHaveBeenCalled()
    expect(payoutUpsertMock).toHaveBeenCalledTimes(1)
  })
})
