import { SignIn } from '@clerk/nextjs'
import { authClerkAppearance } from '@/lib/clerk-appearance'

export default function SignInPage() {
  return (
    <main className="auth-shell">
      <div className="auth-card">
        <section className="auth-hero auth-hero-stack">
          <div className="brand-lockup">
            <span className="brand-mark" />
            <span className="brand-wordmark">CoreLoop</span>
          </div>
          <div>
            <span className="eyebrow auth-hero-eyebrow">
              Welcome back
            </span>
            <h1 className="auth-hero-title">
              Sign in and pick up where the deal left off.
            </h1>
            <p className="auth-hero-copy">
              Campaigns, applications, approvals, and payout steps are all waiting in one place.
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
