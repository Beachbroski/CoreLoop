import { Suspense } from 'react'
import type { Application, Campaign } from '@prisma/client'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import prisma from '@/lib/prisma'
import { formatCents } from '@/lib/utils'

const APP_STATUS: Record<string, { bg: string; color: string; label: string }> = {
  PENDING: { bg: 'var(--warning-soft)', color: 'var(--warning)', label: 'Pending' },
  ACCEPTED: { bg: 'var(--success-soft)', color: 'var(--success)', label: 'Accepted' },
  REJECTED: { bg: 'var(--danger-soft)', color: 'var(--danger)', label: 'Rejected' },
}

type BrandApplication = Application & {
  campaign: Pick<Campaign, 'id' | 'title'>
  creator: { name: string | null; avatarUrl: string | null }
}

async function ApplicationsContent() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const user = await prisma.user.findUnique({ where: { clerkId: userId } })
  if (!user) redirect('/onboarding')

  const applications: BrandApplication[] = await prisma.application.findMany({
    where: { campaign: { brandId: user.id } },
    include: {
      campaign: { select: { id: true, title: true } },
      creator: { select: { name: true, avatarUrl: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  if (applications.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon" />
        <h3 style={{ margin: '0 0 8px' }}>No applications yet</h3>
        <p className="page-copy" style={{ margin: '0 0 18px' }}>
          Once creators start applying to your campaigns, every pitch will show up here.
        </p>
        <Link href="/brand/campaigns/new" className="apple-btn">Post a campaign</Link>
      </div>
    )
  }

  return (
    <div className="subtle-grid">
      {applications.map(application => {
        const status = APP_STATUS[application.status] ?? APP_STATUS.PENDING
        return (
          <div key={application.id} className="list-row">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
              {application.creator.avatarUrl ? (
                <img
                  src={application.creator.avatarUrl}
                  alt={application.creator.name ?? 'Creator'}
                  style={{ width: 40, height: 40, borderRadius: 999, objectFit: 'cover' }}
                />
              ) : (
                <div className="brand-mark" style={{ width: 40, height: 40, borderRadius: 14 }} />
              )}
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: '0 0 4px', fontWeight: 600 }}>{application.creator.name ?? 'Creator'}</p>
                <p style={{ margin: 0, color: 'var(--text-soft)', fontSize: '.94rem' }}>
                  {application.campaign.title} · Proposed rate {formatCents(application.proposedRate)}
                </p>
              </div>
            </div>
            <div className="chip-row" style={{ justifyContent: 'flex-end' }}>
              <span className="status-pill" style={{ background: status.bg, color: status.color }}>
                {status.label}
              </span>
              <Link href={`/brand/campaigns/${application.campaign.id}`} className="apple-link">
                View campaign
              </Link>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function Skeleton() {
  return (
    <div className="subtle-grid">
      {[0, 1, 2].map(i => <div className="shimmer" key={i} style={{ height: 84, borderRadius: 20 }} />)}
    </div>
  )
}

export default function BrandApplicationsPage() {
  return (
    <div className="subtle-grid" style={{ gap: 24 }}>
      <div className="page-header">
        <div className="page-header-copy">
          <p style={{ margin: '0 0 8px', color: 'var(--text-faint)', fontSize: '.82rem', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' }}>
            Applications
          </p>
          <h1 className="page-title" style={{ marginBottom: 10 }}>Every pitch, across every campaign, in one place.</h1>
          <p className="page-copy" style={{ margin: 0, maxWidth: 720 }}>
            Scan applications from all your live campaigns without hopping between campaign pages.
          </p>
        </div>
        <Link href="/brand/submissions" className="apple-btn-ghost page-header-action">
          View submissions
        </Link>
      </div>
      <div className="dashboard-panel">
        <Suspense fallback={<Skeleton />}>
          <ApplicationsContent />
        </Suspense>
      </div>
    </div>
  )
}
