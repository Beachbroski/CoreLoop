import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * `app/api/webhooks/stripe/route.ts` is the single source of truth for payment
 * status (docs/PROJECT-STATE.md §4). Everything money-shaped downstream —
 * `Payout.status`, the creator's "you got paid" email and push, and
 * `User.stripeOnboarded` (which `POST /api/v1/applications` requires before a
 * creator may apply) — is written from here and nowhere else.
 *
 * Four properties matter more than the rest:
 *   1. An event we cannot cryptographically attribute to Stripe must not reach
 *      the database. A forged `payment_intent.succeeded` would mark a payout
 *      PAID that Stripe never captured.
 *   2. The creator is told the NET figure. The charge is a destination charge,
 *      so the connected account is credited the rate minus the 15%
 *      `application_fee_amount`; quoting gross promises money that never lands.
 *   3. Stripe delivers AT LEAST ONCE and retries every non-2xx for three days,
 *      so a redelivery must not notify the creator twice. Both payout branches
 *      read the row inside the same transaction as their write and notify only
 *      when THIS delivery moved it into the destination state. Section 8 holds
 *      them to that; it also records what that signal cannot cover.
 *   4. Stripe does not guarantee ordering, so a late `payment_failed` must not
 *      be able to demote a payout that already settled.
 */

const {
  constructEventMock,
  getHeadersMock,
  submissionFindUniqueMock,
  submissionUpdateManyMock,
  payoutFindUniqueMock,
  payoutUpsertMock,
  payoutCreateMock,
  payoutUpdateManyMock,
  directPayoutFindUniqueMock,
  directPayoutUpsertMock,
  directPayoutCreateMock,
  directPayoutUpdateManyMock,
  applicationFindFirstMock,
  applicationCountMock,
  campaignUpdateManyMock,
  userUpdateManyMock,
  transactionMock,
  sendPayoutPaidEmailMock,
  sendPaymentAlertEmailMock,
  sendPayoutPaidPushMock,
  sendPayoutFailedPushMock,
} = vi.hoisted(() => ({
  constructEventMock: vi.fn(),
  getHeadersMock: vi.fn(),
  submissionFindUniqueMock: vi.fn(),
  submissionUpdateManyMock: vi.fn(),
  payoutFindUniqueMock: vi.fn(),
  payoutUpsertMock: vi.fn(),
  payoutCreateMock: vi.fn(),
  payoutUpdateManyMock: vi.fn(),
  directPayoutFindUniqueMock: vi.fn(),
  directPayoutUpsertMock: vi.fn(),
  directPayoutCreateMock: vi.fn(),
  directPayoutUpdateManyMock: vi.fn(),
  applicationFindFirstMock: vi.fn(),
  applicationCountMock: vi.fn(),
  campaignUpdateManyMock: vi.fn(),
  userUpdateManyMock: vi.fn(),
  transactionMock: vi.fn(),
  sendPayoutPaidEmailMock: vi.fn(),
  sendPaymentAlertEmailMock: vi.fn(),
  sendPayoutPaidPushMock: vi.fn(),
  sendPayoutFailedPushMock: vi.fn(),
}))

vi.mock('next/headers', () => ({ headers: getHeadersMock }))

vi.mock('@/lib/stripe', () => ({
  stripe: { webhooks: { constructEvent: constructEventMock } },
}))

/**
 * The non-transactional client gets its OWN payout mocks (`directPayout*`).
 * Deciding whether to notify means comparing the row before the write with the
 * row after it, and that comparison is only sound if both happen inside one
 * interactive transaction. Any payout call that lands on these mocks is a read
 * or write that a concurrent delivery could interleave with, so the tests
 * assert they are never reached.
 */
vi.mock('@/lib/prisma', () => ({
  default: {
    submission: { findUnique: submissionFindUniqueMock, updateMany: submissionUpdateManyMock },
    payout: {
      findUnique: directPayoutFindUniqueMock,
      upsert: directPayoutUpsertMock,
      create: directPayoutCreateMock,
      updateMany: directPayoutUpdateManyMock,
    },
    application: { findFirst: applicationFindFirstMock, count: applicationCountMock },
    campaign: { updateMany: campaignUpdateManyMock },
    user: { updateMany: userUpdateManyMock },
    $transaction: transactionMock,
  },
}))

vi.mock('@/lib/email', () => ({
  sendPayoutPaidEmail: sendPayoutPaidEmailMock,
  sendPaymentAlertEmail: sendPaymentAlertEmailMock,
}))

vi.mock('@/lib/push', () => ({
  sendPayoutPaidPush: sendPayoutPaidPushMock,
  sendPayoutFailedPush: sendPayoutFailedPushMock,
}))

// `@/lib/utils` (calculatePlatformFee), `@/lib/stripe-onboarded` and
// `@/lib/admin-config` are deliberately NOT mocked: the 15% arithmetic and the
// three-part onboarding condition are exactly what these tests are asserting.
const { POST } = await import('./route')

const originalEnv = { ...process.env }

const ADMIN_EMAILS = ['ops@example.com', 'cto@example.com']

/** $1,000 agreed rate, Stripe's own 15% fee, $850 to the creator. */
const GROSS_CENTS = 100_000
const FEE_CENTS = 15_000

const SIGNED_HEADERS = { 'stripe-signature': 't=1757200000,v1=deadbeefcafe' }

function webhookRequest(payload: unknown = {}): Request {
  return new Request('https://marketplace.example.test/api/webhooks/stripe', {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: { 'content-type': 'application/json' },
  })
}

const submissionRow = {
  id: 'sub_1',
  creatorId: 'user_creator',
  status: 'PENDING',
  creator: { id: 'user_creator', email: 'creator@example.com', name: 'Casey Creator' },
  application: {
    id: 'app_1',
    campaignId: 'camp_1',
    proposedRate: GROSS_CENTS,
    campaign: { id: 'camp_1', title: 'Spring Launch', creatorsNeeded: 2 },
  },
}

const applicationRow = {
  id: 'app_1',
  paymentIntentId: 'pi_1',
  creator: { id: 'user_creator', email: 'creator@example.com', name: 'Casey Creator' },
  campaign: { id: 'camp_1', title: 'Spring Launch' },
}

const disputeObject = {
  id: 'dp_1',
  payment_intent: 'pi_1',
  amount: GROSS_CENTS,
  reason: 'fraudulent',
  status: 'needs_response',
}

function succeededEvent(intentOverrides: Record<string, unknown> = {}) {
  return {
    id: 'evt_succeeded_1',
    type: 'payment_intent.succeeded',
    data: {
      object: {
        id: 'pi_1',
        metadata: { submissionId: 'sub_1', applicationId: 'app_1' },
        application_fee_amount: FEE_CENTS,
        latest_charge: 'ch_1',
        ...intentOverrides,
      },
    },
  }
}

function failedEvent(intentOverrides: Record<string, unknown> = {}) {
  return {
    id: 'evt_failed_1',
    type: 'payment_intent.payment_failed',
    data: {
      object: {
        id: 'pi_1',
        metadata: { submissionId: 'sub_1', applicationId: 'app_1' },
        application_fee_amount: FEE_CENTS,
        ...intentOverrides,
      },
    },
  }
}

/** Every mock that represents a durable write. */
const writeMocks = () => [
  payoutUpsertMock,
  payoutCreateMock,
  payoutUpdateManyMock,
  directPayoutUpsertMock,
  directPayoutCreateMock,
  directPayoutUpdateManyMock,
  submissionUpdateManyMock,
  campaignUpdateManyMock,
  userUpdateManyMock,
  transactionMock,
]

function expectNoDatabaseWrite() {
  for (const mock of writeMocks()) expect(mock).not.toHaveBeenCalled()
}

function expectNoNotification() {
  expect(sendPayoutPaidEmailMock).not.toHaveBeenCalled()
  expect(sendPaymentAlertEmailMock).not.toHaveBeenCalled()
  expect(sendPayoutPaidPushMock).not.toHaveBeenCalled()
  expect(sendPayoutFailedPushMock).not.toHaveBeenCalled()
}

/** No payout read or write may bypass the interactive transaction. */
function expectNoPayoutAccessOutsideTransaction() {
  expect(directPayoutFindUniqueMock).not.toHaveBeenCalled()
  expect(directPayoutUpsertMock).not.toHaveBeenCalled()
  expect(directPayoutCreateMock).not.toHaveBeenCalled()
  expect(directPayoutUpdateManyMock).not.toHaveBeenCalled()
}

describe('POST /api/webhooks/stripe', () => {
  beforeEach(() => {
    process.env = {
      ...originalEnv,
      STRIPE_WEBHOOK_SECRET: 'whsec_test',
      ADMIN_ALLOWED_EMAILS: ADMIN_EMAILS.join(','),
    }

    vi.clearAllMocks()

    getHeadersMock.mockResolvedValue(new Headers(SIGNED_HEADERS))
    submissionFindUniqueMock.mockResolvedValue(submissionRow)
    submissionUpdateManyMock.mockResolvedValue({ count: 1 })
    // Default: no payout row yet, i.e. this is a first delivery.
    payoutFindUniqueMock.mockResolvedValue(null)
    payoutUpsertMock.mockResolvedValue({ amount: GROSS_CENTS, platformFee: FEE_CENTS })
    payoutCreateMock.mockResolvedValue({ amount: GROSS_CENTS, platformFee: FEE_CENTS })
    payoutUpdateManyMock.mockResolvedValue({ count: 1 })
    applicationFindFirstMock.mockResolvedValue(applicationRow)
    applicationCountMock.mockResolvedValue(0)
    campaignUpdateManyMock.mockResolvedValue({ count: 1 })
    userUpdateManyMock.mockResolvedValue({ count: 1 })
    sendPayoutPaidEmailMock.mockResolvedValue(undefined)
    sendPaymentAlertEmailMock.mockResolvedValue(undefined)
    sendPayoutPaidPushMock.mockResolvedValue(undefined)
    sendPayoutFailedPushMock.mockResolvedValue(undefined)

    // The route runs its payout work inside `prisma.$transaction(async tx => ...)`;
    // only the tx client carries the payout mocks the assertions look at.
    transactionMock.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        payout: {
          findUnique: payoutFindUniqueMock,
          upsert: payoutUpsertMock,
          create: payoutCreateMock,
          updateMany: payoutUpdateManyMock,
        },
        submission: { updateMany: submissionUpdateManyMock },
        application: { count: applicationCountMock },
        campaign: { updateMany: campaignUpdateManyMock },
      }),
    )
  })

  afterAll(() => {
    process.env = { ...originalEnv }
  })

  // ---------------------------------------------------------------------
  // 1. Signature verification — the load-bearing test in this file.
  // ---------------------------------------------------------------------

  describe('signature verification', () => {
    it('rejects a request with no stripe-signature header and writes nothing', async () => {
      getHeadersMock.mockResolvedValue(new Headers())

      const res = await POST(webhookRequest(succeededEvent()))

      expect(res.status).toBe(400)
      expect(await res.text()).toBe('Missing stripe-signature')
      expect(constructEventMock).not.toHaveBeenCalled()
      expect(submissionFindUniqueMock).not.toHaveBeenCalled()
      expectNoDatabaseWrite()
      expectNoNotification()
    })

    it('rejects a forged payment_intent.succeeded and writes nothing', async () => {
      // A body that would otherwise mark a payout PAID, signed by nobody.
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
      constructEventMock.mockImplementation(() => {
        throw new Error('No signatures found matching the expected signature for payload')
      })

      const res = await POST(webhookRequest(succeededEvent()))
      consoleError.mockRestore()

      expect(res.status).toBe(400)
      expect(await res.text()).toBe('Invalid signature')
      expect(constructEventMock).toHaveBeenCalledOnce()
      expect(submissionFindUniqueMock).not.toHaveBeenCalled()
      expectNoDatabaseWrite()
      expectNoNotification()
    })

    it('verifies against the raw body, the header signature and the configured secret', async () => {
      constructEventMock.mockReturnValue(succeededEvent())
      const payload = succeededEvent()

      await POST(webhookRequest(payload))

      expect(constructEventMock).toHaveBeenCalledWith(
        JSON.stringify(payload),
        SIGNED_HEADERS['stripe-signature'],
        'whsec_test',
      )
    })

    it('refuses to run at all when STRIPE_WEBHOOK_SECRET is unset', async () => {
      process.env = { ...process.env, STRIPE_WEBHOOK_SECRET: undefined }

      await expect(POST(webhookRequest(succeededEvent()))).rejects.toThrow(
        'Missing STRIPE_WEBHOOK_SECRET',
      )
      expect(constructEventMock).not.toHaveBeenCalled()
      expectNoDatabaseWrite()
    })
  })

  // ---------------------------------------------------------------------
  // 2. The set of event types the route actually handles.
  //
  // Each case is dispatched through POST and judged by what it DID; a case
  // label that is present in the source but wired to nothing would fail here.
  // Section 8 is the other half of the claim: every other type does nothing.
  // ---------------------------------------------------------------------

  describe('handled event types', () => {
    const handledEvents = [
      {
        type: 'payment_intent.succeeded',
        build: () => succeededEvent(),
        expectHandled: () => {
          expect(payoutUpsertMock).toHaveBeenCalledWith(
            expect.objectContaining({
              where: { submissionId: 'sub_1' },
              update: expect.objectContaining({ status: 'PAID' }),
            }),
          )
          expect(sendPayoutPaidPushMock).toHaveBeenCalledOnce()
        },
      },
      {
        type: 'payment_intent.payment_failed',
        build: () => failedEvent(),
        expectHandled: () => {
          expect(payoutCreateMock).toHaveBeenCalledWith({
            data: expect.objectContaining({ submissionId: 'sub_1', status: 'FAILED' }),
          })
          expect(sendPayoutFailedPushMock).toHaveBeenCalledWith('user_creator')
        },
      },
      {
        type: 'charge.dispute.created',
        build: () => ({
          id: 'evt_dispute_created',
          type: 'charge.dispute.created',
          data: { object: disputeObject },
        }),
        expectHandled: () => {
          expect(sendPaymentAlertEmailMock).toHaveBeenCalledWith(
            'ops@example.com',
            expect.objectContaining({ kind: 'dispute_opened' }),
          )
        },
      },
      {
        type: 'charge.dispute.closed',
        build: () => ({
          id: 'evt_dispute_closed',
          type: 'charge.dispute.closed',
          data: { object: { ...disputeObject, status: 'won' } },
        }),
        expectHandled: () => {
          expect(sendPaymentAlertEmailMock).toHaveBeenCalledWith(
            'ops@example.com',
            expect.objectContaining({ kind: 'dispute_closed' }),
          )
        },
      },
      {
        type: 'charge.refunded',
        build: () => ({
          id: 'evt_refund',
          type: 'charge.refunded',
          data: {
            object: { id: 'ch_1', payment_intent: 'pi_1', amount_refunded: 40_000, refunded: true },
          },
        }),
        expectHandled: () => {
          expect(sendPaymentAlertEmailMock).toHaveBeenCalledWith(
            'ops@example.com',
            expect.objectContaining({ kind: 'charge_refunded' }),
          )
        },
      },
      {
        type: 'account.updated',
        build: () => ({
          id: 'evt_account_updated',
          type: 'account.updated',
          data: {
            object: {
              id: 'acct_1',
              details_submitted: true,
              payouts_enabled: true,
              capabilities: { transfers: 'active' },
            },
          },
        }),
        expectHandled: () => {
          expect(userUpdateManyMock).toHaveBeenCalledWith({
            where: { stripeAccountId: 'acct_1' },
            data: { stripeOnboarded: true },
          })
        },
      },
    ]

    for (const handled of handledEvents) {
      it(`dispatches ${handled.type} through POST and takes its documented action`, async () => {
        constructEventMock.mockReturnValue(handled.build())

        const res = await POST(webhookRequest())

        expect(res.status).toBe(200)
        handled.expectHandled()
      })
    }
  })

  // ---------------------------------------------------------------------
  // 3. payment_intent.succeeded
  // ---------------------------------------------------------------------

  describe('payment_intent.succeeded', () => {
    it('moves the payout to PAID and approves the submission', async () => {
      constructEventMock.mockReturnValue(succeededEvent())

      const res = await POST(webhookRequest())

      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({ received: true })
      expect(transactionMock).toHaveBeenCalledOnce()
      expect(payoutUpsertMock).toHaveBeenCalledWith({
        where: { submissionId: 'sub_1' },
        update: {
          creatorId: 'user_creator',
          amount: GROSS_CENTS,
          platformFee: FEE_CENTS,
          stripeTransferId: 'ch_1',
          status: 'PAID',
        },
        create: {
          submissionId: 'sub_1',
          creatorId: 'user_creator',
          amount: GROSS_CENTS,
          platformFee: FEE_CENTS,
          stripeTransferId: 'ch_1',
          status: 'PAID',
        },
      })
      expect(submissionUpdateManyMock).toHaveBeenCalledWith({
        where: { id: 'sub_1' },
        data: { status: 'APPROVED' },
      })
    })

    it('emails and pushes the NET amount, never the gross rate', async () => {
      // A $1,000.00 charge with Stripe's own $150.00 destination fee. The
      // creator must be told $850.00. Every number below is the literal
      // expected answer, NOT a re-derivation of the route's own arithmetic:
      // if the route ever quotes gross, forgets the fee, or subtracts twice,
      // these assertions fail.
      constructEventMock.mockReturnValue(succeededEvent({ application_fee_amount: 15_000 }))
      submissionFindUniqueMock.mockResolvedValue({
        ...submissionRow,
        application: { ...submissionRow.application, proposedRate: 100_000 },
      })
      payoutUpsertMock.mockResolvedValue({ amount: 100_000, platformFee: 15_000 })

      await POST(webhookRequest())

      expect(sendPayoutPaidEmailMock).toHaveBeenCalledOnce()
      expect(sendPayoutPaidEmailMock).toHaveBeenCalledWith('creator@example.com', {
        campaignTitle: 'Spring Launch',
        netAmountCents: 85_000,
        platformFeeCents: 15_000,
      })

      expect(sendPayoutPaidPushMock).toHaveBeenCalledOnce()
      expect(sendPayoutPaidPushMock).toHaveBeenCalledWith('user_creator', { netAmount: 85_000 })
    })

    it('falls back to the local 15% fee when Stripe omits application_fee_amount', async () => {
      // $900.00 rate, no Stripe fee figure: calculatePlatformFee (unmocked)
      // must produce $135.00, leaving the creator $765.00.
      constructEventMock.mockReturnValue(succeededEvent({ application_fee_amount: null }))
      submissionFindUniqueMock.mockResolvedValue({
        ...submissionRow,
        application: { ...submissionRow.application, proposedRate: 90_000 },
      })
      payoutUpsertMock.mockResolvedValue({ amount: 90_000, platformFee: 13_500 })

      await POST(webhookRequest())

      expect(payoutUpsertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ amount: 90_000, platformFee: 13_500 }),
        }),
      )
      expect(sendPayoutPaidPushMock).toHaveBeenCalledWith('user_creator', { netAmount: 76_500 })
    })

    it('stores a null transfer id when the intent has no charge yet', async () => {
      constructEventMock.mockReturnValue(succeededEvent({ latest_charge: null }))

      await POST(webhookRequest())

      expect(payoutUpsertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ stripeTransferId: null }),
        }),
      )
    })

    it('completes the campaign once every needed creator has an approved submission', async () => {
      constructEventMock.mockReturnValue(succeededEvent())
      applicationCountMock.mockResolvedValue(2) // creatorsNeeded is 2

      await POST(webhookRequest())

      expect(campaignUpdateManyMock).toHaveBeenCalledWith({
        where: { id: 'camp_1' },
        data: { status: 'COMPLETE' },
      })
    })

    it('leaves the campaign open while creators are still needed', async () => {
      constructEventMock.mockReturnValue(succeededEvent())
      applicationCountMock.mockResolvedValue(1) // creatorsNeeded is 2

      await POST(webhookRequest())

      expect(campaignUpdateManyMock).not.toHaveBeenCalled()
    })

    it('writes the payout only inside the transaction', async () => {
      // The payout write and the submission/campaign writes it implies must
      // commit or roll back together; a payout written outside the transaction
      // could survive a failure of the two writes that depend on it.
      constructEventMock.mockReturnValue(succeededEvent())

      await POST(webhookRequest())

      expect(transactionMock).toHaveBeenCalledOnce()
      expect(payoutUpsertMock).toHaveBeenCalledOnce()
      expectNoPayoutAccessOutsideTransaction()
    })

    it('reads the payout status inside the transaction, before the write', async () => {
      constructEventMock.mockReturnValue(succeededEvent())

      await POST(webhookRequest())

      expect(payoutFindUniqueMock).toHaveBeenCalledWith({
        where: { submissionId: 'sub_1' },
        select: { status: true },
      })
      // Read BEFORE write, on the transaction client. A read taken after the
      // upsert would always report PAID and could never tell a first delivery
      // from a replay; a read taken outside the transaction could be answered
      // from a snapshot a concurrent delivery has already moved.
      expect(payoutFindUniqueMock.mock.invocationCallOrder[0]).toBeLessThan(
        payoutUpsertMock.mock.invocationCallOrder[0],
      )
      expectNoPayoutAccessOutsideTransaction()
    })

    it.each([
      ['there is no payout row yet', null],
      ['the payout is still PENDING', { status: 'PENDING' }],
      ['the capture left it PROCESSING', { status: 'PROCESSING' }],
      ['an earlier failure had marked it FAILED', { status: 'FAILED' }],
    ])('notifies the creator when %s and this delivery settles it', async (_label, before) => {
      // In each of these this webhook IS the writer that moves the row into
      // PAID, so the creator's "you got paid" message must go out.
      constructEventMock.mockReturnValue(succeededEvent())
      payoutFindUniqueMock.mockResolvedValue(before)

      await POST(webhookRequest())

      expect(sendPayoutPaidEmailMock).toHaveBeenCalledOnce()
      expect(sendPayoutPaidEmailMock).toHaveBeenCalledWith('creator@example.com', {
        campaignTitle: 'Spring Launch',
        netAmountCents: 85_000,
        platformFeeCents: 15_000,
      })
      expect(sendPayoutPaidPushMock).toHaveBeenCalledOnce()
      expect(sendPayoutPaidPushMock).toHaveBeenCalledWith('user_creator', { netAmount: 85_000 })
    })

    it('reconciles the row but notifies nobody when it was already PAID', async () => {
      // The redelivery case. The upsert still runs — writing the same values
      // over a settled row is harmless and keeps Stripe's figures authoritative
      // — but the creator is told they got paid exactly once.
      constructEventMock.mockReturnValue(succeededEvent())
      payoutFindUniqueMock.mockResolvedValue({ status: 'PAID' })

      const res = await POST(webhookRequest())

      expect(res.status).toBe(200)
      expect(payoutUpsertMock).toHaveBeenCalledOnce()
      expect(sendPayoutPaidEmailMock).not.toHaveBeenCalled()
      expect(sendPayoutPaidPushMock).not.toHaveBeenCalled()
    })

    it.each([
      ['no metadata at all', {}],
      ['only a submissionId', { submissionId: 'sub_1' }],
      ['only an applicationId', { applicationId: 'app_1' }],
    ])('acknowledges an intent with %s without writing', async (_label, metadata) => {
      constructEventMock.mockReturnValue(succeededEvent({ metadata }))

      const res = await POST(webhookRequest())

      expect(res.status).toBe(200)
      expect(submissionFindUniqueMock).not.toHaveBeenCalled()
      expectNoDatabaseWrite()
      expectNoNotification()
    })

    it('writes nothing when the submission does not exist', async () => {
      constructEventMock.mockReturnValue(succeededEvent())
      submissionFindUniqueMock.mockResolvedValue(null)

      const res = await POST(webhookRequest())

      expect(res.status).toBe(200)
      expectNoDatabaseWrite()
      expectNoNotification()
    })

    it('writes nothing when the intent names a different application than the submission', async () => {
      // A pasted-together intent must not be able to pay out someone else's submission.
      constructEventMock.mockReturnValue(
        succeededEvent({ metadata: { submissionId: 'sub_1', applicationId: 'app_OTHER' } }),
      )

      const res = await POST(webhookRequest())

      expect(res.status).toBe(200)
      expectNoDatabaseWrite()
      expectNoNotification()
    })

    it('returns 500 so Stripe redelivers when the transaction fails', async () => {
      constructEventMock.mockReturnValue(succeededEvent())
      transactionMock.mockRejectedValue(new Error('db down'))
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

      const res = await POST(webhookRequest())

      expect(res.status).toBe(500)
      expect(sendPayoutPaidEmailMock).not.toHaveBeenCalled()
      expect(sendPayoutPaidPushMock).not.toHaveBeenCalled()
      consoleError.mockRestore()
    })
  })

  // ---------------------------------------------------------------------
  // 4. payment_intent.payment_failed
  // ---------------------------------------------------------------------

  describe('payment_intent.payment_failed', () => {
    beforeEach(() => {
      submissionFindUniqueMock.mockResolvedValue({
        ...submissionRow,
        application: { id: 'app_1', proposedRate: GROSS_CENTS },
      })
    })

    it('records a FAILED payout and pushes the creator, without a paid email', async () => {
      constructEventMock.mockReturnValue(failedEvent())

      const res = await POST(webhookRequest())

      expect(res.status).toBe(200)
      expect(payoutCreateMock).toHaveBeenCalledWith({
        data: {
          submissionId: 'sub_1',
          creatorId: 'user_creator',
          amount: GROSS_CENTS,
          platformFee: FEE_CENTS,
          status: 'FAILED',
        },
      })
      expect(sendPayoutFailedPushMock).toHaveBeenCalledOnce()
      expect(sendPayoutFailedPushMock).toHaveBeenCalledWith('user_creator')
      expect(sendPayoutPaidEmailMock).not.toHaveBeenCalled()
      expect(sendPayoutPaidPushMock).not.toHaveBeenCalled()
      expect(submissionUpdateManyMock).not.toHaveBeenCalled()
    })

    it('updates an unsettled payout to FAILED under a guard that cannot demote a PAID row', async () => {
      constructEventMock.mockReturnValue(failedEvent())
      payoutFindUniqueMock.mockResolvedValue({ status: 'PENDING' })

      const res = await POST(webhookRequest())

      expect(res.status).toBe(200)
      // The status guard is repeated in the WHERE, not only in the branch, so a
      // delivery that settles the payout between the read and the write still
      // cannot be overwritten.
      expect(payoutUpdateManyMock).toHaveBeenCalledWith({
        where: { submissionId: 'sub_1', status: { notIn: ['PAID', 'FAILED'] } },
        data: {
          creatorId: 'user_creator',
          amount: GROSS_CENTS,
          platformFee: FEE_CENTS,
          status: 'FAILED',
        },
      })
      expect(sendPayoutFailedPushMock).toHaveBeenCalledOnce()
    })

    it('never demotes an already PAID payout, and pushes no failure to a paid creator', async () => {
      // Stripe does not guarantee ordering: a late or retried
      // payment_failed for an intent that has since succeeded arrives after
      // the payout settled. Demoting the row would make the creator's
      // earnings surface permanently wrong.
      constructEventMock.mockReturnValue(failedEvent())
      payoutFindUniqueMock.mockResolvedValue({ status: 'PAID' })

      const res = await POST(webhookRequest())

      expect(res.status).toBe(200)
      expect(payoutCreateMock).not.toHaveBeenCalled()
      expect(payoutUpsertMock).not.toHaveBeenCalled()
      expect(payoutUpdateManyMock).not.toHaveBeenCalled()
      expect(sendPayoutFailedPushMock).not.toHaveBeenCalled()
      expectNoPayoutAccessOutsideTransaction()
    })

    it('does not push a second time when the payout is already FAILED', async () => {
      constructEventMock.mockReturnValue(failedEvent())
      payoutFindUniqueMock.mockResolvedValue({ status: 'FAILED' })

      const res = await POST(webhookRequest())

      expect(res.status).toBe(200)
      expect(sendPayoutFailedPushMock).not.toHaveBeenCalled()
    })

    it('does not push when the guarded update matches no row', async () => {
      // The row settled between the read and the write: `count` is the only
      // truthful signal that this delivery changed anything.
      constructEventMock.mockReturnValue(failedEvent())
      payoutFindUniqueMock.mockResolvedValue({ status: 'PENDING' })
      payoutUpdateManyMock.mockResolvedValue({ count: 0 })

      const res = await POST(webhookRequest())

      expect(res.status).toBe(200)
      expect(payoutUpdateManyMock).toHaveBeenCalledOnce()
      expect(sendPayoutFailedPushMock).not.toHaveBeenCalled()
    })

    it('acknowledges a failure with no submissionId without writing', async () => {
      constructEventMock.mockReturnValue(failedEvent({ metadata: {} }))

      const res = await POST(webhookRequest())

      expect(res.status).toBe(200)
      expect(submissionFindUniqueMock).not.toHaveBeenCalled()
      expectNoDatabaseWrite()
      expectNoNotification()
    })

    it('writes nothing when the submission does not exist', async () => {
      constructEventMock.mockReturnValue(failedEvent())
      submissionFindUniqueMock.mockResolvedValue(null)

      const res = await POST(webhookRequest())

      expect(res.status).toBe(200)
      expectNoDatabaseWrite()
      expectNoNotification()
    })
  })

  // ---------------------------------------------------------------------
  // 5. Disputes and refunds alert admins.
  // ---------------------------------------------------------------------

  describe('disputes and refunds', () => {
    it('alerts every configured admin when a dispute is opened', async () => {
      constructEventMock.mockReturnValue({
        id: 'evt_dispute_created',
        type: 'charge.dispute.created',
        data: { object: disputeObject },
      })

      const res = await POST(webhookRequest())

      expect(res.status).toBe(200)
      expect(applicationFindFirstMock).toHaveBeenCalledWith({
        where: { paymentIntentId: 'pi_1' },
        include: { creator: true, campaign: true },
      })
      expect(sendPaymentAlertEmailMock).toHaveBeenCalledTimes(ADMIN_EMAILS.length)
      for (const email of ADMIN_EMAILS) {
        expect(sendPaymentAlertEmailMock).toHaveBeenCalledWith(email, {
          kind: 'dispute_opened',
          campaignTitle: 'Spring Launch',
          creatorName: 'Casey Creator',
          amountCents: GROSS_CENTS,
          detail: 'Reason: fraudulent. Stripe dispute status: needs_response.',
        })
      }
      expectNoDatabaseWrite()
    })

    it('alerts admins when a dispute closes, with the outcome', async () => {
      constructEventMock.mockReturnValue({
        id: 'evt_dispute_closed',
        type: 'charge.dispute.closed',
        data: { object: { ...disputeObject, status: 'lost' } },
      })

      const res = await POST(webhookRequest())

      expect(res.status).toBe(200)
      expect(sendPaymentAlertEmailMock).toHaveBeenCalledTimes(ADMIN_EMAILS.length)
      expect(sendPaymentAlertEmailMock).toHaveBeenCalledWith(
        ADMIN_EMAILS[0],
        expect.objectContaining({ kind: 'dispute_closed', detail: 'Outcome: lost.' }),
      )
    })

    it('resolves an expanded payment_intent object on a dispute', async () => {
      constructEventMock.mockReturnValue({
        id: 'evt_dispute_expanded',
        type: 'charge.dispute.created',
        data: { object: { ...disputeObject, payment_intent: { id: 'pi_expanded' } } },
      })

      await POST(webhookRequest())

      expect(applicationFindFirstMock).toHaveBeenCalledWith({
        where: { paymentIntentId: 'pi_expanded' },
        include: { creator: true, campaign: true },
      })
    })

    it.each([
      [true, 'The charge was refunded in full.'],
      [false, 'The charge was partially refunded.'],
    ])('alerts admins on charge.refunded (refunded=%s)', async (refunded, detail) => {
      constructEventMock.mockReturnValue({
        id: 'evt_refund',
        type: 'charge.refunded',
        data: {
          object: { id: 'ch_1', payment_intent: 'pi_1', amount_refunded: 40_000, refunded },
        },
      })

      const res = await POST(webhookRequest())

      expect(res.status).toBe(200)
      expect(sendPaymentAlertEmailMock).toHaveBeenCalledTimes(ADMIN_EMAILS.length)
      expect(sendPaymentAlertEmailMock).toHaveBeenCalledWith(
        ADMIN_EMAILS[0],
        expect.objectContaining({
          kind: 'charge_refunded',
          amountCents: 40_000,
          detail,
        }),
      )
    })

    it('falls back to the creator email when the creator has no name', async () => {
      applicationFindFirstMock.mockResolvedValue({
        ...applicationRow,
        creator: { ...applicationRow.creator, name: null },
      })
      constructEventMock.mockReturnValue({
        id: 'evt_dispute_created',
        type: 'charge.dispute.created',
        data: { object: disputeObject },
      })

      await POST(webhookRequest())

      expect(sendPaymentAlertEmailMock).toHaveBeenCalledWith(
        ADMIN_EMAILS[0],
        expect.objectContaining({ creatorName: 'creator@example.com' }),
      )
    })

    it('sends no alert when the payment intent matches no application', async () => {
      applicationFindFirstMock.mockResolvedValue(null)
      constructEventMock.mockReturnValue({
        id: 'evt_dispute_created',
        type: 'charge.dispute.created',
        data: { object: disputeObject },
      })

      const res = await POST(webhookRequest())

      expect(res.status).toBe(200)
      expect(sendPaymentAlertEmailMock).not.toHaveBeenCalled()
    })

    it('sends no alert when the dispute carries no payment intent', async () => {
      constructEventMock.mockReturnValue({
        id: 'evt_dispute_created',
        type: 'charge.dispute.created',
        data: { object: { ...disputeObject, payment_intent: null } },
      })

      const res = await POST(webhookRequest())

      expect(res.status).toBe(200)
      expect(applicationFindFirstMock).not.toHaveBeenCalled()
      expect(sendPaymentAlertEmailMock).not.toHaveBeenCalled()
    })
  })

  // ---------------------------------------------------------------------
  // 6. account.updated — the three-part onboarding condition.
  // ---------------------------------------------------------------------

  describe('account.updated', () => {
    function accountEvent(account: Record<string, unknown>) {
      return {
        id: 'evt_account_updated',
        type: 'account.updated',
        data: { object: { id: 'acct_1', ...account } },
      }
    }

    it('marks a fully onboarded account as onboarded', async () => {
      constructEventMock.mockReturnValue(
        accountEvent({
          details_submitted: true,
          payouts_enabled: true,
          capabilities: { transfers: 'active' },
        }),
      )

      const res = await POST(webhookRequest())

      expect(res.status).toBe(200)
      expect(userUpdateManyMock).toHaveBeenCalledWith({
        where: { stripeAccountId: 'acct_1' },
        data: { stripeOnboarded: true },
      })
    })

    it.each([
      [
        'form submitted but payouts still disabled',
        { details_submitted: true, payouts_enabled: false, capabilities: { transfers: 'active' } },
      ],
      [
        'transfers capability still pending',
        { details_submitted: true, payouts_enabled: true, capabilities: { transfers: 'pending' } },
      ],
      [
        'transfers capability inactive',
        { details_submitted: true, payouts_enabled: true, capabilities: { transfers: 'inactive' } },
      ],
      [
        'form never submitted',
        { details_submitted: false, payouts_enabled: true, capabilities: { transfers: 'active' } },
      ],
      [
        'no capabilities object at all',
        { details_submitted: true, payouts_enabled: true },
      ],
      ['an empty account payload', {}],
    ])('does NOT mark a partially onboarded account (%s) as onboarded', async (_label, account) => {
      constructEventMock.mockReturnValue(accountEvent(account))

      const res = await POST(webhookRequest())

      expect(res.status).toBe(200)
      expect(userUpdateManyMock).toHaveBeenCalledWith({
        where: { stripeAccountId: 'acct_1' },
        data: { stripeOnboarded: false },
      })
    })

    it('scopes the write to the account id and never touches other users', async () => {
      constructEventMock.mockReturnValue(
        accountEvent({
          details_submitted: true,
          payouts_enabled: true,
          capabilities: { transfers: 'active' },
        }),
      )

      await POST(webhookRequest())

      expect(userUpdateManyMock).toHaveBeenCalledOnce()
      expect(userUpdateManyMock).toHaveBeenCalledWith(
        expect.objectContaining({ where: { stripeAccountId: 'acct_1' } }),
      )
    })
  })

  // ---------------------------------------------------------------------
  // 7. Unhandled event types.
  // ---------------------------------------------------------------------

  describe('unhandled event types', () => {
    it.each([
      'invoice.paid',
      'customer.subscription.created',
      'payment_intent.canceled',
      'charge.succeeded',
      'some.type.stripe.invents.next.year',
    ])('acknowledges %s with 200 and no side effects', async type => {
      constructEventMock.mockReturnValue({ id: `evt_${type}`, type, data: { object: {} } })

      const res = await POST(webhookRequest())

      // Stripe retries every non-2xx, so an unknown type must not 500.
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({ received: true })
      expectNoDatabaseWrite()
      expectNoNotification()
    })
  })

  // ---------------------------------------------------------------------
  // 8. Replay / duplicate delivery.
  //
  // Stripe guarantees at-least-once delivery and retries every non-2xx for up
  // to three days, so a duplicate is expected, not hypothetical: the 500 in the
  // redelivery test above is followed by Stripe running the whole handler
  // again.
  //
  // Both payout branches read the row inside their transaction and act only on
  // the transition, so "did this delivery move the row?" is a truthful
  // once-only signal for PAID and for FAILED alike. The tests below hold them
  // to that across two real deliveries of the same event.
  //
  // What that signal CANNOT cover, stated so it is not mistaken for covered:
  //   a) `lib/payout.ts` `releasePayout` is the only producer of the
  //      `payment_intent.succeeded` events this route acts on, and it writes
  //      `status: 'PAID'` itself — without notifying anyone — before the first
  //      delivery normally arrives. On that ordering this route correctly
  //      stays silent, and the creator hears nothing at all until the paid
  //      email and push are sent by whichever writer performs the transition
  //      (i.e. from `releasePayout`, or gated on a `Payout.paidNotifiedAt`
  //      column). That is a one-line change in a file this test does not own.
  //   b) dispute and refund alerts have no row of their own to transition;
  //      `PayoutStatus` has no DISPUTED or REFUNDED member, so the only value
  //      this route could write is a FAILED that would be wrong for a won
  //      dispute and for a partial refund. Their redeliveries therefore still
  //      re-alert admins, and closing that needs a persisted event id.
  // ---------------------------------------------------------------------

  describe('duplicate delivery of the same event', () => {
    it('does not double-pay: the second delivery writes the identical PAID row', async () => {
      const event = succeededEvent()
      constructEventMock.mockReturnValue(event)
      // First delivery finds no row; the second finds the one it just wrote.
      payoutFindUniqueMock.mockResolvedValueOnce(null).mockResolvedValue({ status: 'PAID' })

      await POST(webhookRequest(event))
      await POST(webhookRequest(event))

      expect(payoutUpsertMock).toHaveBeenCalledTimes(2)
      const expectedRow = {
        creatorId: 'user_creator',
        amount: GROSS_CENTS,
        platformFee: FEE_CENTS,
        stripeTransferId: 'ch_1',
        status: 'PAID',
      }
      // One submission row, one payout row — the upsert key never varies, and
      // the second delivery reconciles it to exactly the same values.
      expect(payoutUpsertMock).toHaveBeenNthCalledWith(2, {
        where: { submissionId: 'sub_1' },
        update: expectedRow,
        create: { submissionId: 'sub_1', ...expectedRow },
      })
    })

    it('tells the creator they got paid exactly once across two deliveries', async () => {
      const event = succeededEvent()
      constructEventMock.mockReturnValue(event)
      payoutFindUniqueMock.mockResolvedValueOnce(null).mockResolvedValue({ status: 'PAID' })

      await POST(webhookRequest(event))
      await POST(webhookRequest(event))

      expect(sendPayoutPaidEmailMock).toHaveBeenCalledOnce()
      expect(sendPayoutPaidEmailMock).toHaveBeenCalledWith('creator@example.com', {
        campaignTitle: 'Spring Launch',
        netAmountCents: 85_000,
        platformFeeCents: 15_000,
      })
      expect(sendPayoutPaidPushMock).toHaveBeenCalledOnce()
      expect(sendPayoutPaidPushMock).toHaveBeenCalledWith('user_creator', { netAmount: 85_000 })
    })

    it('still pushes when the paid email fails, and stays silent on the retry', async () => {
      // The transition is consumed by the delivery that made it, so a retry
      // would notify nobody anyway — which is exactly why a mailer outage is
      // logged rather than rethrown. Answering non-2xx here would mark the
      // webhook failed and buy back nothing, because the redelivery reads an
      // already-PAID row. A mailer outage must also not swallow the push: both
      // channels are attempted, exactly once between the two deliveries.
      const event = succeededEvent()
      constructEventMock.mockReturnValue(event)
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
      sendPayoutPaidEmailMock.mockRejectedValueOnce(new Error('smtp down'))

      const first = await POST(webhookRequest(event))
      payoutFindUniqueMock.mockResolvedValue({ status: 'PAID' })
      const retry = await POST(webhookRequest(event))

      expect(consoleError).toHaveBeenCalled()
      consoleError.mockRestore()

      expect(first.status).toBe(200)
      expect(retry.status).toBe(200)
      expect(sendPayoutPaidEmailMock).toHaveBeenCalledOnce()
      expect(sendPayoutPaidPushMock).toHaveBeenCalledOnce()
      expect(sendPayoutPaidPushMock).toHaveBeenCalledWith('user_creator', { netAmount: 85_000 })
    })

    it('pushes a failure exactly once across two deliveries', async () => {
      const event = failedEvent()
      constructEventMock.mockReturnValue(event)
      submissionFindUniqueMock.mockResolvedValue({
        ...submissionRow,
        application: { id: 'app_1', proposedRate: GROSS_CENTS },
      })
      payoutFindUniqueMock.mockResolvedValueOnce(null).mockResolvedValue({ status: 'FAILED' })

      await POST(webhookRequest(event))
      await POST(webhookRequest(event))

      expect(sendPayoutFailedPushMock).toHaveBeenCalledOnce()
    })
  })
})
