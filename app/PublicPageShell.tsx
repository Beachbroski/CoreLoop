import Link from 'next/link'

interface PublicPageShellProps {
  eyebrow: string
  title: string
  description: string
  children: React.ReactNode
}

export function PublicPageShell({
  eyebrow,
  title,
  description,
  children,
}: PublicPageShellProps) {
  return (
    <div>
      <nav className="apple-nav">
        <Link href="/" className="brand-lockup">
          <span className="brand-mark" />
          <span className="brand-wordmark">CoreLoop</span>
        </Link>
        <div className="nav-links">
          <Link href="/" className="nav-link">Home</Link>
          <Link href="/privacy" className="nav-link">Privacy</Link>
          <Link href="/terms" className="nav-link">Terms</Link>
          <Link href="/support" className="nav-link">Support</Link>
          <Link href="/sign-in" className="apple-btn-ghost">Sign in</Link>
        </div>
        <Link href="/sign-up" className="apple-btn mobile-nav-cta">Get started</Link>
      </nav>

      <main className="apple-shell" style={{ paddingTop: 28, paddingBottom: 60 }}>
        <section className="section-frame subtle-grid spacing-xl">
          <div style={{ maxWidth: 820 }}>
            <span className="eyebrow">{eyebrow}</span>
            <h1 className="page-title" style={{ marginTop: 18, marginBottom: 12 }}>{title}</h1>
            <p className="page-copy" style={{ margin: 0, maxWidth: 720 }}>{description}</p>
          </div>

          <div className="subtle-grid">
            {children}
          </div>
        </section>
      </main>
    </div>
  )
}
