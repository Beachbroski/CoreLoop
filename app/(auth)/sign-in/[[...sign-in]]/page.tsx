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
              Internal dashboard access
            </span>
            <h1 className="auth-hero-title">
              Sign in and jump back into the CreatorDocks test environment.
            </h1>
            <p className="auth-hero-copy">
              Campaigns, applications, approvals, payouts, and internal waitlist ops all live behind this sign-in for approved testers.
            </p>
          </div>
        </section>

        <section className="auth-panel auth-panel-center">
          <div className="auth-panel-inner auth-panel-center-inner">
            <div className="auth-clerk-shell">
              <SignIn
                appearance={authClerkAppearance}
                oauthFlow="redirect"
                forceRedirectUrl="/"
                fallbackRedirectUrl="/"
                signUpUrl="/sign-up"
              />
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
