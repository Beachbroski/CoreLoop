import Link from 'next/link'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import prisma from '@/lib/prisma'
import { HomeAudienceTabs } from './HomeAudienceTabs'

const heroSignals = [
  { value: 'One place', label: 'for briefs, applications, submissions, and payouts' },
  { value: '15%', label: 'flat fee with clean escrow-backed payment flow' },
  { value: 'All major platforms', label: 'TikTok, Instagram, YouTube, X, and Discord' },
]

const howItWorks = [
  {
    step: '01',
    title: 'Post or discover the right campaign',
    copy: 'Brands launch briefs fast. Creators browse opportunities that fit their niche and platforms.',
  },
  {
    step: '02',
    title: 'Apply, review, and accept inside the platform',
    copy: 'Pitches, rates, and approvals live in one workflow instead of DMs, inboxes, and spreadsheets.',
  },
  {
    step: '03',
    title: 'Submit content and review with less friction',
    copy: 'The work gets delivered inside CoreLoop, with a cleaner loop for revisions and approval.',
  },
  {
    step: '04',
    title: 'Release payment automatically on approval',
    copy: 'Escrow-backed payouts make it easier for brands to trust the process and creators to trust the outcome.',
  },
]

const trustCards = [
  {
    title: 'Escrow creates real trust',
    copy: 'Brands do not release money before approval, and creators do not wonder whether payment is going to disappear after delivery.',
  },
  {
    title: 'No spreadsheets or payout chasing',
    copy: 'The platform replaces scattered ops work with one clean system for discovery, review, delivery, and payment.',
  },
  {
    title: 'Built for modern creator work',
    copy: 'CoreLoop is not locked to one social platform, one gig format, or one clunky enterprise workflow.',
  },
]

const credibilityCards = [
  {
    title: 'Built for early DTC and consumer brands',
    copy: 'A better fit for teams that need creator campaigns to move quickly without paying for enterprise software.',
  },
  {
    title: 'Made for micro and mid-tier creators',
    copy: 'A cleaner path for creators who have real audience influence but not a giant inbound pipeline.',
  },
  {
    title: 'Designed around the actual transaction',
    copy: 'The value is not just discovery. It is the workflow from brief to delivery to approved payout.',
  },
]

const faqs = [
  {
    question: 'When does the creator get paid?',
    answer: 'Payment is released after the brand approves the content, which keeps the process clear and safer on both sides.',
  },
  {
    question: 'What happens if revisions are needed?',
    answer: 'Content stays inside the platform so brands can request changes and creators can resubmit without the process breaking into side channels.',
  },
  {
    question: 'Which platforms can campaigns run on?',
    answer: 'CoreLoop supports workflows across TikTok, Instagram, YouTube, X, and Discord instead of locking everyone into one channel.',
  },
]

export default async function HomePage() {
  const { userId } = await auth()

  if (userId) {
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { role: true },
    })

    if (!user) redirect('/onboarding')
    if (user.role === 'BRAND') redirect('/brand')
    if (user.role === 'CREATOR') redirect('/creator')
    redirect('/onboarding')
  }

  return (
    <div>
      <nav className="apple-nav">
        <Link href="/" className="brand-lockup">
          <span className="brand-mark" />
          <span className="brand-wordmark">CoreLoop</span>
        </Link>
        <div className="nav-links">
          <a href="#offers" className="nav-link">What You Get</a>
          <a href="#how-it-works" className="nav-link">How It Works</a>
          <a href="#why-coreloop" className="nav-link">Why CoreLoop</a>
          <Link href="/sign-in" className="apple-btn-ghost">Sign in</Link>
        </div>
        <Link href="/sign-up" className="apple-btn mobile-nav-cta">Get started</Link>
      </nav>

      <main className="apple-shell">
        <section className="hero-grid">
          <div className="hero-copy-stack">
            <span className="eyebrow">Creator campaigns without the mess</span>
            <h1 className="hero-title">A cleaner way for brands and creators to work together.</h1>
            <p className="hero-copy">
              CoreLoop brings discovery, applications, delivery, approval, and payout into one premium workflow
              so both sides can focus on the work instead of the chaos around it.
            </p>
            <div className="cta-row">
              <Link href="/sign-up" className="apple-btn">Get started</Link>
              <a href="#how-it-works" className="apple-btn-ghost">See how it works</a>
            </div>
            <div className="chip-row">
              <span className="pill">Escrow-backed payouts</span>
              <span className="pill">Fast campaign setup</span>
              <span className="pill">Cross-platform by default</span>
            </div>
          </div>

          <div className="hero-stage">
            <div className="hero-orb one" />
            <div className="hero-orb two" />
            <div className="dashboard-stack">
              <div className="glass-card" style={{ paddingBottom: 18 }}>
                <div className="split-row" style={{ marginBottom: 18 }}>
                  <div>
                    <p style={{ margin: '0 0 4px', color: 'var(--text-faint)', fontSize: '.82rem', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' }}>
                      The core loop
                    </p>
                    <h2 style={{ margin: 0, fontSize: '1.7rem', letterSpacing: '-0.04em' }}>
                      Discover. Deliver. Approve. Get paid.
                    </h2>
                  </div>
                  <span className="status-pill" style={{ background: 'var(--success-soft)', color: 'var(--success)' }}>
                    Built for trust
                  </span>
                </div>

                <div className="subtle-grid">
                  {heroSignals.map(signal => (
                    <div key={signal.label} className="list-row" style={{ padding: '0 0 14px' }}>
                      <div>
                        <p style={{ margin: '0 0 4px', fontWeight: 600 }}>{signal.value}</p>
                        <p style={{ margin: 0, color: 'var(--text-soft)', fontSize: '.94rem' }}>{signal.label}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="subtle-grid two-col">
                <div className="glass-card">
                  <p style={{ margin: '0 0 10px', color: 'var(--text-faint)', fontSize: '.82rem', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' }}>
                    For brands
                  </p>
                  <div className="subtle-grid" style={{ gap: 10 }}>
                    {['Launch briefs fast', 'Review creators in one place', 'Approve before payout releases'].map(item => (
                      <div key={item} className="pill" style={{ justifyContent: 'flex-start' }}>{item}</div>
                    ))}
                  </div>
                </div>

                <div
                  className="glass-card"
                  style={{ background: 'linear-gradient(180deg, rgba(17,24,39,0.96), rgba(16,34,71,0.95))', color: 'white' }}
                >
                  <p style={{ margin: '0 0 10px', color: 'rgba(255,255,255,0.65)', fontSize: '.82rem', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' }}>
                    For creators
                  </p>
                  <p style={{ margin: '0 0 10px', fontSize: '2.5rem', lineHeight: 0.95, letterSpacing: '-0.05em' }}>
                    Better deals, less chasing
                  </p>
                  <p style={{ margin: '0 0 18px', color: 'rgba(255,255,255,0.72)' }}>
                    Apply quickly, submit work cleanly, and let the payout happen through the platform.
                  </p>
                  <div className="chip-row">
                    <span className="pill" style={{ background: 'rgba(255,255,255,0.12)', borderColor: 'rgba(255,255,255,0.12)', color: 'white' }}>
                      Clear budgets
                    </span>
                    <span className="pill" style={{ background: 'rgba(255,255,255,0.12)', borderColor: 'rgba(255,255,255,0.12)', color: 'white' }}>
                      Automatic payouts
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="marketing-section">
          <div className="section-frame subtle-grid spacing-xl">
            <div style={{ maxWidth: 760 }}>
              <span className="eyebrow">Why teams start here</span>
              <h2 className="section-title" style={{ marginTop: 18, marginBottom: 12 }}>
                Built for the real middle of creator work, where speed and trust matter more than enterprise overhead.
              </h2>
              <p className="section-copy" style={{ margin: 0 }}>
                CoreLoop is shaped for growing brands and working creators who need a serious workflow before they need an agency or a sales-led platform.
              </p>
            </div>

            <div className="bento-grid">
              {credibilityCards.map((card, index) => (
                <section
                  key={card.title}
                  className={`dashboard-panel bento-card ${index === 0 ? 'bento-card-wide' : ''}`}
                >
                  <h2>{card.title}</h2>
                  <p className="section-copy" style={{ margin: 0 }}>{card.copy}</p>
                </section>
              ))}
            </div>
          </div>
        </section>

        <section id="offers" className="marketing-section">
          <HomeAudienceTabs />
        </section>

        <section id="how-it-works" className="marketing-section">
          <div className="section-frame subtle-grid" style={{ gap: 24 }}>
            <div style={{ maxWidth: 760 }}>
              <span className="eyebrow">How it works</span>
              <h2 className="section-title" style={{ marginTop: 18, marginBottom: 12 }}>
                The full loop is short, clear, and built to keep momentum alive.
              </h2>
              <p className="section-copy" style={{ margin: 0 }}>
                CoreLoop is designed so the transaction feels obvious from both sides, from the first brief to the final payout.
              </p>
            </div>

            <div className="feature-grid">
              {howItWorks.map(item => (
                <article key={item.step} className="feature-card">
                  <span className="eyebrow" style={{ marginBottom: 16 }}>{item.step}</span>
                  <h3>{item.title}</h3>
                  <p className="section-copy" style={{ margin: 0 }}>{item.copy}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="why-coreloop" className="marketing-section">
          <div className="section-frame subtle-grid spacing-xl">
            <div style={{ maxWidth: 760 }}>
              <span className="eyebrow">Why CoreLoop</span>
              <h2 className="section-title" style={{ marginTop: 18, marginBottom: 12 }}>
                The platform feels better because the messy parts are finally in the product.
              </h2>
              <p className="section-copy" style={{ margin: 0 }}>
                The biggest pain in creator work is rarely finding the idea. It is everything around the transaction. CoreLoop is designed around that reality.
              </p>
            </div>

            <div className="bento-grid">
            {trustCards.map((card, index) => (
              <section key={card.title} className={`dashboard-panel bento-card ${index === 2 ? 'bento-card-wide' : ''}`}>
                <h2>{card.title}</h2>
                <p className="section-copy" style={{ margin: 0 }}>{card.copy}</p>
              </section>
            ))}
            </div>
          </div>
        </section>

        <section className="marketing-section">
          <div className="section-frame subtle-grid spacing-xl">
            <div style={{ maxWidth: 760 }}>
              <span className="eyebrow">FAQ</span>
              <h2 className="section-title" style={{ marginTop: 18, marginBottom: 12 }}>
                The questions both sides usually ask first.
              </h2>
              <p className="section-copy" style={{ margin: 0 }}>
                Keep the promise simple: cleaner briefs, clearer approvals, and payment that feels safer from both sides.
              </p>
            </div>

            <div className="faq-grid">
              {faqs.map(faq => (
                <section key={faq.question} className="dashboard-panel">
                  <h2>{faq.question}</h2>
                  <p className="section-copy" style={{ margin: 0 }}>{faq.answer}</p>
                </section>
              ))}
            </div>
          </div>
        </section>

        <section className="marketing-section" style={{ paddingBottom: 72 }}>
          <div
            className="section-frame"
            style={{ background: 'linear-gradient(180deg, rgba(10,18,34,0.96), rgba(18,42,84,0.96))', color: 'white' }}
          >
            <div className="page-header" style={{ marginBottom: 20 }}>
              <div style={{ maxWidth: 760 }}>
                <span className="eyebrow" style={{ color: 'white', background: 'rgba(255,255,255,0.12)', borderColor: 'rgba(255,255,255,0.16)' }}>
                  Ready to start
                </span>
                <h2 className="section-title" style={{ marginTop: 18, marginBottom: 12, color: 'white' }}>
                  Join the marketplace that makes creator work feel more professional.
                </h2>
                <p style={{ margin: 0, color: 'rgba(255,255,255,0.76)', lineHeight: 1.7, fontSize: '1rem' }}>
                  Launch your first campaign or build your creator track record in a workflow that feels calmer, faster, and easier to trust.
                </p>
              </div>
              <Link href="/sign-up" className="apple-btn">Create your account</Link>
            </div>

            <div className="chip-row">
              <span className="pill" style={{ background: 'rgba(255,255,255,0.12)', borderColor: 'rgba(255,255,255,0.12)', color: 'white' }}>
                Stripe-powered payouts
              </span>
              <span className="pill" style={{ background: 'rgba(255,255,255,0.12)', borderColor: 'rgba(255,255,255,0.12)', color: 'white' }}>
                Secure auth
              </span>
              <span className="pill" style={{ background: 'rgba(255,255,255,0.12)', borderColor: 'rgba(255,255,255,0.12)', color: 'white' }}>
                Multi-platform workflow
              </span>
            </div>
          </div>
        </section>
      </main>

      <footer className="apple-shell" style={{ paddingBottom: 30 }}>
        <div className="section-frame" style={{ paddingTop: 20, paddingBottom: 20 }}>
          <div className="split-row">
            <div className="brand-lockup">
              <span className="brand-mark" />
              <span className="brand-wordmark">CoreLoop</span>
            </div>
            <div className="chip-row">
              <a href="#offers" className="footer-link">What You Get</a>
              <a href="#how-it-works" className="footer-link">How It Works</a>
              <a href="#why-coreloop" className="footer-link">Why CoreLoop</a>
              <Link href="/privacy" className="footer-link">Privacy</Link>
              <Link href="/terms" className="footer-link">Terms</Link>
              <Link href="/support" className="footer-link">Support</Link>
            </div>
            <p style={{ margin: 0, color: 'var(--text-soft)', fontSize: '.92rem' }}>
              © {new Date().getFullYear()} CoreLoop
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
