import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
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
  title: 'CoreLoop — Creator Marketplace',
  description: 'Connect brands with creators. Get paid for your content.',
  metadataBase: siteUrl ? new URL(siteUrl) : undefined,
  openGraph: {
    title: 'CoreLoop — Creator Marketplace',
    description: 'A cleaner way for brands and creators to work together.',
    url: siteUrl || undefined,
    siteName: 'CoreLoop',
    type: 'website',
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
        </body>
      </html>
    </ClerkProvider>
  )
}
