import { SignUp } from '@clerk/nextjs'

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
                appearance={{
                  variables: {
                    colorPrimary: '#0071e3',
                    colorBackground: '#ffffff',
                    colorInputBackground: '#f5f5f7',
                    colorInputText: '#1d1d1f',
                    colorText: '#1d1d1f',
                    colorTextSecondary: '#6e6e73',
                    colorDanger: '#ff3b30',
                    borderRadius: '18px',
                    fontFamily: '"Plus Jakarta Sans", sans-serif',
                    fontSize: '17px',
                  },
                  elements: {
                    rootBox: 'w-full',
                    cardBox: 'w-full',
                    card: 'shadow-none border border-[rgba(15,23,42,0.08)] rounded-[28px]',
                    formButtonPrimary: 'rounded-full font-medium',
                  },
                }}
              />
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
