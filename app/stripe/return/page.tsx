import { STRIPE_RETURN_DEEP_LINK } from '@creatordocks/shared'

import { PublicPageShell } from '@/app/PublicPageShell'
import { StripeAppHandoff } from '@/app/stripe/StripeAppHandoff'

/**
 * `return_url` for the iOS Stripe Connect account link.
 *
 * Public by necessity: Stripe sends the creator here inside an in-app browser
 * that carries no Clerk session, so a protected page would show a sign-in wall
 * at the end of payout setup. It is registered in `proxy.ts` accordingly, and
 * it discloses nothing — there is no account data on this page, only a
 * redirect. It also sits outside `app/(dashboard)/creator`, so the
 * CREATOR_WEB_MODE sunset redirect cannot strand it.
 *
 * Reaching this page does NOT mean onboarding succeeded — Stripe sends
 * creators here whenever it is finished with them, including when they quit
 * partway. The app decides, by re-reading `GET /api/v1/stripe/status`, which
 * retrieves the live account rather than trusting this redirect.
 */
export const metadata = {
  title: 'Returning to CreatorDocks',
  robots: { index: false, follow: false },
}

export default function StripeReturnPage() {
  return (
    <PublicPageShell
      eyebrow="Payouts"
      title="Taking you back to the app."
      description="Stripe has finished with payout setup. CreatorDocks will pick up from here."
    >
      <StripeAppHandoff
        deepLink={STRIPE_RETURN_DEEP_LINK}
        message="Reopening CreatorDocks…"
      />
    </PublicPageShell>
  )
}
