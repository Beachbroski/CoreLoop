import { headers } from 'next/headers'
import { stripe } from '@/lib/stripe'
import prisma from '@/lib/prisma'
import { sendPayoutPaidEmail, sendPaymentAlertEmail } from '@/lib/email'
import { calculatePlatformFee } from '@/lib/utils'
import { getAllowedAdminEmails } from '@/lib/admin-config'

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
