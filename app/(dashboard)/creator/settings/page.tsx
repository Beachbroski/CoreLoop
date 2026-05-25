import { Suspense } from 'react'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import prisma from '@/lib/prisma'
import { ConnectStripeButton } from './ConnectStripeButton'

async function SettingsContent({ onboarded }: { onboarded: boolean }) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const user = await prisma.user.findUnique({ where: { clerkId: userId } })
  if (!user) redirect('/onboarding')

  const isOnboarded = user.stripeOnboarded || onboarded

  return (
    <div className="subtle-grid" style={{ maxWidth: 720 }}>
      <div className="dashboard-panel">
        <div className="split-row">
          <div>
            <p style={{ fontSize: 20, fontWeight: 600, color: 'var(--text)', margin: '0 0 4px' }}>
              Stripe payouts
            </p>
            <p style={{ fontSize: 15, color: 'var(--text-soft)', margin: 0 }}>
              Connect your Stripe account to receive payouts for approved content.
            </p>
          </div>
          {isOnboarded ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: 'var(--success-soft)',
                borderRadius: 980,
                padding: '8px 14px',
                whiteSpace: 'nowrap',
              }}
            >
              <span style={{ width: 8, height: 8, background: 'var(--success)', borderRadius: '50%', display: 'block' }} />
              <span style={{ fontSize: 15, color: 'var(--success)', fontWeight: 500 }}>Connected</span>
            </div>
          ) : (
            <ConnectStripeButton />
          )}
        </div>

        {!isOnboarded && (
          <div className="banner-warning">
            <p style={{ fontSize: 15, color: 'var(--warning)', margin: 0 }}>
              You must connect Stripe before you can apply to campaigns or receive payments.
            </p>
          </div>
        )}
      </div>

      <div className="dashboard-panel">
        <p style={{ fontSize: 20, fontWeight: 600, color: 'var(--text)', margin: 0 }}>Account</p>
        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px 0',
              borderBottom: '1px solid rgba(15, 23, 42, 0.06)',
            }}
          >
            <span style={{ fontSize: 15, color: 'var(--text-soft)' }}>Name</span>
            <span style={{ fontSize: 15, color: 'var(--text)' }}>{user.name ?? '—'}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0' }}>
            <span style={{ fontSize: 15, color: 'var(--text-soft)' }}>Email</span>
            <span style={{ fontSize: 15, color: 'var(--text)' }}>{user.email}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function Skeleton() {
  return (
    <div className="subtle-grid" style={{ maxWidth: 720 }}>
      <div className="shimmer" style={{ height: 160, borderRadius: 28 }} />
      <div className="shimmer" style={{ height: 120, borderRadius: 28 }} />
    </div>
  )
}

export default async function CreatorSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ onboarded?: string }>
}) {
  const { onboarded } = await searchParams

  return (
    <div>
      <p style={{ margin: '0 0 8px', color: 'var(--text-faint)', fontSize: '.82rem', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' }}>
        Creator settings
      </p>
      <h1 className="page-title" style={{ marginBottom: 10 }}>Manage your account and get paid smoothly.</h1>
      <p className="page-copy" style={{ margin: '0 0 24px' }}>
        Manage your account and payment settings.
      </p>
      <Suspense fallback={<Skeleton />}>
        <SettingsContent onboarded={onboarded === 'true'} />
      </Suspense>
    </div>
  )
}
