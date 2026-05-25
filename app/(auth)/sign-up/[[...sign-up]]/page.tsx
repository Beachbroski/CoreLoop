import { SignUp } from '@clerk/nextjs'
import { authClerkAppearance } from '@/lib/clerk-appearance'

export default function SignUpPage() {
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
              Join the loop
            </span>
            <h1 className="auth-hero-title">
              Create an account and make your side of the marketplace magnetic.
            </h1>
            <p className="auth-hero-copy">
              Brands can publish cleaner briefs. Creators can find better-fit work and get paid without friction.
            </p>
          </div>
        </section>

        <section className="auth-panel auth-panel-center">
          <div className="auth-panel-inner auth-panel-center-inner">
            <div className="auth-clerk-shell">
              <SignUp
                appearance={authClerkAppearance}
                oauthFlow="redirect"
                fallbackRedirectUrl="/onboarding"
                signInUrl="/sign-in"
              />
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
