import prisma from './prisma'
import { stripe } from './stripe'
import { calculatePlatformFee } from './utils'

export async function releasePayout(submissionId: string, paymentIntentId: string): Promise<void> {
  const submission = await prisma.submission.findUniqueOrThrow({
    where: { id: submissionId },
    include: {
      application: {
        include: { creator: true },
      },
    },
  })

  await stripe.paymentIntents.capture(paymentIntentId)

  const amount = submission.application.proposedRate
  const platformFee = calculatePlatformFee(amount)

  await prisma.payout.create({
    data: {
      submissionId,
      creatorId: submission.creatorId,
      amount,
      platformFee,
      status: 'PAID',
    },
  })

  await prisma.campaign.update({
    where: { id: submission.application.campaignId },
    data: { status: 'COMPLETE' },
  })
}
