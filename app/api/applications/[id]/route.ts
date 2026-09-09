import { auth } from '@clerk/nextjs/server'
import type { Application } from '@prisma/client'
import { z } from 'zod'
import { requireTesterApiUser } from '@/lib/admin-api-guard'
import prisma from '@/lib/prisma'
import { sendApplicationAcceptedEmail, sendApplicationRejectedEmail } from '@/lib/email'
import { sendApplicationAcceptedPush, sendApplicationRejectedPush } from '@/lib/push'
import { checkRateLimit, getRequestIp, isTrustedOrigin } from '@/lib/request-security'
import {
  cancelPaymentIntentIfCancelable,
  validatePaymentIntentForApplication,
} from '@/lib/stripe-payments'

const updateSchema = z.object({
  status: z.enum(['ACCEPTED', 'REJECTED']),
})

/**
 * The only creator columns this handler reads: `stripeAccountId` to gate and
 * validate the payout destination, `email` to notify, `id` to push to.
 *
 * It is an allow-list rather than `creator: true` on purpose. The full User row
 * carries `clerkId`, `bio` and the raw `stripeAccountId` — the same fields the
 * `/api/v1` contract deliberately never exposes — and a brand reviewing an
 * application must not receive any of them.
 */
const creatorReviewSelect = { id: true, email: true, stripeAccountId: true } as const

/**
 * Projects a row loaded with relations back down to the plain Application
 * columns, so every branch of this handler answers with the same shape the
 * update path returns. The `Application` return type is deliberate: adding a
 * column to the model breaks the build here rather than silently drifting.
 */
function toApplicationRow(application: Application): Application {
  return {
    id: application.id,
    campaignId: application.campaignId,
    creatorId: application.creatorId,
    pitch: application.pitch,
    proposedRate: application.proposedRate,
    status: application.status,
    paymentIntentId: application.paymentIntentId,
    createdAt: application.createdAt,
    updatedAt: application.updatedAt,
  }
}

/**
 * Runs one notification and swallows its failure, the same log-and-swallow the
 * payment-intent cancel below uses.
 *
 * Notifications fire *after* the review transaction has committed, so the
 * decision is already durable by the time they run. Letting a Resend or Expo
 * outage throw would reach the outer catch and answer 500 for a review that in
 * fact succeeded: the brand UI (ApplicationActions.tsx) shows "Failed to accept
 * application", the brand retries, and the retry now finds `status !== PENDING`
 * and gets a 409 — on REJECT, after the payment intent has already been
 * cancelled. A creator missing an email is recoverable; that is not.
 *
 * Each notification is wrapped separately so a dead email provider does not
 * also suppress the push, and vice versa.
 */
async function notifyQuietly(label: string, send: () => Promise<unknown>): Promise<void> {
  try {
    await send()
  } catch (err) {
    console.warn(`[PATCH /api/applications/[id]] unable to send ${label}`, err)
  }
}

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

    const rateLimit = await checkRateLimit(`applications:review:${user.id}:${getRequestIp(req)}`, {
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
      include: { campaign: true, creator: { select: creatorReviewSelect } },
    })
    if (!application) return Response.json({ error: 'Application not found' }, { status: 404 })
    if (application.campaign.brandId !== user.id) {
      return Response.json({ error: 'Forbidden' }, { status: 403 })
    }

    // `.catch(() => null)` rather than a bare `await req.json()`: a malformed or
    // empty body throws, and an unguarded throw here escapes to the outer catch
    // and answers 500 — for exactly the bad input the next three lines are
    // written to answer 400. Handing `null` to safeParse lets the schema below
    // produce that 400, the same way /api/v1/applications does.
    const body = await req.json().catch(() => null)
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    if (application.status === parsed.data.status) {
      // A no-op review still answers 200, but with the same flat Application row
      // the update path returns (route.ts:155) — never the joined relations.
      return Response.json({ success: true, data: toApplicationRow(application) })
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

    const campaignTitle = application.campaign.title
    if (parsed.data.status === 'ACCEPTED') {
      await notifyQuietly('acceptance email', () =>
        sendApplicationAcceptedEmail(application.creator.email, { campaignTitle }),
      )
      await notifyQuietly('acceptance push', () =>
        sendApplicationAcceptedPush(application.creator.id, { campaignTitle }),
      )
    } else {
      await notifyQuietly('rejection email', () =>
        sendApplicationRejectedEmail(application.creator.email, { campaignTitle }),
      )
      await notifyQuietly('rejection push', () =>
        sendApplicationRejectedPush(application.creator.id, { campaignTitle }),
      )
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
