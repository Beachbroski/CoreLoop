import prisma from './prisma'
import { stripe } from './stripe'
import { calculatePlatformFee } from './utils'
import { validatePaymentIntentForApplication } from './stripe-payments'
import { sendPayoutPaidEmail } from './email'
import { sendPayoutPaidPush } from './push'

export async function releasePayout(submissionId: string, paymentIntentId: string): Promise<void> {
  const submission = await prisma.submission.findUniqueOrThrow({
    where: { id: submissionId },
    include: {
      application: {
        include: {
          creator: true,
          campaign: true,
        },
      },
    },
  })

  if (submission.application.paymentIntentId !== paymentIntentId) {
    throw new Error('Submission payment intent does not match the application record')
  }

  if (submission.status === 'APPROVED') {
    return
  }

  if (!['PENDING', 'REVISION_REQUESTED'].includes(submission.status)) {
    throw new Error('Only pending submissions can be approved for payout')
  }

  if (submission.application.status !== 'ACCEPTED') {
    throw new Error('Only accepted applications can release payouts')
  }

  if (!submission.application.creator.stripeAccountId) {
    throw new Error('Creator payout account is missing')
  }

  const paymentIntent = await validatePaymentIntentForApplication({
    application: submission.application,
    destinationAccountId: submission.application.creator.stripeAccountId,
    requireAuthorized: true,
  })

  const updatedIntent = await stripe.paymentIntents.update(paymentIntentId, {
    metadata: {
      ...paymentIntent.metadata,
      applicationId: submission.applicationId,
      campaignId: submission.application.campaignId,
      creatorId: submission.creatorId,
      submissionId,
    },
  })

  const capturedIntent = await stripe.paymentIntents.capture(
    paymentIntentId,
    {},
    { idempotencyKey: `submission:${submissionId}:capture` },
  )

  const amount = submission.application.proposedRate
  const platformFee = updatedIntent.application_fee_amount ?? calculatePlatformFee(amount)

  const nextStatus = capturedIntent.status === 'succeeded' ? 'PAID' : 'PROCESSING'

  // Who tells the creator they were paid depends on who actually moves the row
  // into PAID, and there are two writers. A manual capture that settles
  // immediately — the normal case — is written PAID right here, and the
  // `payment_intent.succeeded` webhook that follows finds the row already PAID
  // and stays silent. Only when the capture has not settled yet do we write
  // PROCESSING and leave the transition, and therefore the notification, to the
  // webhook. Gating both sides on the transition is what stops a creator being
  // told twice; notifying from both writers is what stops them never being told
  // at all, which is what happens if only the webhook speaks.
  const transitionedToPaid = await prisma.$transaction(async (tx) => {
    const before = await tx.payout.findUnique({
      where: { submissionId },
      select: { status: true },
    })

    await tx.payout.upsert({
      where: { submissionId },
      update: {
        creatorId: submission.creatorId,
        amount,
        platformFee,
        stripeTransferId: capturedIntent.latest_charge
          ? String(capturedIntent.latest_charge)
          : null,
        status: nextStatus,
      },
      create: {
        submissionId,
        creatorId: submission.creatorId,
        amount,
        platformFee,
        stripeTransferId: capturedIntent.latest_charge
          ? String(capturedIntent.latest_charge)
          : null,
        status: nextStatus,
      },
    })

    await tx.submission.update({
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
      await tx.campaign.update({
        where: { id: submission.application.campaignId },
        data: { status: 'COMPLETE' },
      })
    }

    return nextStatus === 'PAID' && before?.status !== 'PAID'
  })

  if (!transitionedToPaid) return

  // The card is captured and the row is committed by the time we get here, so a
  // dead mailer must not fail this call: throwing would surface to the brand as
  // "approval failed" for money that has already moved. Both channels are
  // attempted independently — losing the email should not also cost the push —
  // and a failure is logged rather than raised.
  const netAmountCents = amount - platformFee
  const notifications = await Promise.allSettled([
    sendPayoutPaidEmail(submission.application.creator.email, {
      campaignTitle: submission.application.campaign.title,
      netAmountCents,
      platformFeeCents: platformFee,
    }),
    sendPayoutPaidPush(submission.creatorId, { netAmount: netAmountCents }),
  ])

  for (const result of notifications) {
    if (result.status === 'rejected') {
      console.error('[releasePayout] payout notification failed', {
        submissionId,
        reason: result.reason,
      })
    }
  }
}
