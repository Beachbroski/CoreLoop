'use client'

import { useEffect, useState } from 'react'

/**
 * Bounces a Stripe Connect return straight back into the iOS app.
 *
 * Stripe only accepts an `https://` URL for a Connect account link's
 * `return_url`/`refresh_url`, so onboarding cannot hand control back to the app
 * directly. It lands here instead, and this navigates to the app's own scheme.
 * The app opened this flow with `openAuthSessionAsync`, which watches for that
 * scheme and closes the in-app browser the moment it appears — so in the normal
 * case nobody reads a word of this page.
 *
 * `location.replace` rather than `assign`, so that if the browser does stay
 * open, Back does not walk the creator into a second handoff.
 */
export function StripeAppHandoff({ deepLink, message }: { deepLink: string; message: string }) {
  // Rendered only after the automatic attempt has had its chance. Showing the
  // manual link immediately would put "having trouble?" in front of every
  // creator during the split second before the sheet closes.
  const [showFallback, setShowFallback] = useState(false)

  useEffect(() => {
    window.location.replace(deepLink)

    // Nothing here can observe whether the scheme was handled — a blocked or
    // unregistered scheme fails silently, and this page is still on screen
    // either way. The timer is the only signal that the automatic path did not
    // work, which is the case where a creator needs something to tap: a desktop
    // browser, or an in-app browser that refuses custom schemes.
    const timer = window.setTimeout(() => setShowFallback(true), 2000)
    return () => window.clearTimeout(timer)
  }, [deepLink])

  return (
    <section className="dashboard-panel">
      <p className="page-copy" style={{ margin: 0 }}>
        {message}
      </p>
      {showFallback && (
        <p className="page-copy" style={{ marginBottom: 0 }}>
          Still here? <a href={deepLink} className="apple-link">Open CreatorDocks</a>, or switch back
          to the app manually — your payout setup has been saved either way.
        </p>
      )}
    </section>
  )
}
