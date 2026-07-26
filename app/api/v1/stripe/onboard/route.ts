import prisma from '@/lib/prisma'
import { withMobileApi } from '@/lib/mobile-api-guard'
import { stripe } from '@/lib/stripe'
import { getSiteUrl } from '@/lib/site-url'
import { stripeOnboardResponseSchema } from '@creatordocks/shared'

export const POST = withMobileApi(
  { rateLimit: { limit: 5, windowMs: 60_000 }, role: 'CREATOR' },
  async ({ user }) => {
    const siteUrl = getSiteUrl()
    if (!siteUrl) {
      return Response.json({ success: false, error: 'Missing site URL configuration' }, { status: 500 })
    }

    const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { stripeAccountId: true, email: true } })
    if (!dbUser) return Response.json({ success: false, error: 'Not found' }, { status: 404 })

    let stripeAccountId = dbUser.stripeAccountId

    if (!stripeAccountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        email: dbUser.email,
        capabilities: { transfers: { requested: true } },
      })
      stripeAccountId = account.id
      await prisma.user.update({ where: { id: user.id }, data: { stripeAccountId } })
    }

    // Reuses the web return/refresh destination for now — there's no app
    // URL scheme to deep-link into yet. Revisit once the iOS app (W3)
    // registers creatordocks:// and can own dedicated return/refresh pages
    // (see docs/platform-split/04-payments-payouts.md, W4-1).
    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: `${siteUrl}/creator/settings`,
      return_url: `${siteUrl}/creator/settings?onboarded=true`,
      type: 'account_onboarding',
    })

    return Response.json({ success: true, data: stripeOnboardResponseSchema.parse({ url: accountLink.url }) })
  },
)
