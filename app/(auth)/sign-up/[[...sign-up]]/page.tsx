import { SignUp } from '@clerk/nextjs'

export default function SignUpPage() {
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
              Join the loop
            </span>
            <h1 style={{ fontSize: 'clamp(2.8rem, 5vw, 4.4rem)', lineHeight: 0.95, letterSpacing: '-0.06em', margin: '20px 0 12px' }}>
              Create an account and make your side of the marketplace magnetic.
            </h1>
            <p style={{ margin: 0, color: 'rgba(255,255,255,0.76)', fontSize: '1.05rem', lineHeight: 1.7 }}>
              Brands can publish cleaner briefs. Creators can find better-fit work and get paid without friction.
            </p>
          </div>
        </section>

        <section className="auth-panel" style={{ display: 'grid', placeItems: 'center' }}>
          <div style={{ display: 'grid', gap: 24, justifyItems: 'center' }}>
            <div style={{ textAlign: 'center' }}>
              <p style={{ margin: '0 0 8px', color: 'var(--text-faint)', fontSize: '.82rem', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' }}>
                Account setup
              </p>
              <h2 className="page-title" style={{ marginBottom: 10 }}>Create your CoreLoop account</h2>
              <p className="page-copy" style={{ margin: 0 }}>Get into the platform and choose your role in a minute.</p>
            </div>
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
