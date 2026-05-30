import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import { requireAdminApiUser } from '@/lib/admin-api-guard'
import { stripe } from '@/lib/stripe'
import prisma from '@/lib/prisma'
import { calculatePlatformFee } from '@/lib/utils'
import { checkRateLimit, getRequestIp, isTrustedOrigin } from '@/lib/request-security'
import { validatePaymentIntentForApplication } from '@/lib/stripe-payments'

const schema = z.object({
  applicationId: z.string().min(1),
})

export async function POST(req: Request) {
  try {
    if (!isTrustedOrigin(req)) {
      return Response.json({ error: 'Invalid request origin' }, { status: 403 })
    }

    const adminGate = await requireAdminApiUser()
    if (adminGate.response) return adminGate.response

    const { userId } = await auth()
    if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const user = await prisma.user.findUnique({ where: { clerkId: userId } })
    if (!user) return Response.json({ error: 'User not found' }, { status: 404 })
    if (user.role !== 'BRAND') {
      return Response.json({ error: 'Only brands can create payment intents' }, { status: 403 })
    }

    const rateLimit = checkRateLimit(`stripe:create-intent:${user.id}:${getRequestIp(req)}`, {
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

    const platformFee = calculatePlatformFee(application.proposedRate)

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
