import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import { Analytics } from '@vercel/analytics/next'
import { Plus_Jakarta_Sans } from 'next/font/google'
import { baseClerkAppearance } from '@/lib/clerk-appearance'
import { getSiteUrl } from '@/lib/site-url'
import './globals.css'

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-display',
})

const siteUrl = getSiteUrl()
const clerkPublishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? ''

if (process.env.NODE_ENV === 'production' && clerkPublishableKey.startsWith('pk_test_')) {
  console.warn(
    '[auth] NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is using a development Clerk instance on a production build. Safari and OAuth flows may fail until you switch Vercel to your Clerk production keys/domain.',
  )
}

export const metadata: Metadata = {
  title: 'CreatorDocks — Hire Local Creators',
  description: 'Post a brief, review local creators who apply with their rate, and pay only for the content you approve. 15% platform fee, no retainer.',
  metadataBase: siteUrl ? new URL(siteUrl) : undefined,
  alternates: {
    canonical: siteUrl || undefined,
  },
  openGraph: {
    title: 'CreatorDocks — Hire Local Creators',
    description: 'Local businesses post a brief, review creators who apply with their rate, and pay only for approved work.',
    url: siteUrl || undefined,
    siteName: 'CreatorDocks',
    images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: 'CreatorDocks — hire local creators and pay for approved work' }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CreatorDocks — Hire Local Creators',
    description: 'Post a brief, review local creators, and pay only for the content you approve.',
    images: ['/opengraph-image'],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider appearance={baseClerkAppearance}>
      <html lang="en" className={`${plusJakarta.variable} h-full`}>
        <body
          className="min-h-full flex flex-col antialiased"
          style={{ fontFamily: 'var(--font-display), sans-serif' }}
        >
          {children}
          <Analytics />
        </body>
      </html>
    </ClerkProvider>
  )
}
