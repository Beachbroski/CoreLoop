import Link from 'next/link'
import { PublicPageShell } from './PublicPageShell'
import { PublicWaitlistLink } from './PublicWaitlistLink'

const localBrandTypes = ['Cafes', 'Gyms', 'Salons', 'Boutiques', 'Home services']

const dealSignals = [
  {
    value: 'Authorized when you accept',
    label: 'A hold lands on your card for the rate you accepted. Posting a brief costs nothing.',
  },
  {
    value: 'Charged when you approve',
    label: 'The hold is only captured after you approve the delivered content.',
  },
  {
    value: '15% platform fee',
    label: 'Taken out of the rate you accepted, never added on top. No retainer, no seats.',
  },
]

const brandSteps = [
  {
    step: '01',
    title: 'Post a brief',
    copy: 'Set the budget, deadline, deliverables, platforms, target audience, usage rights, and how many creators you need. Posting is free and takes a few minutes.',
  },
  {
    step: '02',
    title: 'Review applicants',
    copy: 'Creators apply with a short pitch and the rate they want. Accept the ones that fit — accepting authorizes that rate on your card. Pass on the rest and nothing is held.',
  },
  {
    step: '03',
    title: 'Approve and pay',
    copy: 'The creator submits the content for review. Approve it and we capture the hold and release their payout. Not right yet? Send revision notes or decline — nothing is charged.',
  },
]

const brandDifferences = [
  {
    title: 'Local creators, reviewed by a person',
    copy: 'Everyone on the roster applied and was reviewed by hand before being invited — handle, platform, niche, and audience size. We are starting with creators who live where your customers do, because that is the content that gets someone to walk in, book, or order.',
    wide: true,
  },
  {
    title: 'Pay for results, not reach',
    copy: 'No upfront deposit and no prepaid campaign balance. Money moves one creator at a time: held when you accept them, charged when you approve their work.',
    wide: false,
  },
  {
    title: 'No agency retainer',
    copy: 'No monthly minimum, no seat licenses, no annual contract. Run one campaign a quarter or none at all — you only pay when a collaboration is approved.',
    wide: false,
  },
]

const faqItems = [
  {
    question: 'What does it cost?',
    answer: 'There is no subscription, listing fee, or cost to post a brief. CreatorDocks takes a 15% platform fee on each approved collaboration. Accept a creator at $400 and your card is charged $400 — the fee comes out of that amount rather than being added on top.',
  },
  {
    question: 'How do payments work?',
    answer: 'When you accept an applicant we authorize their rate on your card, so the funds are held but not charged. After they deliver, you approve, request a revision, or decline. Only approval captures the payment and releases the payout to the creator, and payments run on Stripe.',
  },
  {
    question: 'How are creators vetted?',
    answer: 'The roster is invite-led. Creators apply, we review each profile by hand before inviting them, and every creator has to finish Stripe payout onboarding — so their identity and bank details are verified — before a brand can accept them.',
  },
  {
    question: 'When can I start?',
    answer: 'Access is invite-led while we build creator supply city by city, so there is no instant self-serve signup yet. Request access with your email and we will get in touch to open your account and help shape your first brief.',
  },
]

export default function HomePage() {
  return (
    <PublicPageShell>
        <section className="hero-grid">
          <div className="hero-copy-stack">
            <span className="eyebrow">For local brands</span>
            <h1 className="hero-title">Hire local creators. Pay only for work you approve.</h1>
            <p className="hero-copy">
              CreatorDocks gives local businesses a reviewed roster of nearby creators. Post a brief, read real applications with rates attached, and release payment after the content clears your review — not before.
            </p>
            <div className="cta-row">
              <PublicWaitlistLink className="apple-btn">Request access</PublicWaitlistLink>
              <Link href="/#how-it-works" className="apple-btn-ghost">See how it works</Link>
            </div>
            <div className="chip-row">
              {localBrandTypes.map(type => (
                <span key={type} className="pill">{type}</span>
              ))}
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
                      How a deal runs
                    </p>
                    <p style={{ margin: 0, fontSize: '1.7rem', fontWeight: 600, letterSpacing: '-0.04em' }}>
                      Brief, applicants, approved work.
                    </p>
                  </div>
                  <span className="status-pill" style={{ background: 'var(--success-soft)', color: 'var(--success)' }}>
                    Escrow-style
                  </span>
                </div>

                <div className="subtle-grid">
                  {dealSignals.map(signal => (
                    <div key={signal.value} className="list-row" style={{ padding: '0 0 14px' }}>
                      {/* .list-row pins its last child at flex-shrink: 0, so a lone child needs this to wrap. */}
                      <div style={{ flex: '1 1 auto', minWidth: 0 }}>
                        <p style={{ margin: '0 0 4px', fontWeight: 600 }}>{signal.value}</p>
                        <p style={{ margin: 0, color: 'var(--text-soft)', fontSize: '.94rem' }}>{signal.label}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="how-it-works" className="marketing-section">
          <div className="section-frame subtle-grid" style={{ gap: 24 }}>
            <div style={{ maxWidth: 760 }}>
              <span className="eyebrow">How it works</span>
              <h2 className="section-title" style={{ marginTop: 18, marginBottom: 12 }}>
                Three steps from brief to paid creator.
              </h2>
              <p className="section-copy" style={{ margin: 0 }}>
                Briefs, applications, content review, and payouts live in one dashboard, so a campaign never turns back into a thread of DMs and invoices.
              </p>
            </div>

            <div className="feature-grid">
              {brandSteps.map(item => (
                <article key={item.step} className="feature-card">
                  <span className="eyebrow" style={{ marginBottom: 16 }}>{item.step}</span>
                  <h3>{item.title}</h3>
                  <p className="section-copy" style={{ margin: 0 }}>{item.copy}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="why-creatordocks" className="marketing-section">
          <div className="section-frame subtle-grid spacing-xl">
            <div style={{ maxWidth: 760 }}>
              <span className="eyebrow">Why CreatorDocks</span>
              <h2 className="section-title" style={{ marginTop: 18, marginBottom: 12 }}>
                Built for the businesses people visit, book, and recommend.
              </h2>
              <p className="section-copy" style={{ margin: 0 }}>
                Neighborhood cafes, gyms, salons, boutiques, and home service teams do not need a six-month agency contract. They need a few good creators nearby and a clean way to pay them.
              </p>
            </div>

            <div className="bento-grid">
              {brandDifferences.map(item => (
                <section
                  key={item.title}
                  className={`dashboard-panel bento-card${item.wide ? ' bento-card-wide' : ''}`}
                >
                  <h3>{item.title}</h3>
                  <p className="section-copy" style={{ margin: 0 }}>{item.copy}</p>
                </section>
              ))}
            </div>
          </div>
        </section>

        <section id="creators" className="marketing-section">
          <div
            className="section-frame split-row"
            style={{ background: 'var(--accent-soft)', borderColor: 'rgba(19, 113, 255, 0.16)' }}
          >
            <div style={{ maxWidth: 620 }}>
              <span className="eyebrow">Creators</span>
              <h2 className="section-title" style={{ marginTop: 18, marginBottom: 12, fontSize: 'clamp(1.5rem, 3vw, 2.1rem)' }}>
                Are you a creator? CreatorDocks lives on your phone.
              </h2>
              <p className="section-copy" style={{ margin: '0 0 18px' }}>
                Browse local briefs, apply with the rate you want, submit your work, and get paid through Stripe — from the CreatorDocks iOS app. It is not on the App Store yet, so put your name down and we will tell you the day it is.
              </p>
              <div className="chip-row">
                <span className="pill">Coming to iOS</span>
                <span className="pill">Local briefs</span>
                <span className="pill">Paid through Stripe</span>
              </div>
            </div>

            <Link href="/get-the-app" className="apple-btn-ghost">Get early access</Link>
          </div>
        </section>

        <section id="faq" className="marketing-section">
          <div className="section-frame subtle-grid spacing-xl">
            <div style={{ maxWidth: 760 }}>
              <span className="eyebrow">FAQ</span>
              <h2 className="section-title" style={{ marginTop: 18, marginBottom: 12 }}>
                The details brands ask about first.
              </h2>
            </div>

            <div className="faq-grid">
              {faqItems.map(item => (
                <section key={item.question} className="dashboard-panel">
                  <h3>{item.question}</h3>
                  <p className="section-copy" style={{ margin: 0 }}>{item.answer}</p>
                </section>
              ))}
            </div>
          </div>
        </section>

        <section className="marketing-section" style={{ paddingBottom: 72 }}>
          <div className="section-frame subtle-grid spacing-xl">
            <div style={{ maxWidth: 760 }}>
              <span className="eyebrow">Request access</span>
              <h2 className="section-title" style={{ marginTop: 18, marginBottom: 12 }}>
                Ready to run your first local campaign?
              </h2>
              <p className="section-copy" style={{ margin: 0 }}>
                We are opening brand accounts in small batches so every brief gets a real creator match. Leave your email and we will reach out to set up your account — no card and no commitment to request access.
              </p>
            </div>

            <div className="cta-row">
              <PublicWaitlistLink className="apple-btn">Request access</PublicWaitlistLink>
              <Link href="/sign-in" className="apple-btn-ghost">Sign in</Link>
            </div>
          </div>
        </section>
    </PublicPageShell>
  )
}
