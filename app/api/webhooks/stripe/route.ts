import { headers } from 'next/headers'
import { stripe } from '@/lib/stripe'
import prisma from '@/lib/prisma'
import { sendPayoutPaidEmail, sendPaymentAlertEmail } from '@/lib/email'
import { sendPayoutFailedPush, sendPayoutPaidPush } from '@/lib/push'
import { calculatePlatformFee } from '@/lib/utils'
import { getAllowedAdminEmails } from '@/lib/admin-config'
import { isStripeAccountOnboarded } from '@/lib/stripe-onboarded'

/**
 * Dispute and refund alerts CANNOT be deduplicated the way the payout
 * notifications below are, and the difference is worth stating exactly.
 *
 * A payout notification is gated on a real state transition: this route writes
 * `Payout.status`, so "did this delivery move the row into PAID/FAILED?" is a
 * truthful once-only signal. Disputes and refunds have no such row. The only
 * writable state reachable from a dispute or a charge is `Payout.status`, and
 * `PayoutStatus` has no DISPUTED or REFUNDED member — the only value we could
 * write is FAILED, which would be a lie for a dispute that is later won and for
 * a partial refund, and nothing in the codebase ever restores it. Corrupting
 * the row the creator's earnings are read from, to deduplicate an admin email,
 * is a worse bug than the duplicate.
 *
 * So a redelivery (a retry of our own 500, or Stripe's at-least-once duplicate)
 * re-alerts every admin for `charge.dispute.created`, `charge.dispute.closed`
 * and `charge.refunded`. Closing that needs a persisted event marker — a
 * `ProcessedStripeEvent { eventId @id }` row inserted in the same transaction
 * as the handler's work — i.e. a schema change.
 */
async function alertAdmins(params: Parameters<typeof sendPaymentAlertEmail>[1]) {
  const adminEmails = getAllowedAdminEmails()
  await Promise.all(adminEmails.map(email => sendPaymentAlertEmail(email, params)))
}

async function findApplicationByPaymentIntent(paymentIntentId: string) {
  return prisma.application.findFirst({
    where: { paymentIntentId },
    include: { creator: true, campaign: true },
  })
}

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET
  if (!WEBHOOK_SECRET) throw new Error('Missing STRIPE_WEBHOOK_SECRET')

  const body = await req.text()
  const headersList = await headers()
  const signature = headersList.get('stripe-signature')

  if (!signature) {
    return new Response('Missing stripe-signature', { status: 400 })
  }

  let event
  try {
    event = stripe.webhooks.constructEvent(body, signature, WEBHOOK_SECRET)
  } catch (err) {
    console.error('[stripe webhook] invalid signature', err)
    return new Response('Invalid signature', { status: 400 })
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const pi = event.data.object
        const submissionId = pi.metadata.submissionId
        const applicationId = pi.metadata.applicationId

        if (!submissionId || !applicationId) break

        const submission = await prisma.submission.findUnique({
          where: { id: submissionId },
          include: {
            creator: true,
            application: { include: { campaign: true } },
          },
        })

        if (!submission || submission.application.id !== applicationId) break

        // Stripe delivers at least once and retries every non-2xx for three
        // days, so this block runs again for events it has already handled.
        // The read below is what makes it safe: it happens inside the same
        // interactive transaction as the write, so "was this row already PAID
        // before this delivery?" is answered from the same snapshot the write
        // lands on, and only the delivery that actually moved the row into
        // PAID notifies. A concurrent delivery that loses the race on the
        // unique `submissionId` fails its upsert, returns 500, and on Stripe's
        // redelivery reads the settled row and stays silent.
        const { payout, transitionedToPaid } = await prisma.$transaction(async (tx) => {
          const before = await tx.payout.findUnique({
            where: { submissionId },
            select: { status: true },
          })

          const upserted = await tx.payout.upsert({
            where: { submissionId },
            update: {
              creatorId: submission.creatorId,
              amount: submission.application.proposedRate,
              platformFee:
                pi.application_fee_amount ?? calculatePlatformFee(submission.application.proposedRate),
              stripeTransferId: pi.latest_charge ? String(pi.latest_charge) : null,
              status: 'PAID',
            },
            create: {
              submissionId,
              creatorId: submission.creatorId,
              amount: submission.application.proposedRate,
              platformFee:
                pi.application_fee_amount ?? calculatePlatformFee(submission.application.proposedRate),
              stripeTransferId: pi.latest_charge ? String(pi.latest_charge) : null,
              status: 'PAID',
            },
          })

          await tx.submission.updateMany({
            where: { id: submissionId },
            data: { status: 'APPROVED' },
          })

          // The campaign is only complete once every needed creator has an approved submission.
          const approvedApplications = await tx.application.count({
            where: {
              campaignId: submission.application.campaignId,
              submissions: { some: { status: 'APPROVED' } },
            },
          })

          if (approvedApplications >= (submission.application.campaign.creatorsNeeded ?? 1)) {
            await tx.campaign.updateMany({
              where: { id: submission.application.campaignId },
              data: { status: 'COMPLETE' },
            })
          }

          // A row that was already PAID was settled by an earlier delivery (or
          // by `lib/payout.ts` `releasePayout`, which captures the intent and
          // writes PAID itself). Reconciling it above is harmless; telling the
          // creator they got paid a second time is not.
          return { payout: upserted, transitionedToPaid: before?.status !== 'PAID' }
        })

        // This is a destination charge: the connected account is credited the
        // charge minus `application_fee_amount`, so `proposedRate` is the gross
        // and never what the creator receives. Both notifications quote the net
        // off the stored Payout row, which already prefers Stripe's own fee
        // figure over `calculatePlatformFee`.
        if (transitionedToPaid) {
          const netAmountCents = payout.amount - payout.platformFee

          // This delivery consumed the transition, and no redelivery will
          // notify again — the row it reads is already PAID. So both channels
          // are attempted even when one fails: a dead mailer must not also cost
          // the creator their push. A failure is logged rather than rethrown:
          // returning non-2xx would mark the webhook failed and provoke a
          // retry that reads the settled row and stays silent, so the throw
          // bought nothing and lost the 200.
          const results = await Promise.allSettled([
            sendPayoutPaidEmail(submission.creator.email, {
              campaignTitle: submission.application.campaign.title,
              netAmountCents,
              platformFeeCents: payout.platformFee,
            }),
            sendPayoutPaidPush(submission.creatorId, { netAmount: netAmountCents }),
          ])

          for (const result of results) {
            if (result.status === 'rejected') {
              console.error('[stripe webhook] payout notification failed', {
                submissionId,
                reason: result.reason,
              })
            }
          }
        }
        break
      }

      case 'payment_intent.payment_failed': {
        const pi = event.data.object
        const submissionId = pi.metadata.submissionId
        if (!submissionId) break

        const submission = await prisma.submission.findUnique({
          where: { id: submissionId },
          include: { application: true },
        })
        if (!submission) break

        const amount = submission.application.proposedRate
        const platformFee = pi.application_fee_amount ?? calculatePlatformFee(amount)

        const transitionedToFailed = await prisma.$transaction(async (tx) => {
          const before = await tx.payout.findUnique({
            where: { submissionId },
            select: { status: true },
          })

          // Stripe does not guarantee ordering, so a late or retried failure can
          // arrive after the payout settled. The Payout table is what the
          // creator earnings surfaces read, so demoting a PAID row would leave
          // it permanently wrong; a repeat of a failure we already recorded must
          // not push the creator twice either.
          if (before?.status === 'PAID' || before?.status === 'FAILED') return false

          if (!before) {
            // A concurrent delivery creating the row first fails this create,
            // which returns 500 and asks Stripe to redeliver — by then the read
            // above sees the row and takes the guarded path.
            await tx.payout.create({
              data: { submissionId, creatorId: submission.creatorId, amount, platformFee, status: 'FAILED' },
            })
            return true
          }

          // The status guard is repeated in the WHERE, not just in the branch
          // above, so a delivery that settles the payout between this read and
          // this write still cannot be demoted. `count` reports whether this
          // delivery is the one that moved the row.
          const { count } = await tx.payout.updateMany({
            where: { submissionId, status: { notIn: ['PAID', 'FAILED'] } },
            data: { creatorId: submission.creatorId, amount, platformFee, status: 'FAILED' },
          })

          return count > 0
        })

        // Previously silent — the creator now hears when a payout fails, once.
        if (transitionedToFailed) await sendPayoutFailedPush(submission.creatorId)
        break
      }

      case 'charge.dispute.created': {
        const dispute = event.data.object
        const paymentIntentId =
          typeof dispute.payment_intent === 'string' ? dispute.payment_intent : dispute.payment_intent?.id
        if (!paymentIntentId) break

        const application = await findApplicationByPaymentIntent(paymentIntentId)
        if (!application) break

        await alertAdmins({
          kind: 'dispute_opened',
          campaignTitle: application.campaign.title,
          creatorName: application.creator.name ?? application.creator.email,
          amountCents: dispute.amount,
          detail: `Reason: ${dispute.reason}. Stripe dispute status: ${dispute.status}.`,
        })
        break
      }

      case 'charge.dispute.closed': {
        const dispute = event.data.object
        const paymentIntentId =
          typeof dispute.payment_intent === 'string' ? dispute.payment_intent : dispute.payment_intent?.id
        if (!paymentIntentId) break

        const application = await findApplicationByPaymentIntent(paymentIntentId)
        if (!application) break

        await alertAdmins({
          kind: 'dispute_closed',
          campaignTitle: application.campaign.title,
          creatorName: application.creator.name ?? application.creator.email,
          amountCents: dispute.amount,
          detail: `Outcome: ${dispute.status}.`,
        })
        break
      }

      case 'charge.refunded': {
        const charge = event.data.object
        const paymentIntentId =
          typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id
        if (!paymentIntentId) break

        const application = await findApplicationByPaymentIntent(paymentIntentId)
        if (!application) break

        await alertAdmins({
          kind: 'charge_refunded',
          campaignTitle: application.campaign.title,
          creatorName: application.creator.name ?? application.creator.email,
          amountCents: charge.amount_refunded,
          detail: charge.refunded ? 'The charge was refunded in full.' : 'The charge was partially refunded.',
        })
        break
      }

      case 'account.updated': {
        const account = event.data.object
        // Shared with GET /api/v1/stripe/status, which resolves the same
        // question from a live retrieve. Two copies of this condition would
        // drift, and the two answers disagreeing is a creator who can see
        // "connected" on one surface and cannot apply on the other.
        const stripeOnboarded = isStripeAccountOnboarded(account)

        await prisma.user.updateMany({
          where: { stripeAccountId: account.id },
          data: { stripeOnboarded },
        })
        break
      }
    }
  } catch (err) {
    console.error('[stripe webhook] handler error', err)
    return new Response('Handler error', { status: 500 })
  }

  return Response.json({ received: true })
}
