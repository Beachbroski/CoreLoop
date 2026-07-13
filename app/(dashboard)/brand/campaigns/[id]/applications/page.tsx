import { Suspense } from 'react'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import prisma from '@/lib/prisma'
import { formatCents } from '@/lib/utils'
import { resolveDashboardViewer } from '@/lib/view-as'
import { AdminViewBanner } from '../../../../AdminViewBanner'
import { SubmissionReview } from './SubmissionReview'

const APP_STATUS: Record<string, { bg: string; color: string; label: string }> = {
  PENDING: { bg: 'var(--warning-soft)', color: 'var(--warning)', label: 'Pending' },
  ACCEPTED: { bg: 'var(--success-soft)', color: 'var(--success)', label: 'Accepted' },
  REJECTED: { bg: 'var(--danger-soft)', color: 'var(--danger)', label: 'Rejected' },
}

const SUBMISSION_STATUS: Record<string, { bg: string; color: string; label: string }> = {
  PENDING: { bg: 'var(--warning-soft)', color: 'var(--warning)', label: 'Pending review' },
  APPROVED: { bg: 'var(--success-soft)', color: 'var(--success)', label: 'Approved' },
  REVISION_REQUESTED: { bg: 'var(--accent-soft)', color: 'var(--accent)', label: 'Revision requested' },
  REJECTED: { bg: 'var(--danger-soft)', color: 'var(--danger)', label: 'Rejected' },
}

async function ApplicationsContent({ id, viewAsId }: { id: string; viewAsId?: string }) {
  const { viewer: user, isAdminViewing, readOnly, viewAsNotFound } = await resolveDashboardViewer('BRAND', viewAsId)

  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: {
      applications: {
        where: { status: 'ACCEPTED' },
        include: {
          creator: { select: { name: true, avatarUrl: true } },
          submissions: { orderBy: { createdAt: 'desc' } },
        },
      },
    },
  })

  if (!campaign) notFound()
  if (campaign.brandId !== user.id) redirect('/brand')

  const acceptedApplications = campaign.applications

  return (
    <div className="subtle-grid spacing-xl">
      {isAdminViewing && (
        <AdminViewBanner viewingAsName={user.name} viewingAsEmail={user.email} notFound={viewAsNotFound} />
      )}

      <div>
        <Link href={`/brand/campaigns/${id}`} className="apple-link">
          Back to campaign
        </Link>
      </div>

      <div>
        <p style={{ margin: '0 0 8px', color: 'var(--text-faint)', fontSize: '.82rem', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' }}>
          Content submissions
        </p>
        <h1 className="page-title" style={{ marginBottom: 10 }}>Review approved creator work in one place.</h1>
        <p className="page-copy" style={{ margin: 0, maxWidth: 720 }}>
          Check each submission, request revisions if needed, or approve the work and release payment through the existing flow.
        </p>
        <p className="page-copy" style={{ margin: '10px 0 0', fontWeight: 600 }}>{campaign.title}</p>
      </div>

      {acceptedApplications.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon" />
          <h3 style={{ margin: '0 0 8px' }}>No accepted applications yet</h3>
          <p className="page-copy" style={{ margin: '0 0 18px' }}>
            Once creators are accepted into the campaign, their submissions will show up here for review.
          </p>
          <Link href={`/brand/campaigns/${id}`} className="apple-btn">Review applications</Link>
        </div>
      ) : (
        <div className="subtle-grid">
          {acceptedApplications.map((application: (typeof acceptedApplications)[number]) => {
            const applicationStatus = APP_STATUS[application.status] ?? APP_STATUS.PENDING
            return (
              <section key={application.id} className="dashboard-panel">
                <div className="split-row">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {application.creator.avatarUrl ? (
                      <img
                        src={application.creator.avatarUrl}
                        alt={application.creator.name ?? 'Creator'}
                        style={{ width: 44, height: 44, borderRadius: 999, objectFit: 'cover' }}
                      />
                    ) : (
                      <div className="brand-mark" style={{ width: 44, height: 44, borderRadius: 16 }} />
                    )}
                    <div>
                      <p style={{ margin: '0 0 4px', fontWeight: 600 }}>{application.creator.name ?? 'Creator'}</p>
                      <p style={{ margin: 0, color: 'var(--text-soft)', fontSize: '.94rem' }}>
                        Accepted rate {formatCents(application.proposedRate)}
                      </p>
                    </div>
                  </div>
                  <span className="status-pill" style={{ background: applicationStatus.bg, color: applicationStatus.color }}>
                    {applicationStatus.label}
                  </span>
                </div>

                {application.submissions.length === 0 ? (
                  <div className="glass-card" style={{ boxShadow: 'var(--shadow-sm)' }}>
                    <p style={{ margin: 0, color: 'var(--text-soft)' }}>No content submitted yet.</p>
                  </div>
                ) : (
                  <div className="subtle-grid">
                    {application.submissions.map((submission: (typeof application.submissions)[number]) => {
                      const submissionStatus = SUBMISSION_STATUS[submission.status] ?? SUBMISSION_STATUS.PENDING
                      return (
                        <div key={submission.id} className="glass-card" style={{ boxShadow: 'var(--shadow-sm)' }}>
                          <div className="split-row" style={{ marginBottom: 12 }}>
                            <a href={submission.contentUrl} target="_blank" rel="noopener noreferrer" className="apple-link">
                              View content
                            </a>
                            <span className="status-pill" style={{ background: submissionStatus.bg, color: submissionStatus.color }}>
                              {submissionStatus.label}
                            </span>
                          </div>

                          {submission.caption && (
                            <p className="page-copy" style={{ margin: '0 0 10px' }}>{submission.caption}</p>
                          )}
                          {submission.notes && (
                            <p style={{ margin: 0, color: 'var(--text-soft)', fontSize: '.9rem' }}>{submission.notes}</p>
                          )}
                          {submission.status === 'PENDING' && !readOnly && (
                            <SubmissionReview submissionId={submission.id} />
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Skeleton() {
  return (
    <div className="subtle-grid spacing-xl">
      <div className="shimmer" style={{ height: 24, width: 160 }} />
      <div>
        <div className="shimmer" style={{ height: 52, width: 320, marginBottom: 12 }} />
        <div className="shimmer" style={{ height: 22, width: 420 }} />
      </div>
      {[0, 1].map(i => (
        <div key={i} className="shimmer" style={{ height: 240, borderRadius: 28 }} />
      ))}
    </div>
  )
}

export default async function CampaignApplicationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ viewAs?: string }>
}) {
  const { id } = await params
  const { viewAs } = await searchParams
  return (
    <Suspense fallback={<Skeleton />}>
      <ApplicationsContent id={id} viewAsId={viewAs} />
    </Suspense>
  )
}
