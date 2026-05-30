import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="auth-shell">
      <div className="section-frame subtle-grid spacing-xl" style={{ width: 'min(760px, 100%)', textAlign: 'center' }}>
        <div className="brand-lockup" style={{ justifyContent: 'center' }}>
          <span className="brand-mark" />
          <span className="brand-wordmark">CreatorDocks</span>
        </div>

        <div>
          <span className="eyebrow">404</span>
          <h1 className="page-title" style={{ marginTop: 18, marginBottom: 12 }}>
            That page does not exist.
          </h1>
          <p className="page-copy" style={{ margin: 0, maxWidth: 560, marginInline: 'auto' }}>
            The link may be broken, the page may have moved, or you may have reached a route that is not public yet.
          </p>
        </div>

        <div className="cta-row" style={{ justifyContent: 'center' }}>
          <Link href="/" className="apple-btn">Go home</Link>
          <Link href="/sign-in" className="apple-btn-ghost">Sign in</Link>
        </div>
      </div>
    </main>
  )
}
