import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { getSiteUrl } from '@/lib/site-url'
import { WaitlistForm } from './WaitlistForm'

const siteUrl = getSiteUrl()
const waitlistUrl = siteUrl ? `${siteUrl.replace(/\/$/, '')}/waitlist` : undefined

export const metadata: Metadata = {
  title: 'Join the CreatorDocks Waitlist',
  description: 'Join the invite-led CreatorDocks roster and get matched with local brand deals that fit.',
  alternates: {
    canonical: waitlistUrl,
  },
  openGraph: {
    title: 'CreatorDocks — Local Brand Deals for Creators',
    description: 'Join free, get matched with local brands, and get paid through the platform when deals go live.',
    url: waitlistUrl,
    siteName: 'CreatorDocks',
    images: [{ url: '/waitlist/opengraph-image', width: 1200, height: 630, alt: 'CreatorDocks creator waitlist' }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CreatorDocks — Creator Waitlist',
    description: 'We match creators with local brand deals that fit.',
    images: ['/waitlist/opengraph-image'],
  },
}

export default function WaitlistPage() {
  return (
    <div>
      <nav className="apple-nav">
        <Link href="/" className="brand-lockup">
          <span className="brand-mark" />
          <span className="brand-wordmark">CreatorDocks</span>
        </Link>
        <div className="nav-links">
          <Link href="/" className="nav-link">Home</Link>
          <Link href="/privacy" className="nav-link">Privacy</Link>
          <Link href="/terms" className="nav-link">Terms</Link>
          <Link href="/support" className="nav-link">Support</Link>
          <Link href="/sign-in" className="nav-link tester-link">Tester sign in</Link>
        </div>
        <Link href="#form" className="apple-btn mobile-nav-cta">Join waitlist</Link>
      </nav>

      <main className="apple-shell">
        <section className="hero-grid waitlist-page-grid">
          <div className="hero-copy-stack">
            <span className="eyebrow">CreatorDocks waitlist</span>
            <h1 className="hero-title">Get matched with local brand deals that fit.</h1>
            <p className="hero-copy">
              Join the invite-led first cohort for creators who want paid work with local cafes, gyms, salons, boutiques, home services, and other community-first brands.
            </p>
            <div className="chip-row">
              <span className="pill">Free for creators</span>
              <span className="pill">Brands pay the platform fee</span>
              <span className="pill">Rolling invites</span>
            </div>
          </div>

          <section id="form">
            <Suspense fallback={<div className="dashboard-panel">Loading waitlist form...</div>}>
              <WaitlistForm compact />
            </Suspense>
          </section>
        </section>
      </main>
    </div>
  )
}
