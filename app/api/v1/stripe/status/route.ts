import prisma from '@/lib/prisma'
import { withMobileApi } from '@/lib/mobile-api-guard'
import { stripe } from '@/lib/stripe'
import { isStripeAccountOnboarded } from '@/lib/stripe-onboarded'
import { stripeStatusResponseSchema } from '@creatordocks/shared'

/**
 * Whether this creator can be paid.
 *
 * Reads the live Stripe account rather than only the `stripeOnboarded` column.
 * The column's other writer is the `account.updated` webhook, and the app
 * cannot depend on that alone: this endpoint is polled the instant onboarding
 * returns, which is a race the webhook frequently loses, and in local
 * development no webhook is delivered at all — so a creator who had genuinely
 * finished stayed "not onboarded" forever, unable to apply to anything
 * (`POST /api/v1/applications` gates on the same column).
 *
 * The retrieved value is written back, so the column stays the fast path for
 * every other reader instead of quietly diverging from Stripe.
 */
export const GET = withMobileApi(
  { rateLimit: { limit: 60, windowMs: 60_000 }, role: 'CREATOR' },
  async ({ user }) => {
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { stripeOnboarded: true, stripeAccountId: true },
    })
    if (!dbUser) return Response.json({ success: false, error: 'Not found' }, { status: 404 })

    // No Connect account yet: nothing to retrieve, and the answer cannot be
    // anything but false.
    if (!dbUser.stripeAccountId) {
      return Response.json({
        success: true,
        data: stripeStatusResponseSchema.parse({ onboarded: false }),
      })
    }

    let onboarded = dbUser.stripeOnboarded

    try {
      const account = await stripe.accounts.retrieve(dbUser.stripeAccountId)
      onboarded = isStripeAccountOnboarded(account)

      if (onboarded !== dbUser.stripeOnboarded) {
        await prisma.user.update({ where: { id: user.id }, data: { stripeOnboarded: onboarded } })
      }
    } catch (err) {
      // Stripe being unreachable is not the creator's problem, and the Earnings
      // tab is the only place they can see their money. Fall back to the stored
      // value — stale at worst — rather than failing the whole screen. A false
      // negative here self-corrects on the next poll or on account.updated.
      console.error('[stripe status] account retrieve failed', err)
    }

    return Response.json({
      success: true,
      data: stripeStatusResponseSchema.parse({ onboarded }),
    })
  },
)
