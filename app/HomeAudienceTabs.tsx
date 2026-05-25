'use client'

import { useState } from 'react'

type AudienceKey = 'creator' | 'business'

const audienceContent: Record<
  AudienceKey,
  {
    label: string
    title: string
    copy: string
    bullets: string[]
    chips: string[]
    statLabel: string
    statValue: string
    cardTitle: string
    cardPoints: string[]
  }
> = {
  creator: {
    label: 'For creators',
    title: 'Find better-fit campaigns and get paid without the awkward chase.',
    copy:
      'CoreLoop helps creators discover paid opportunities, apply quickly, submit work in one place, and build a real track record brands can trust.',
    bullets: [
      'Discover live campaigns that actually match your niche and platforms.',
      'Apply with a short pitch instead of endless outbound outreach.',
      'Keep submissions, revisions, and approvals inside the platform.',
      'Get paid automatically after the brand approves the work.',
    ],
    chips: ['Paid discovery', 'Fast applications', 'Submission tracking'],
    statLabel: 'What you obtain',
    statValue: 'Reliable paid workflow',
    cardTitle: 'A cleaner creator loop',
    cardPoints: [
      'One Stripe setup for payouts',
      'Clear budgets before you apply',
      'A visible record of past work and approvals',
    ],
  },
  business: {
    label: 'For businesses',
    title: 'Run creator campaigns without juggling ten conversations across ten tools.',
    copy:
      'CoreLoop gives businesses one place to post briefs, review applicants, manage content delivery, and release payment only when the work is approved.',
    bullets: [
      'Post a campaign brief in minutes with budget, niche, and delivery details.',
      'Review creator applications and rates in one calm workspace.',
      'Manage multiple campaigns without spreadsheets or scattered inboxes.',
      'Hold payment in escrow and release it automatically on approval.',
    ],
    chips: ['Fast briefs', 'Escrow-backed payouts', 'Multi-campaign ops'],
    statLabel: 'What you obtain',
    statValue: 'Lower-friction campaign execution',
    cardTitle: 'A cleaner brand loop',
    cardPoints: [
      'No manual PayPal or invoice chase',
      'A review flow built around approvals and revisions',
      'A single place to manage creator work across platforms',
    ],
  },
}

export function HomeAudienceTabs() {
  const [audience, setAudience] = useState<AudienceKey>('creator')
  const content = audienceContent[audience]

  return (
    <div className="section-frame audience-shell">
      <div className="audience-header">
        <div style={{ maxWidth: 720 }}>
          <span className="eyebrow">Choose your side</span>
          <h2 className="section-title" style={{ marginTop: 18, marginBottom: 12 }}>
            CoreLoop gives each side of the deal a better outcome.
          </h2>
          <p className="section-copy" style={{ margin: 0 }}>
            Pick the view that matches how you use the platform and see what CoreLoop actually helps you obtain.
          </p>
        </div>

        <div className="audience-toggle" role="tablist" aria-label="Audience switcher">
          <button
            type="button"
            role="tab"
            aria-selected={audience === 'creator'}
            className={`audience-tab ${audience === 'creator' ? 'audience-tab-active' : ''}`}
            onClick={() => setAudience('creator')}
          >
            For Creators
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={audience === 'business'}
            className={`audience-tab ${audience === 'business' ? 'audience-tab-active' : ''}`}
            onClick={() => setAudience('business')}
          >
            For Businesses
          </button>
        </div>
      </div>

      <div className="audience-grid">
        <section className="dashboard-panel">
          <span className="eyebrow" style={{ width: 'fit-content' }}>{content.label}</span>
          <h3 className="section-title" style={{ fontSize: 'clamp(2rem, 4vw, 3rem)' }}>
            {content.title}
          </h3>
          <p className="section-copy" style={{ margin: 0 }}>
            {content.copy}
          </p>

          <div className="subtle-grid" style={{ gap: 12 }}>
            {content.bullets.map(bullet => (
              <div key={bullet} className="glass-card" style={{ boxShadow: 'var(--shadow-sm)' }}>
                <p style={{ margin: 0, lineHeight: 1.65 }}>{bullet}</p>
              </div>
            ))}
          </div>

          <div className="chip-row">
            {content.chips.map(chip => (
              <span key={chip} className="platform-pill">{chip}</span>
            ))}
          </div>
        </section>

        <aside className="audience-sidecard">
          <div className="metric-card" style={{ background: 'rgba(255,255,255,0.78)' }}>
            <p style={{ margin: '0 0 8px', color: 'var(--text-faint)', fontSize: '.82rem', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' }}>
              {content.statLabel}
            </p>
            <p className="metric-value" style={{ fontSize: 'clamp(2rem, 4vw, 2.8rem)' }}>{content.statValue}</p>
          </div>

          <div className="glass-card" style={{ background: 'linear-gradient(180deg, rgba(17,24,39,0.96), rgba(16,34,71,0.95))', color: 'white' }}>
            <p style={{ margin: '0 0 10px', color: 'rgba(255,255,255,0.65)', fontSize: '.82rem', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' }}>
              {content.cardTitle}
            </p>
            <div className="subtle-grid" style={{ gap: 10 }}>
              {content.cardPoints.map(point => (
                <div
                  key={point}
                  className="pill"
                  style={{
                    justifyContent: 'flex-start',
                    background: 'rgba(255,255,255,0.12)',
                    borderColor: 'rgba(255,255,255,0.12)',
                    color: 'white',
                  }}
                >
                  {point}
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
