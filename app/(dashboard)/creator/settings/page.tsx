import { Suspense } from 'react'
import prisma from '@/lib/prisma'
import { resolveDashboardViewer } from '@/lib/view-as'
import { AdminViewBanner } from '../../AdminViewBanner'
import { ConnectStripeButton } from './ConnectStripeButton'
import { ChangeRoleControl } from '../../ChangeRoleControl'

async function SettingsContent({ onboarded, viewAsId }: { onboarded: boolean; viewAsId?: string }) {
  const { viewer: user, isAdminViewing, readOnly, viewAsNotFound } = await resolveDashboardViewer('CREATOR', viewAsId)

  const isOnboarded = user.stripeOnboarded || onboarded

  const [campaignCount, applicationCount] = await Promise.all([
    prisma.campaign.count({ where: { brandId: user.id } }),
    prisma.application.count({ where: { creatorId: user.id } }),
  ])
  const canChangeRole = !readOnly && campaignCount === 0 && applicationCount === 0

  return (
    <div className="subtle-grid" style={{ maxWidth: 720 }}>
      {isAdminViewing && (
        <AdminViewBanner viewingAsName={user.name} viewingAsEmail={user.email} notFound={viewAsNotFound} />
      )}
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
          ) : readOnly ? (
            <span className="pill">Read-only admin view</span>
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
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px 0',
              borderBottom: canChangeRole ? '1px solid rgba(15, 23, 42, 0.06)' : undefined,
            }}
          >
            <span style={{ fontSize: 15, color: 'var(--text-soft)' }}>Email</span>
            <span style={{ fontSize: 15, color: 'var(--text)' }}>{user.email}</span>
          </div>
          {canChangeRole && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0' }}>
              <div>
                <span style={{ fontSize: 15, color: 'var(--text-soft)', display: 'block' }}>Account type</span>
                <span style={{ fontSize: '.85rem', color: 'var(--text-faint)' }}>
                  You can switch until you launch a campaign or submit an application.
                </span>
              </div>
              <ChangeRoleControl currentRole="CREATOR" />
            </div>
          )}
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
  searchParams: Promise<{ onboarded?: string; viewAs?: string }>
}) {
  const { onboarded, viewAs } = await searchParams

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
        <SettingsContent onboarded={onboarded === 'true'} viewAsId={viewAs} />
      </Suspense>
    </div>
  )
}
