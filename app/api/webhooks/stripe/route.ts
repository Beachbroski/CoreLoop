import { headers } from 'next/headers'
import { stripe } from '@/lib/stripe'
import prisma from '@/lib/prisma'

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
        await prisma.payout.updateMany({
          where: { submission: { application: { paymentIntentId: pi.id } } },
          data: { status: 'PAID' },
        })
        break
      }

      case 'payment_intent.payment_failed': {
        const pi = event.data.object
        await prisma.payout.updateMany({
          where: { submission: { application: { paymentIntentId: pi.id } } },
          data: { status: 'FAILED' },
        })
        break
      }

      case 'account.updated': {
        const account = event.data.object
        if (account.charges_enabled) {
          await prisma.user.updateMany({
            where: { stripeAccountId: account.id },
            data: { stripeOnboarded: true },
          })
        }
        break
      }
    }
  } catch (err) {
    console.error('[stripe webhook] handler error', err)
    return new Response('Handler error', { status: 500 })
  }

  return Response.json({ received: true })
}
