import { SignIn } from '@clerk/nextjs'

export default function SignInPage() {
  return (
    <main className="auth-shell">
      <div className="auth-card">
        <section className="auth-hero" style={{ display: 'grid', gap: 22 }}>
          <div className="brand-lockup">
            <span className="brand-mark" />
            <span className="brand-wordmark">CoreLoop</span>
          </div>
          <div>
            <span className="eyebrow" style={{ color: 'white', background: 'rgba(255,255,255,0.12)', borderColor: 'rgba(255,255,255,0.16)' }}>
              Welcome back
            </span>
            <h1 style={{ fontSize: 'clamp(2.8rem, 5vw, 4.4rem)', lineHeight: 0.95, letterSpacing: '-0.06em', margin: '20px 0 12px' }}>
              Sign in and pick up where the deal left off.
            </h1>
            <p style={{ margin: 0, color: 'rgba(255,255,255,0.76)', fontSize: '1.05rem', lineHeight: 1.7 }}>
              Campaigns, applications, approvals, and payout steps are all waiting in one place.
            </p>
          </div>
        </section>

        <section className="auth-panel" style={{ display: 'grid', placeItems: 'center' }}>
          <div style={{ display: 'grid', gap: 24, justifyItems: 'center' }}>
            <div style={{ textAlign: 'center' }}>
              <p style={{ margin: '0 0 8px', color: 'var(--text-faint)', fontSize: '.82rem', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' }}>
                Account access
              </p>
              <h2 className="page-title" style={{ marginBottom: 10 }}>Sign in to CoreLoop</h2>
              <p className="page-copy" style={{ margin: 0 }}>Continue to your creator or brand workspace.</p>
            </div>
        <SignIn
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
              card: 'shadow-none border border-[rgba(15,23,42,0.08)] rounded-[28px]',
              formButtonPrimary: 'rounded-full font-medium',
            },
          }}
        />
          </div>
        </section>
      </div>
    </main>
  )
}
