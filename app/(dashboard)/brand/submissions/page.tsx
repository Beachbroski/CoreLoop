import { Suspense } from 'react'
import type { Application, Campaign, Submission } from '@prisma/client'
import Link from 'next/link'
import prisma from '@/lib/prisma'
import { resolveDashboardViewer } from '@/lib/view-as'
import { AdminViewBanner } from '../../AdminViewBanner'

const SUBMISSION_STATUS: Record<string, { bg: string; color: string; label: string }> = {
  PENDING: { bg: 'var(--warning-soft)', color: 'var(--warning)', label: 'Pending review' },
  APPROVED: { bg: 'var(--success-soft)', color: 'var(--success)', label: 'Approved' },
  REVISION_REQUESTED: { bg: 'var(--accent-soft)', color: 'var(--accent)', label: 'Revision requested' },
  REJECTED: { bg: 'var(--danger-soft)', color: 'var(--danger)', label: 'Rejected' },
}

type BrandSubmission = Submission & {
  application: Application & { campaign: Pick<Campaign, 'id' | 'title'> }
  creator: { name: string | null; avatarUrl: string | null }
}

async function SubmissionsContent({ viewAsId }: { viewAsId?: string }) {
  const { viewer: user, isAdminViewing, viewAsNotFound } = await resolveDashboardViewer('BRAND', viewAsId)

  const submissions: BrandSubmission[] = await prisma.submission.findMany({
    where: { application: { campaign: { brandId: user.id } } },
    include: {
      application: {
        include: {
          campaign: { select: { id: true, title: true } },
        },
      },
      creator: { select: { name: true, avatarUrl: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  if (submissions.length === 0) {
    return (
      <>
        {isAdminViewing && (
          <AdminViewBanner viewingAsName={user.name} viewingAsEmail={user.email} notFound={viewAsNotFound} />
        )}
        <div className="empty-state">
          <div className="empty-icon" />
          <h3 style={{ margin: '0 0 8px' }}>No submissions yet</h3>
          <p className="page-copy" style={{ margin: '0 0 18px' }}>
            Once creators submit content for approved applications, it will show up here for review.
          </p>
          <Link href="/brand/applications" className="apple-btn">View applications</Link>
        </div>
      </>
    )
  }

  return (
    <div className="subtle-grid">
      {isAdminViewing && (
        <AdminViewBanner viewingAsName={user.name} viewingAsEmail={user.email} notFound={viewAsNotFound} />
      )}
      {submissions.map(submission => {
        const status = SUBMISSION_STATUS[submission.status] ?? SUBMISSION_STATUS.PENDING
        return (
          <div key={submission.id} className="list-row">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
              {submission.creator.avatarUrl ? (
                <img
                  src={submission.creator.avatarUrl}
                  alt={submission.creator.name ?? 'Creator'}
                  style={{ width: 40, height: 40, borderRadius: 999, objectFit: 'cover' }}
                />
              ) : (
                <div className="brand-mark" style={{ width: 40, height: 40, borderRadius: 14 }} />
              )}
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: '0 0 4px', fontWeight: 600 }}>{submission.creator.name ?? 'Creator'}</p>
                <p style={{ margin: 0, color: 'var(--text-soft)', fontSize: '.94rem' }}>
                  {submission.application.campaign.title}
                </p>
              </div>
            </div>
            <div className="chip-row" style={{ justifyContent: 'flex-end' }}>
              <a href={submission.contentUrl} target="_blank" rel="noopener noreferrer" className="apple-link">
                View content
              </a>
              <span className="status-pill" style={{ background: status.bg, color: status.color }}>
                {status.label}
              </span>
              <Link href={`/brand/campaigns/${submission.application.campaign.id}/applications`} className="apple-link">
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

export default async function BrandSubmissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ viewAs?: string }>
}) {
  const { viewAs } = await searchParams

  return (
    <div className="subtle-grid" style={{ gap: 24 }}>
      <div className="page-header">
        <div className="page-header-copy">
          <p style={{ margin: '0 0 8px', color: 'var(--text-faint)', fontSize: '.82rem', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' }}>
            Submissions
          </p>
          <h1 className="page-title" style={{ marginBottom: 10 }}>Every piece of content, across every campaign.</h1>
          <p className="page-copy" style={{ margin: 0, maxWidth: 720 }}>
            See every creator submission in one feed, then jump into the campaign to approve, request revisions, or pay out.
          </p>
        </div>
        <Link href="/brand/applications" className="apple-btn-ghost page-header-action">
          View applications
        </Link>
      </div>
      <div className="dashboard-panel">
        <Suspense fallback={<Skeleton />}>
          <SubmissionsContent viewAsId={viewAs} />
        </Suspense>
      </div>
    </div>
  )
}
