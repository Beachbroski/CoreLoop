import Link from 'next/link'
import { SignUp } from '@clerk/nextjs'
import { authClerkAppearance } from '@/lib/clerk-appearance'

/**
 * Brand sign-up. Until 2026-09-07 this route redirected to the creator
 * waitlist, which meant there was no way for a brand to create an account at
 * all -- and the waitlist invite email pointed here, so an invited brand
 * bounced straight back to the form they had already filled in.
 *
 * Creating an account is not the same as being let into the marketplace:
 * `MARKETPLACE_ACCESS` still decides that (lib/admin-config.ts), and while it
 * is `invite` a new account lands on /waitlist via /post-login. So this page is
 * safe to ship before the platform opens.
 */
export default function SignUpPage() {
  return (
    <main className="auth-shell">
      <div className="auth-card">
        <section className="auth-hero auth-hero-stack">
          <div className="brand-lockup">
            <span className="brand-mark" />
            <span className="brand-wordmark">CreatorDocks</span>
          </div>
          <div>
            <span className="eyebrow auth-hero-eyebrow">
              For local brands
            </span>
            <h1 className="auth-hero-title">
              Start hiring local creators.
            </h1>
            <p className="auth-hero-copy">
              Post a campaign, review applications from creators near you, and pay only for work you approve.
            </p>
            <p className="auth-hero-copy" style={{ marginTop: 14 }}>
              Already have an account? <Link href="/sign-in" className="apple-link">Sign in</Link>
            </p>
            <p className="auth-hero-copy" style={{ marginTop: 14 }}>
              Creator? <Link href="/get-the-app" className="apple-link">Get the iOS app</Link>
            </p>
          </div>
        </section>

        <section className="auth-panel auth-panel-center">
          <div className="auth-panel-inner auth-panel-center-inner">
            <div className="auth-clerk-shell">
              <SignUp
                appearance={authClerkAppearance}
                oauthFlow="redirect"
                forceRedirectUrl="/post-login"
                fallbackRedirectUrl="/post-login"
                signInUrl="/sign-in"
              />
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
