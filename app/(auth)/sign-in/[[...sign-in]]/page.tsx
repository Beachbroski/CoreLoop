import Link from 'next/link'
import { SignIn } from '@clerk/nextjs'
import { authClerkAppearance } from '@/lib/clerk-appearance'

export default function SignInPage() {
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
              CreatorDocks dashboard
            </span>
            <h1 className="auth-hero-title">
              Sign in to your campaigns.
            </h1>
            <p className="auth-hero-copy">
              Briefs, creator applications, content review, approvals, and payouts all live behind this sign-in.
            </p>
            <p className="auth-hero-copy" style={{ marginTop: 14 }}>
              No account yet? <Link href="/waitlist" className="apple-link">Request access</Link>
            </p>
          </div>
        </section>

        <section className="auth-panel auth-panel-center">
          <div className="auth-panel-inner auth-panel-center-inner">
            <div className="auth-clerk-shell">
              <SignIn
                appearance={authClerkAppearance}
                oauthFlow="redirect"
                forceRedirectUrl="/post-login"
                fallbackRedirectUrl="/post-login"
                signUpUrl="/sign-up"
              />
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
