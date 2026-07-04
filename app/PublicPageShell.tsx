import Link from 'next/link'
import { AdminPreviewBanner } from './AdminPreviewBanner'
import { PublicWaitlistLink } from './PublicWaitlistLink'

interface PublicPageShellProps {
  variant?: 'content' | 'form'
  eyebrow?: string
  title?: string
  description?: string
  children: React.ReactNode
}

function PublicNav({ variant }: { variant: 'content' | 'form' }) {
  return (
    <nav className={`apple-nav public-nav public-nav-${variant}`}>
      <Link href="/" className="brand-lockup">
        <span className="brand-mark" />
        <span className="brand-wordmark">CreatorDocks</span>
      </Link>

      {variant === 'form' ? (
        <div className="nav-links">
          <Link href="/" className="nav-link">← Back to site</Link>
        </div>
      ) : (
        <>
          <div className="nav-links">
            <Link href="/#how-it-works" className="nav-link">How it works</Link>
            <Link href="/#local-brands" className="nav-link">Local brands</Link>
          </div>
          <PublicWaitlistLink className="apple-btn public-nav-cta">Join waitlist</PublicWaitlistLink>
        </>
      )}
    </nav>
  )
}

function PublicFooter() {
  const year = new Date().getFullYear()

  return (
    <footer className="public-footer apple-shell">
      <div className="brand-lockup">
        <span className="brand-mark" />
        <span className="brand-wordmark">CreatorDocks</span>
      </div>
      <div className="public-footer-links">
        <Link href="/privacy" className="footer-link">Privacy</Link>
        <Link href="/terms" className="footer-link">Terms</Link>
        <Link href="/support" className="footer-link">Support</Link>
        <Link href="/sign-in" className="footer-link tester-link">Tester sign in</Link>
      </div>
      {/* Social links placeholder: add TikTok/Instagram/X handles once finalized. */}
      <p className="public-footer-copy">© CreatorDocks {year}</p>
    </footer>
  )
}

export function PublicPageShell({
  variant = 'content',
  eyebrow,
  title,
  description,
  children,
}: PublicPageShellProps) {
  const hasIntro = Boolean(eyebrow || title || description)

  return (
    <div>
      <AdminPreviewBanner />
      <PublicNav variant={variant} />

      <main className="apple-shell" style={{ paddingTop: hasIntro ? 28 : 0, paddingBottom: 60 }}>
        {hasIntro ? (
          <section className="section-frame subtle-grid spacing-xl">
            <div style={{ maxWidth: 820 }}>
              {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
              {title ? <h1 className="page-title" style={{ marginTop: 18, marginBottom: 12 }}>{title}</h1> : null}
              {description ? <p className="page-copy" style={{ margin: 0, maxWidth: 720 }}>{description}</p> : null}
            </div>

            <div className="subtle-grid">
              {children}
            </div>
          </section>
        ) : children}
      </main>

      <PublicFooter />
    </div>
  )
}
