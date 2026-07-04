import { Suspense } from 'react'
import type { Application, Campaign, Submission } from '@prisma/client'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import prisma from '@/lib/prisma'
import { formatCents } from '@/lib/utils'
import { SubmitContentModal } from './SubmitContentModal'

const STATUS: Record<string, { bg: string; color: string; label: string }> = {
  PENDING: { bg: 'var(--warning-soft)', color: 'var(--warning)', label: 'Pending' },
  ACCEPTED: { bg: 'var(--success-soft)', color: 'var(--success)', label: 'Accepted' },
  REJECTED: { bg: 'var(--danger-soft)', color: 'var(--danger)', label: 'Rejected' },
}

const SUB_STATUS: Record<string, { bg: string; color: string; label: string }> = {
  PENDING: { bg: 'var(--warning-soft)', color: 'var(--warning)', label: 'Pending review' },
  APPROVED: { bg: 'var(--success-soft)', color: 'var(--success)', label: 'Approved' },
  REVISION_REQUESTED: { bg: 'var(--accent-soft)', color: 'var(--accent)', label: 'Revision requested' },
  REJECTED: { bg: 'var(--danger-soft)', color: 'var(--danger)', label: 'Rejected' },
}

type CreatorApplication = Application & {
  campaign: Campaign & { brand: { name: string | null; avatarUrl: string | null } }
  submissions: Submission[]
}

async function ApplicationsContent() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const user = await prisma.user.findUnique({ where: { clerkId: userId } })
  if (!user) redirect('/onboarding')

  const applications: CreatorApplication[] = await prisma.application.findMany({
    where: { creatorId: user.id },
    include: {
      campaign: { include: { brand: { select: { name: true, avatarUrl: true } } } },
      submissions: { orderBy: { createdAt: 'desc' } },
    },
    orderBy: { createdAt: 'desc' },
  })

  if (applications.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon" />
        <h3 style={{ margin: '0 0 8px' }}>No applications yet</h3>
        <p className="page-copy" style={{ margin: '0 0 18px' }}>
          Browse campaigns and submit your first application while the best opportunities are still fresh.
        </p>
        <Link href="/creator/campaigns" className="apple-btn">Browse campaigns</Link>
      </div>
    )
  }

  return (
    <div className="subtle-grid">
      {applications.map((app: CreatorApplication) => {
        const status = STATUS[app.status] ?? STATUS.PENDING
        return (
          <section key={app.id} className="dashboard-panel">
            <div className="split-row">
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  {app.campaign.brand.avatarUrl ? (
                    <img
                      src={app.campaign.brand.avatarUrl}
                      alt={app.campaign.brand.name ?? 'Brand'}
                      style={{ width: 24, height: 24, borderRadius: 999, objectFit: 'cover' }}
                    />
                  ) : (
                    <div className="brand-mark" style={{ width: 24, height: 24, borderRadius: 9 }} />
                  )}
                  <span style={{ fontSize: '.9rem', color: 'var(--text-soft)' }}>{app.campaign.brand.name}</span>
                </div>
                <h2 style={{ margin: '0 0 6px', fontSize: '1.35rem', letterSpacing: '-0.04em' }}>{app.campaign.title}</h2>
                <p style={{ margin: 0, color: 'var(--text-soft)', fontSize: '.95rem' }}>
                  Proposed rate {formatCents(app.proposedRate)}
                </p>
              </div>
              <span className="status-pill" style={{ background: status.bg, color: status.color }}>{status.label}</span>
            </div>

            <p className="page-copy" style={{ margin: 0 }}>{app.pitch}</p>

            {app.status === 'ACCEPTED' && (
              <div className="subtle-grid" style={{ gap: 14 }}>
                <div className="split-row">
                  <div>
                    <h3 style={{ margin: '0 0 6px' }}>Content submissions</h3>
                    <p style={{ margin: 0, color: 'var(--text-soft)', fontSize: '.95rem' }}>
                      Keep your approved work tidy and easy for the brand to review.
                    </p>
                  </div>
                  <SubmitContentModal applicationId={app.id} />
                </div>

                {app.submissions.length === 0 ? (
                  <div className="glass-card" style={{ boxShadow: 'var(--shadow-sm)' }}>
                    <p style={{ margin: 0, color: 'var(--text-soft)' }}>No submissions yet. Upload your first piece above.</p>
                  </div>
                ) : (
                  <div className="subtle-grid">
                    {app.submissions.map((submission: Submission) => {
                      const subStatus = SUB_STATUS[submission.status] ?? SUB_STATUS.PENDING
                      return (
                        <div key={submission.id} className="glass-card" style={{ boxShadow: 'var(--shadow-sm)', display: 'grid', gap: 8 }}>
                          <div className="list-row" style={{ padding: 0 }}>
                            <a href={submission.contentUrl} target="_blank" rel="noopener noreferrer" className="apple-link">
                              View content
                            </a>
                            <span className="status-pill" style={{ background: subStatus.bg, color: subStatus.color }}>
                              {subStatus.label}
                            </span>
                          </div>
                          {submission.reviewNote && (
                            <p style={{ margin: 0, color: 'var(--text-soft)', fontSize: '.9rem' }}>
                              <strong style={{ color: 'var(--text)' }}>Brand feedback:</strong> {submission.reviewNote}
                            </p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}

function Skeleton() {
  return (
    <div className="subtle-grid">
      {[0, 1, 2].map(i => (
        <div className="shimmer" key={i} style={{ height: 220, borderRadius: 28 }} />
      ))}
    </div>
  )
}

export default function CreatorApplicationsPage() {
  return (
    <div className="subtle-grid" style={{ gap: 24 }}>
      <div>
        <p style={{ margin: '0 0 8px', color: 'var(--text-faint)', fontSize: '.82rem', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' }}>
          Application tracking
        </p>
        <h1 className="page-title" style={{ marginBottom: 10 }}>Track every pitch, approval, and content handoff.</h1>
        <p className="page-copy" style={{ margin: 0, maxWidth: 720 }}>
          This is your operating view for live applications, approved work, and anything still waiting on a decision.
        </p>
      </div>
      <Suspense fallback={<Skeleton />}>
        <ApplicationsContent />
      </Suspense>
    </div>
  )
}
