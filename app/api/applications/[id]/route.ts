import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import { requireTesterApiUser } from '@/lib/admin-api-guard'
import prisma from '@/lib/prisma'
import { sendApplicationAcceptedEmail, sendApplicationRejectedEmail } from '@/lib/email'
import { checkRateLimit, getRequestIp, isTrustedOrigin } from '@/lib/request-security'
import {
  cancelPaymentIntentIfCancelable,
  validatePaymentIntentForApplication,
} from '@/lib/stripe-payments'

const updateSchema = z.object({
  status: z.enum(['ACCEPTED', 'REJECTED']),
})

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (!isTrustedOrigin(req)) {
      return Response.json({ error: 'Invalid request origin' }, { status: 403 })
    }

    const testerGate = await requireTesterApiUser()
    if (testerGate.response) return testerGate.response

    const { userId } = await auth()
    if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params

    const user = await prisma.user.findUnique({ where: { clerkId: userId } })
    if (!user) return Response.json({ error: 'User not found' }, { status: 404 })
    if (user.role !== 'BRAND') {
      return Response.json({ error: 'Only brands can review applications' }, { status: 403 })
    }

    const rateLimit = checkRateLimit(`applications:review:${user.id}:${getRequestIp(req)}`, {
      limit: 20,
      windowMs: 60_000,
    })
    if (!rateLimit.ok) {
      return Response.json(
        { error: 'Too many application review attempts. Please try again shortly.' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } },
      )
    }

    const application = await prisma.application.findUnique({
      where: { id },
      include: { campaign: true, creator: true },
    })
    if (!application) return Response.json({ error: 'Application not found' }, { status: 404 })
    if (application.campaign.brandId !== user.id) {
      return Response.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    if (application.status === parsed.data.status) {
      return Response.json({ success: true, data: application })
    }

    if (application.status !== 'PENDING') {
      return Response.json({ error: 'Only pending applications can be reviewed' }, { status: 409 })
    }

    if (application.campaign.status !== 'ACTIVE') {
      return Response.json({ error: 'This campaign is no longer accepting applications' }, { status: 409 })
    }

    if (parsed.data.status === 'ACCEPTED') {
      if (!application.creator.stripeAccountId) {
        return Response.json({ error: 'Creator does not have a payout account connected' }, { status: 400 })
      }

      try {
        await validatePaymentIntentForApplication({
          application,
          destinationAccountId: application.creator.stripeAccountId,
          requireAuthorized: true,
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Payment authorization is incomplete'
        return Response.json({ error: message }, { status: 409 })
      }
    }

    if (parsed.data.status === 'REJECTED' && application.paymentIntentId) {
      try {
        await cancelPaymentIntentIfCancelable(application.paymentIntentId)
      } catch (err) {
        console.warn('[PATCH /api/applications/[id]] unable to cancel payment intent', err)
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (parsed.data.status === 'ACCEPTED') {
        const acceptedCount = await tx.application.count({
          where: { campaignId: application.campaignId, status: 'ACCEPTED' },
        })
        const creatorsNeeded = application.campaign.creatorsNeeded ?? 1
        if (acceptedCount >= creatorsNeeded) {
          throw new Error('Campaign already has enough accepted creators')
        }

        const acceptedRates = await tx.application.aggregate({
          where: { campaignId: application.campaignId, status: 'ACCEPTED' },
          _sum: { proposedRate: true },
        })
        const committedSpend = (acceptedRates._sum.proposedRate ?? 0) + application.proposedRate
        if (committedSpend > application.campaign.budget) {
          throw new Error('Accepting this application would exceed the campaign budget')
        }
      }

      const nextApplication = await tx.application.update({
        where: { id },
        data: {
          status: parsed.data.status,
          ...(parsed.data.status === 'REJECTED' ? { paymentIntentId: null } : {}),
        },
      })

      if (parsed.data.status === 'ACCEPTED') {
        const acceptedCount = await tx.application.count({
          where: { campaignId: application.campaignId, status: 'ACCEPTED' },
        })
        const creatorsNeeded = application.campaign.creatorsNeeded ?? 1
        if (acceptedCount >= creatorsNeeded) {
          await tx.campaign.update({
            where: { id: application.campaignId },
            data: { status: 'IN_PROGRESS' },
          })
        }
      }

      return nextApplication
    })

    if (parsed.data.status === 'ACCEPTED') {
      await sendApplicationAcceptedEmail(application.creator.email, { campaignTitle: application.campaign.title })
    } else {
      await sendApplicationRejectedEmail(application.creator.email, { campaignTitle: application.campaign.title })
    }

    return Response.json({ success: true, data: updated })
  } catch (err) {
    if (
      err instanceof Error &&
      (err.message === 'Campaign already has enough accepted creators' ||
        err.message === 'Accepting this application would exceed the campaign budget')
    ) {
      return Response.json({ error: err.message }, { status: 409 })
    }

    console.error('[PATCH /api/applications/[id]]', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
