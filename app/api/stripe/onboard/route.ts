import { auth } from '@clerk/nextjs/server'
import { stripe } from '@/lib/stripe'
import prisma from '@/lib/prisma'
import { getSiteUrl } from '@/lib/site-url'

export async function POST(_req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const user = await prisma.user.findUnique({ where: { clerkId: userId } })
    if (!user) return Response.json({ error: 'User not found' }, { status: 404 })
    if (user.role !== 'CREATOR') {
      return Response.json({ error: 'Only creators can connect Stripe' }, { status: 403 })
    }

    const siteUrl = getSiteUrl()
    if (!siteUrl) {
      return Response.json({ error: 'Missing site URL configuration' }, { status: 500 })
    }

    let stripeAccountId = user.stripeAccountId

    if (!stripeAccountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        email: user.email,
        capabilities: {
          transfers: { requested: true },
        },
      })
      stripeAccountId = account.id
      await prisma.user.update({
        where: { id: user.id },
        data: { stripeAccountId },
      })
    }

    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: `${siteUrl}/creator/settings`,
      return_url: `${siteUrl}/creator/settings?onboarded=true`,
      type: 'account_onboarding',
    })

    return Response.json({ url: accountLink.url })
  } catch (err) {
    console.error('[POST /api/stripe/onboard]', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
