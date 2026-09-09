import { STRIPE_REFRESH_DEEP_LINK } from '@creatordocks/shared'

import { PublicPageShell } from '@/app/PublicPageShell'
import { StripeAppHandoff } from '@/app/stripe/StripeAppHandoff'

/**
 * `refresh_url` for the iOS Stripe Connect account link.
 *
 * Stripe sends the creator here when the link itself is no longer usable —
 * account links are single-use and expire — rather than when onboarding
 * failed. The recovery is simply to mint a new link, which is what the app
 * does when it comes back and finds the account still not onboarded.
 *
 * Public and outside `app/(dashboard)/creator` for the same reasons as
 * `/stripe/return`; see the note there.
 */
export const metadata = {
  title: 'Returning to CreatorDocks',
  robots: { index: false, follow: false },
}

export default function StripeRefreshPage() {
  return (
    <PublicPageShell
      eyebrow="Payouts"
      title="That setup link expired."
      description="Nothing is lost. CreatorDocks will start payout setup again from where you left off."
    >
      <StripeAppHandoff
        deepLink={STRIPE_REFRESH_DEEP_LINK}
        message="Reopening CreatorDocks…"
      />
    </PublicPageShell>
  )
}
