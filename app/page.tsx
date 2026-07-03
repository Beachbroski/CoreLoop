import { PublicPageShell } from './PublicPageShell'
import { PublicWaitlistLink } from './PublicWaitlistLink'

const creatorSignals = [
  { value: 'Free for creators', label: 'Brands pay the platform fee when paid deals happen.' },
  { value: 'Local brand matches', label: 'Cafes, gyms, salons, boutiques, and home services.' },
  { value: '$25 creator reward', label: 'Refer 3 creators and complete 3 campaigns after launch.' },
]

const localBrandTypes = ['Cafes', 'Gyms', 'Salons', 'Boutiques', 'Home services']

const matchSteps = [
  {
    step: '01',
    title: 'Join the roster',
    copy: 'Save your email first, then tell us your handle, niche, platform, and audience size when you can.',
  },
  {
    step: '02',
    title: 'We match you',
    copy: 'CreatorDocks curates local brand opportunities around fit instead of making you chase random briefs.',
  },
  {
    step: '03',
    title: 'Get paid through the platform',
    copy: 'When campaigns open, approved work and payouts move through CreatorDocks instead of messy DMs.',
  },
]

const faqItems = [
  {
    question: 'Is CreatorDocks free for creators?',
    answer: 'Yes. Creators join free. Brands pay the platform fee when paid collaborations run through CreatorDocks.',
  },
  {
    question: 'What kind of brands will you match first?',
    answer: 'We are starting with local businesses: cafes, gyms, salons, boutiques, home services, and other community-first brands that need creator content.',
  },
  {
    question: 'When does the first cohort open?',
    answer: 'Access is invite-led and rolling. There is no hard public launch date because we are matching creators as brand demand comes in.',
  },
]

export default function HomePage() {
  return (
    <PublicPageShell>
        <section className="hero-grid">
          <div className="hero-copy-stack">
            <span className="eyebrow">Invite-led creator cohort</span>
            <h1 className="hero-title">We match you with local brand deals that fit.</h1>
            <p className="hero-copy">
              CreatorDocks is building a curated creator roster for local businesses that need real content. Join free, get matched in rolling waves, and get paid through the platform when deals go live.
            </p>
            <div className="cta-row">
              <PublicWaitlistLink className="apple-btn">Join the waitlist</PublicWaitlistLink>
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
                      The first cohort
                    </p>
                    <p style={{ margin: 0, fontSize: '1.7rem', fontWeight: 600, letterSpacing: '-0.04em' }}>
                      Local deals, curated by fit.
                    </p>
                  </div>
                  <span className="status-pill" style={{ background: 'var(--success-soft)', color: 'var(--success)' }}>
                    Rolling
                  </span>
                </div>

                <div className="subtle-grid">
                  {creatorSignals.map(signal => (
                    <div key={signal.label} className="list-row" style={{ padding: '0 0 14px' }}>
                      <div>
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
                Three steps: join, get matched, get paid.
              </h2>
              <p className="section-copy" style={{ margin: 0 }}>
                No cold-DM circus. No vague “exposure” offers. We are starting invite-led so the first matches feel useful for creators and local brands.
              </p>
            </div>

            <div className="feature-grid">
              {matchSteps.map(item => (
                <article key={item.step} className="feature-card">
                  <span className="eyebrow" style={{ marginBottom: 16 }}>{item.step}</span>
                  <h3>{item.title}</h3>
                  <p className="section-copy" style={{ margin: 0 }}>{item.copy}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="local-brands" className="marketing-section">
          <div className="section-frame subtle-grid spacing-xl">
            <div style={{ maxWidth: 760 }}>
              <span className="eyebrow">Local brand demand</span>
              <h2 className="section-title" style={{ marginTop: 18, marginBottom: 12 }}>
                Built for the businesses people actually visit, book, and recommend.
              </h2>
              <p className="section-copy" style={{ margin: 0 }}>
                CreatorDocks is starting with local businesses that need trustworthy content: neighborhood cafes, gyms, salons, boutiques, home service teams, and similar operators.
              </p>
            </div>

            <div className="bento-grid">
              <section className="dashboard-panel bento-card bento-card-wide">
                <h3>Why local first</h3>
                <p className="section-copy" style={{ margin: 0 }}>
                  Local brands care about creators who understand the city, the audience, and the kind of content that makes someone actually show up.
                </p>
              </section>
              <section className="dashboard-panel bento-card">
                <h3>Creators stay free</h3>
                <p className="section-copy" style={{ margin: 0 }}>
                  You do not pay to join the waitlist or get reviewed for the first creator cohort.
                </p>
              </section>
              <section className="dashboard-panel bento-card">
                <h3>Rolling invites</h3>
                <p className="section-copy" style={{ margin: 0 }}>
                  We are opening access in waves as the right brand opportunities come in.
                </p>
              </section>
            </div>
          </div>
        </section>

        <section className="marketing-section" style={{ paddingBottom: 24 }}>
          <div className="section-frame subtle-grid spacing-xl">
            <div style={{ maxWidth: 760 }}>
              <span className="eyebrow">Join the waitlist</span>
              <h2 className="section-title" style={{ marginTop: 18, marginBottom: 12 }}>
                Ready to get matched with local brand deals that fit?
              </h2>
              <p className="section-copy" style={{ margin: 0 }}>
                Join the invite-led CreatorDocks roster in under a minute. We will use your details to curate the first creator cohorts.
              </p>
            </div>

            <div className="cta-row">
              <PublicWaitlistLink className="apple-btn">Join the waitlist</PublicWaitlistLink>
            </div>
          </div>
        </section>

        <section className="marketing-section" style={{ paddingBottom: 72 }}>
          <div className="section-frame subtle-grid spacing-xl">
            <div style={{ maxWidth: 760 }}>
              <span className="eyebrow">FAQ</span>
              <h2 className="section-title" style={{ marginTop: 18, marginBottom: 12 }}>
                The quick version before you join.
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
    </PublicPageShell>
  )
}
