import prisma from '@/lib/prisma'
import { withMobileApi } from '@/lib/mobile-api-guard'
import { stripe } from '@/lib/stripe'
import { getSiteUrl } from '@/lib/site-url'
import {
  STRIPE_REFRESH_PATH,
  STRIPE_RETURN_PATH,
  stripeOnboardResponseSchema,
} from '@creatordocks/shared'

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

    // W4-1. These used to point at `/creator/settings`, a Clerk-protected page:
    // the creator finished Stripe inside the app's in-app browser, landed on a
    // web sign-in wall, and never got back to the app. Both paths now go to
    // public pages that immediately redirect to `creatordocks://`, which is
    // what closes the browser sheet.
    //
    // Stripe requires https here, so the app cannot be named directly — the
    // bounce page is the only way to get from a Connect link back into the app.
    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: `${siteUrl}${STRIPE_REFRESH_PATH}`,
      return_url: `${siteUrl}${STRIPE_RETURN_PATH}`,
      type: 'account_onboarding',
    })

    return Response.json({ success: true, data: stripeOnboardResponseSchema.parse({ url: accountLink.url }) })
  },
)
