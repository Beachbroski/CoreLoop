import type { Metadata } from 'next'
import { PublicPageShell } from '@/app/PublicPageShell'
import { PublicWaitlistLink } from '@/app/PublicWaitlistLink'
import { getSiteUrl } from '@/lib/site-url'

/**
 * The creator-side landing page (W7-4/W7-5). Sunset-mode creator routes redirect
 * here, and the brand-first marketing site links creators here.
 *
 * Both env reads happen on the server at render time, so the page flips from
 * "waitlist" to "App Store" with an env change plus a redeploy — no code edit.
 * NEXT_PUBLIC_* is used because these are non-secret values that a client
 * component (PublicWaitlistLink's sibling CTA) may eventually need too.
 */
const iosAppUrl = process.env.NEXT_PUBLIC_IOS_APP_URL?.trim()
const iosAppId = process.env.NEXT_PUBLIC_IOS_APP_ID?.trim()
const isAppLive = Boolean(iosAppUrl)

const siteUrl = getSiteUrl()
const pageUrl = siteUrl ? `${siteUrl}/get-the-app` : undefined

export const metadata: Metadata = {
  title: 'CreatorDocks for iPhone',
  description:
    'Find paid campaigns from local brands, apply, submit your content, and track payouts — from the CreatorDocks iPhone app.',
  alternates: {
    canonical: pageUrl,
  },
  openGraph: {
    title: 'CreatorDocks for iPhone',
    description: 'Local brand campaigns, applications, content submissions, and payouts — in your pocket.',
    url: pageUrl,
    siteName: 'CreatorDocks',
    images: [{ url: '/get-the-app/opengraph-image', width: 1200, height: 630, alt: 'CreatorDocks for iPhone' }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CreatorDocks for iPhone',
    description: 'Local brand campaigns, applications, content submissions, and payouts — in your pocket.',
    images: ['/get-the-app/opengraph-image'],
  },
  // Safari's smart app banner. Only emitted once the App Store ID exists —
  // `apple-itunes-app` with a placeholder id renders a broken banner, so an
  // unset NEXT_PUBLIC_IOS_APP_ID simply omits the tag.
  ...(iosAppId ? { itunes: { appId: iosAppId, appArgument: pageUrl } } : {}),
}

const appCapabilities = [
  {
    title: 'Find work near you',
    copy: 'Browse live campaigns from local cafes, gyms, salons, boutiques, and home-service brands. Filter by niche and platform so you only see briefs that actually fit.',
  },
  {
    title: 'Apply in a couple of taps',
    copy: 'Send your pitch and the rate you want straight from the campaign screen. No email threads, no negotiating in DMs.',
  },
  {
    title: 'Track every application',
    copy: 'Watch each application move from pending to accepted, and withdraw the ones you have changed your mind about while they are still pending.',
  },
  {
    title: 'Submit from your camera roll',
    copy: 'Upload the finished content from your phone, add the live link and any notes for the brand, and resubmit in place if they request a revision.',
  },
  {
    title: 'Get paid through Stripe',
    copy: 'Connect a Stripe payout account once. When a brand approves your submission, the payment is released to you and lands in your earnings history.',
  },
  {
    title: 'Know the moment it happens',
    copy: 'Push notifications when a brand accepts your application, approves your work, or asks for a change — so you are not refreshing a dashboard.',
  },
]

const faqItems = [
  {
    question: isAppLive ? 'Do I need a new account?' : 'When can I get it?',
    answer: isAppLive
      ? 'No. Sign in with the same CreatorDocks account you already use — your applications, submissions, and payout history come with you.'
      : 'The app is not on the App Store yet. Join the early-access list and we will email you the moment it is available. When it lands you sign in with the same CreatorDocks account you already use — there is nothing to re-create.',
  },
  {
    question: 'Is CreatorDocks free for creators?',
    answer: 'Yes. Creators join free and are never charged in the app. Brands pay the platform fee when a paid collaboration runs through CreatorDocks.',
  },
  {
    question: 'What happens to the creator dashboard on the web?',
    answer: 'It is winding down. Creator work moves to the app, brands keep running their campaigns on the web, and privacy, terms, and support pages stay on the web permanently.',
  },
  {
    question: 'Is there an Android app?',
    answer: 'Not yet — the first CreatorDocks app is iPhone only, and Android is not scheduled. Join the list and we will let you know if that changes.',
  },
]

/**
 * Primary CTA. Waitlist capture until NEXT_PUBLIC_IOS_APP_URL is set, then the
 * real App Store link. PublicWaitlistLink is reused so referral query params
 * survive the hop, exactly like the CTAs on the landing page.
 */
function PrimaryAppCta() {
  if (iosAppUrl) {
    return (
      <a className="apple-btn" href={iosAppUrl}>
        Download on the App Store
      </a>
    )
  }

  return <PublicWaitlistLink className="apple-btn">Get early access</PublicWaitlistLink>
}

export default function GetTheAppPage() {
  return (
    <PublicPageShell>
      <section className="hero-grid">
        <div className="hero-copy-stack">
          <span className="eyebrow">CreatorDocks for iPhone</span>
          <h1 className="hero-title">Local brand deals, from your phone.</h1>
          <p className="hero-copy">
            The creator side of CreatorDocks is an iPhone app. Find paid campaigns from businesses in your area, apply with your own rate, upload the content when it is ready, and watch the payout land — all from the device you already make the work on.
          </p>

          <div className="cta-row">
            <PrimaryAppCta />
            <a href="#in-the-app" className="apple-btn-ghost">
              See what is inside
            </a>
          </div>

          <p className="section-copy" style={{ margin: 0, maxWidth: 520 }}>
            {isAppLive
              ? 'Sign in with your existing CreatorDocks account — everything you have already applied to is waiting for you.'
              : 'Not on the App Store yet. Join the early-access list and we will send your download link the day it lands.'}
          </p>

          <div className="chip-row">
            <span className="pill">Free for creators</span>
            <span className="pill">Local campaigns</span>
            <span className="pill">Paid through Stripe</span>
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
                    Inside the app
                  </p>
                  <p style={{ margin: 0, fontSize: '1.7rem', fontWeight: 600, letterSpacing: '-0.04em' }}>
                    Three tabs, one loop.
                  </p>
                </div>
                <span className="status-pill" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
                  {isAppLive ? 'On iPhone' : 'Coming soon'}
                </span>
              </div>

              <div className="subtle-grid">
                {[
                  { title: 'Discover', copy: 'Campaigns from local brands, filtered to your niche.' },
                  { title: 'Activity', copy: 'Applications and submissions, with status on every one.' },
                  { title: 'Earnings', copy: 'Payouts, totals, and your Stripe account status.' },
                ].map(tab => (
                  <div key={tab.title} className="list-row" style={{ padding: '0 0 14px' }}>
                    <div>
                      <p style={{ margin: '0 0 4px', fontWeight: 600 }}>{tab.title}</p>
                      <p style={{ margin: 0, color: 'var(--text-soft)', fontSize: '.94rem' }}>{tab.copy}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="in-the-app" className="marketing-section">
        <div className="section-frame subtle-grid" style={{ gap: 24 }}>
          <div style={{ maxWidth: 760 }}>
            <span className="eyebrow">What you can do</span>
            <h2 className="section-title" style={{ marginTop: 18, marginBottom: 12 }}>
              The whole creator loop, built for a phone.
            </h2>
            <p className="section-copy" style={{ margin: 0 }}>
              Everything the web dashboard did for creators, plus the things only a phone can do — your camera roll, and a notification the second a brand replies.
            </p>
          </div>

          <div className="feature-grid">
            {appCapabilities.map(item => (
              <article key={item.title} className="feature-card">
                <h3>{item.title}</h3>
                <p className="section-copy" style={{ margin: 0 }}>{item.copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="marketing-section">
        <div className="section-frame subtle-grid spacing-xl">
          <div style={{ maxWidth: 760 }}>
            <span className="eyebrow">How a paid deal works</span>
            <h2 className="section-title" style={{ marginTop: 18, marginBottom: 12 }}>
              Apply, make the content, get paid.
            </h2>
            <p className="section-copy" style={{ margin: 0 }}>
              CreatorDocks holds the brand&apos;s payment from the moment they accept you, so the work is funded before you start shooting.
            </p>
          </div>

          <div className="feature-grid">
            {[
              { step: '01', title: 'Apply with your rate', copy: 'Pick a campaign that fits, write a short pitch, and name your price. The brand sees both together.' },
              { step: '02', title: 'Brand accepts and funds it', copy: 'When a brand accepts your application they authorize the payment up front, so the deal is not a promise.' },
              { step: '03', title: 'Submit and get paid', copy: 'Upload your content in the app. Once the brand approves it, your payout is released to your Stripe account.' },
            ].map(item => (
              <article key={item.step} className="feature-card">
                <span className="eyebrow" style={{ marginBottom: 16 }}>{item.step}</span>
                <h3>{item.title}</h3>
                <p className="section-copy" style={{ margin: 0 }}>{item.copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="marketing-section" style={{ paddingBottom: 24 }}>
        <div className="section-frame subtle-grid spacing-xl">
          <div style={{ maxWidth: 760 }}>
            <span className="eyebrow">{isAppLive ? 'Download' : 'Early access'}</span>
            <h2 className="section-title" style={{ marginTop: 18, marginBottom: 12 }}>
              {isAppLive ? 'Get CreatorDocks on your iPhone.' : 'Be first in line when it ships.'}
            </h2>
            <p className="section-copy" style={{ margin: 0 }}>
              {isAppLive
                ? 'Free to download, free to join, and your CreatorDocks account works the moment you sign in.'
                : 'One email, no cost, no commitment. We are opening access in waves as local brand demand comes in.'}
            </p>
          </div>

          <div className="cta-row">
            <PrimaryAppCta />
          </div>
        </div>
      </section>

      <section className="marketing-section" style={{ paddingBottom: 72 }}>
        <div className="section-frame subtle-grid spacing-xl">
          <div style={{ maxWidth: 760 }}>
            <span className="eyebrow">FAQ</span>
            <h2 className="section-title" style={{ marginTop: 18, marginBottom: 12 }}>
              The quick version.
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
