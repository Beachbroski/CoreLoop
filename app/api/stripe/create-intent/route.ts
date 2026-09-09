import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import { requireTesterApiUser } from '@/lib/admin-api-guard'
import { stripe } from '@/lib/stripe'
import prisma from '@/lib/prisma'
import { calculatePlatformFee } from '@/lib/utils'
import { checkRateLimit, getRequestIp, isTrustedOrigin } from '@/lib/request-security'
import { validatePaymentIntentForApplication } from '@/lib/stripe-payments'

const schema = z.object({
  applicationId: z.string().min(1),
})

/**
 * The bounds `proposedRate` is written under (`z.number().int().min(100)
 * .max(10_000_000)` in both POST /api/applications and POST /api/v1/applications).
 * Re-checked here on purpose: this route is the last thing standing between a
 * stored row and a real hold on a real card, and `Application.proposedRate` is a
 * plain `Int` column with no database-level check constraint. A row that arrived
 * by any other route — a backfill, a migration, a future write path — must not be
 * able to reach Stripe with a zero, negative, fractional or absurd amount.
 */
const MIN_AUTHORIZABLE_CENTS = 100
const MAX_AUTHORIZABLE_CENTS = 10_000_000

/**
 * Returns a user-facing reason the amount cannot be authorized, or null when it
 * is fundable. Kept total so a new bad shape fails closed rather than falling
 * through to Stripe.
 */
function describeUnfundableAmount(amountCents: unknown): string | null {
  if (typeof amountCents !== 'number' || !Number.isInteger(amountCents)) {
    return 'This application does not have a valid rate and cannot be funded'
  }
  if (amountCents <= 0) {
    return 'This application does not have a valid rate and cannot be funded'
  }
  if (amountCents < MIN_AUTHORIZABLE_CENTS) {
    return `This application's rate is below the ${MIN_AUTHORIZABLE_CENTS} cent minimum and cannot be funded`
  }
  if (amountCents > MAX_AUTHORIZABLE_CENTS) {
    return 'This application\'s rate exceeds the maximum amount that can be authorized'
  }
  return null
}

export async function POST(req: Request) {
  try {
    if (!isTrustedOrigin(req)) {
      return Response.json({ error: 'Invalid request origin' }, { status: 403 })
    }

    const testerGate = await requireTesterApiUser()
    if (testerGate.response) return testerGate.response

    const { userId } = await auth()
    if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const user = await prisma.user.findUnique({ where: { clerkId: userId } })
    if (!user) return Response.json({ error: 'User not found' }, { status: 404 })
    if (user.role !== 'BRAND') {
      return Response.json({ error: 'Only brands can create payment intents' }, { status: 403 })
    }

    const rateLimit = await checkRateLimit(`stripe:create-intent:${user.id}:${getRequestIp(req)}`, {
      limit: 8,
      windowMs: 60_000,
    })
    if (!rateLimit.ok) {
      return Response.json(
        { error: 'Too many payment authorization attempts. Please try again shortly.' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } },
      )
    }

    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    const application = await prisma.application.findUnique({
      where: { id: parsed.data.applicationId },
      include: {
        campaign: true,
        creator: true,
      },
    })
    if (!application) return Response.json({ error: 'Application not found' }, { status: 404 })
    if (application.campaign.brandId !== user.id) {
      return Response.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (application.status !== 'PENDING') {
      return Response.json({ error: 'Only pending applications can be funded' }, { status: 409 })
    }
    if (application.campaign.status !== 'ACTIVE') {
      return Response.json({ error: 'Campaign is not accepting funded applications' }, { status: 409 })
    }
    if (!application.creator.stripeAccountId || !application.creator.stripeOnboarded) {
      return Response.json({ error: 'Creator has not connected Stripe' }, { status: 400 })
    }

    // Runs before the existing-intent branch as well as before the create call:
    // an application with an unfundable rate must not have an intent created,
    // validated or handed back for it.
    const unfundableReason = describeUnfundableAmount(application.proposedRate)
    if (unfundableReason) {
      return Response.json({ error: unfundableReason }, { status: 422 })
    }

    const platformFee = calculatePlatformFee(application.proposedRate)

    // The platform's cut can never be the whole charge or more than it: that
    // would leave the creator with nothing (or Stripe rejecting the charge).
    if (
      !Number.isInteger(platformFee) ||
      platformFee < 0 ||
      platformFee >= application.proposedRate
    ) {
      return Response.json(
        { error: 'This application cannot be funded: the platform fee is not valid for its rate' },
        { status: 422 },
      )
    }

    if (application.paymentIntentId) {
      try {
        const existingIntent = await validatePaymentIntentForApplication({
          application,
          destinationAccountId: application.creator.stripeAccountId,
        })

        if (existingIntent.status === 'requires_capture') {
          return Response.json({ paymentAuthorized: true }, { status: 200 })
        }

        if (
          existingIntent.status === 'requires_payment_method' ||
          existingIntent.status === 'requires_confirmation' ||
          existingIntent.status === 'requires_action'
        ) {
          return Response.json({ clientSecret: existingIntent.client_secret }, { status: 200 })
        }

        if (existingIntent.status === 'processing' || existingIntent.status === 'succeeded') {
          return Response.json(
            { error: 'A payment is already in progress for this application' },
            { status: 409 },
          )
        }
      } catch (err) {
        console.warn('[POST /api/stripe/create-intent] existing intent validation failed', err)
      }
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: application.proposedRate,
      currency: 'usd',
      capture_method: 'manual',
      application_fee_amount: platformFee,
      transfer_data: {
        destination: application.creator.stripeAccountId,
      },
      metadata: {
        applicationId: application.id,
        campaignId: application.campaignId,
      },
    }, {
      idempotencyKey: `application:${application.id}:payment-intent`,
    })

    await prisma.application.update({
      where: { id: application.id },
      data: { paymentIntentId: paymentIntent.id },
    })

    return Response.json({ clientSecret: paymentIntent.client_secret })
  } catch (err) {
    console.error('[POST /api/stripe/create-intent]', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
