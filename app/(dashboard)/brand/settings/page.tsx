import { Suspense } from 'react'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import prisma from '@/lib/prisma'
import { ChangeRoleControl } from '../../ChangeRoleControl'

async function SettingsContent() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const user = await prisma.user.findUnique({ where: { clerkId: userId } })
  if (!user) redirect('/onboarding')

  const [campaignCount, applicationCount] = await Promise.all([
    prisma.campaign.count({ where: { brandId: user.id } }),
    prisma.application.count({ where: { creatorId: user.id } }),
  ])
  const canChangeRole = campaignCount === 0 && applicationCount === 0

  return (
    <div className="subtle-grid" style={{ maxWidth: 720 }}>
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
              <ChangeRoleControl currentRole="BRAND" />
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
    </div>
  )
}

export default function BrandSettingsPage() {
  return (
    <div>
      <p style={{ margin: '0 0 8px', color: 'var(--text-faint)', fontSize: '.82rem', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' }}>
        Brand settings
      </p>
      <h1 className="page-title" style={{ marginBottom: 10 }}>Manage your account details.</h1>
      <p className="page-copy" style={{ margin: '0 0 24px' }}>
        Manage your account settings.
      </p>
      <Suspense fallback={<Skeleton />}>
        <SettingsContent />
      </Suspense>
    </div>
  )
}
