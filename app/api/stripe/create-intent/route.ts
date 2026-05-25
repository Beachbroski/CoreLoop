import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import { stripe } from '@/lib/stripe'
import prisma from '@/lib/prisma'
import { calculatePlatformFee } from '@/lib/utils'

const schema = z.object({
  applicationId: z.string().min(1),
})

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const user = await prisma.user.findUnique({ where: { clerkId: userId } })
    if (!user) return Response.json({ error: 'User not found' }, { status: 404 })
    if (user.role !== 'BRAND') {
      return Response.json({ error: 'Only brands can create payment intents' }, { status: 403 })
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
    if (!application.creator.stripeAccountId) {
      return Response.json({ error: 'Creator has not connected Stripe' }, { status: 400 })
    }

    const platformFee = calculatePlatformFee(application.proposedRate)

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
