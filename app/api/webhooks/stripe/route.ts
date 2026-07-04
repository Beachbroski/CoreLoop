import { headers } from 'next/headers'
import { stripe } from '@/lib/stripe'
import prisma from '@/lib/prisma'
import { sendPayoutPaidEmail } from '@/lib/email'
import { calculatePlatformFee } from '@/lib/utils'

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

        await prisma.$transaction(async (tx) => {
          await tx.payout.upsert({
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
        })

        await sendPayoutPaidEmail(submission.creator.email, {
          campaignTitle: submission.application.campaign.title,
          amountCents: submission.application.proposedRate,
        })
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

        await prisma.payout.upsert({
          where: { submissionId },
          update: {
            creatorId: submission.creatorId,
            amount: submission.application.proposedRate,
            platformFee:
              pi.application_fee_amount ?? calculatePlatformFee(submission.application.proposedRate),
            status: 'FAILED',
          },
          create: {
            submissionId,
            creatorId: submission.creatorId,
            amount: submission.application.proposedRate,
            platformFee:
              pi.application_fee_amount ?? calculatePlatformFee(submission.application.proposedRate),
            status: 'FAILED',
          },
        })
        break
      }

      case 'account.updated': {
        const account = event.data.object
        const stripeOnboarded =
          Boolean(account.details_submitted) &&
          Boolean(account.payouts_enabled) &&
          account.capabilities?.transfers === 'active'

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
