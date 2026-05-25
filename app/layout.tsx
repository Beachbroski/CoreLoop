import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import { Plus_Jakarta_Sans } from 'next/font/google'
import { getSiteUrl } from '@/lib/site-url'
import './globals.css'

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-display',
})

const siteUrl = getSiteUrl()

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
    <ClerkProvider
      appearance={{
        variables: {
          colorPrimary: '#0071e3',
          colorBackground: '#ffffff',
          colorInputBackground: '#f5f5f7',
          colorInputText: '#1d1d1f',
          colorText: '#1d1d1f',
          colorTextSecondary: '#6e6e73',
          colorDanger: '#ff3b30',
          borderRadius: '18px',
          fontFamily: '"Plus Jakarta Sans", sans-serif',
          fontSize: '17px',
        },
        elements: {
          card: 'shadow-none border border-[rgba(15,23,42,0.08)] rounded-[28px] backdrop-blur-xl',
          formButtonPrimary: 'rounded-full font-medium',
        },
      }}
    >
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
