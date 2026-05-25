import prisma from './prisma'
import { stripe } from './stripe'
import { calculatePlatformFee } from './utils'
import { validatePaymentIntentForApplication } from './stripe-payments'

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

  await prisma.$transaction(async (tx) => {
    await tx.payout.upsert({
      where: { submissionId },
      update: {
        creatorId: submission.creatorId,
        amount,
        platformFee,
        stripeTransferId: capturedIntent.latest_charge
          ? String(capturedIntent.latest_charge)
          : null,
        status: capturedIntent.status === 'succeeded' ? 'PAID' : 'PROCESSING',
      },
      create: {
        submissionId,
        creatorId: submission.creatorId,
        amount,
        platformFee,
        stripeTransferId: capturedIntent.latest_charge
          ? String(capturedIntent.latest_charge)
          : null,
        status: capturedIntent.status === 'succeeded' ? 'PAID' : 'PROCESSING',
      },
    })

    await tx.submission.update({
      where: { id: submissionId },
      data: { status: 'APPROVED' },
    })

    await tx.campaign.update({
      where: { id: submission.application.campaignId },
      data: { status: 'COMPLETE' },
    })
  })
}
