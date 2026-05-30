import { Suspense } from 'react'
import { auth } from '@clerk/nextjs/server'
import { redirect, notFound } from 'next/navigation'
import prisma from '@/lib/prisma'
import { formatCents } from '@/lib/utils'
import { ApplicationActions } from './ApplicationActions'

const APP_STATUS: Record<string, { bg: string; color: string; label: string }> = {
  PENDING: { bg: 'var(--warning-soft)', color: 'var(--warning)', label: 'Pending' },
  ACCEPTED: { bg: 'var(--success-soft)', color: 'var(--success)', label: 'Accepted' },
  REJECTED: { bg: 'var(--danger-soft)', color: 'var(--danger)', label: 'Rejected' },
}

const CAMPAIGN_STATUS: Record<string, { bg: string; color: string; label: string }> = {
  DRAFT: { bg: 'rgba(15,23,42,0.06)', color: 'var(--text-soft)', label: 'Draft' },
  ACTIVE: { bg: 'var(--accent-soft)', color: 'var(--accent)', label: 'Active' },
  IN_PROGRESS: { bg: 'var(--success-soft)', color: 'var(--success)', label: 'In progress' },
  COMPLETE: { bg: 'rgba(15,23,42,0.06)', color: 'var(--text-soft)', label: 'Complete' },
  CANCELLED: { bg: 'var(--danger-soft)', color: 'var(--danger)', label: 'Cancelled' },
}

const BRIEF_SECTIONS = [
  { key: 'objective', label: 'Primary goal' },
  { key: 'deliverables', label: 'Deliverables' },
  { key: 'targetAudience', label: 'Target audience' },
  { key: 'callToAction', label: 'Call to action' },
  { key: 'creatorRequirements', label: 'Creator requirements' },
  { key: 'usageRights', label: 'Usage rights' },
] as const

async function CampaignDetailContent({ id }: { id: string }) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const user = await prisma.user.findUnique({ where: { clerkId: userId } })
  if (!user) redirect('/onboarding')

  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: {
      brand: { select: { name: true, avatarUrl: true } },
      applications: {
        include: { creator: { select: { id: true, name: true, avatarUrl: true } } },
        orderBy: { createdAt: 'desc' },
      },
    },
  })

  if (!campaign) notFound()
  if (campaign.brandId !== user.id) redirect('/brand')

  const campaignStatus = CAMPAIGN_STATUS[campaign.status] ?? CAMPAIGN_STATUS.DRAFT

  return (
    <div className="subtle-grid" style={{ gap: 24 }}>
      <section className="dashboard-panel">
        <div className="page-header" style={{ marginBottom: 0 }}>
          <div>
            <p style={{ margin: '0 0 8px', color: 'var(--text-faint)', fontSize: '.82rem', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' }}>
              Campaign detail
            </p>
            <h1 className="page-title" style={{ marginBottom: 10 }}>{campaign.title}</h1>
            <p className="page-copy" style={{ margin: 0, maxWidth: 760 }}>
              Review campaign context, compare creator applications, and move promising fits toward approval.
            </p>
          </div>
          <span className="status-pill" style={{ background: campaignStatus.bg, color: campaignStatus.color }}>
            {campaignStatus.label}
          </span>
        </div>

        <div className="chip-row">
          <span className="pill">Budget {formatCents(campaign.budget)}</span>
          <span className="pill">Niche {campaign.niche}</span>
          <span className="pill">Platforms {campaign.platforms.join(', ')}</span>
          <span className="pill">Deadline {new Date(campaign.deadline).toLocaleDateString()}</span>
          {campaign.creatorsNeeded ? (
            <span className="pill">
              {campaign.creatorsNeeded} creator{campaign.creatorsNeeded === 1 ? '' : 's'} needed
            </span>
          ) : null}
        </div>
      </section>

      <section className="dashboard-panel">
        <div>
          <h2 style={{ margin: '0 0 8px' }}>Campaign brief</h2>
          <p style={{ margin: 0, color: 'var(--text-soft)', whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
            {campaign.description}
          </p>
        </div>
      </section>

      {BRIEF_SECTIONS.some(section => campaign[section.key]) && (
        <section className="dashboard-panel">
          <div>
            <h2 style={{ margin: '0 0 8px' }}>Structured brief</h2>
            <p style={{ margin: 0, color: 'var(--text-soft)' }}>
              The extra context creators see before they decide whether to apply.
            </p>
          </div>

          <div className="subtle-grid two-col">
            {BRIEF_SECTIONS.map(section => {
              const value = campaign[section.key]
              if (!value) return null

              return (
                <div key={section.key} className="glass-card" style={{ boxShadow: 'var(--shadow-sm)' }}>
                  <p style={{ margin: '0 0 8px', color: 'var(--text-faint)', fontSize: '.78rem', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' }}>
                    {section.label}
                  </p>
                  <p style={{ margin: 0, color: 'var(--text)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                    {value}
                  </p>
                </div>
              )
            })}
          </div>
        </section>
      )}

      <section className="dashboard-panel">
        <div className="split-row">
          <div>
            <h2 style={{ margin: '0 0 8px' }}>Applications</h2>
            <p style={{ margin: 0, color: 'var(--text-soft)' }}>
              {campaign.applications.length} creator{campaign.applications.length !== 1 ? 's have' : ' has'} applied so far.
            </p>
          </div>
          {campaign.applications.some(a => a.status === 'ACCEPTED') && (
            <a
              href={`/brand/campaigns/${campaign.id}/applications`}
              className="apple-btn"
              style={{ padding: '8px 18px', fontSize: 15, textDecoration: 'none' }}
            >
              Review submissions
            </a>
          )}
        </div>

        {campaign.applications.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon" />
            <h3 style={{ margin: '0 0 8px' }}>No applications yet</h3>
            <p className="page-copy" style={{ margin: 0 }}>
              Once creators begin applying, this is where the strongest fits will become obvious.
            </p>
          </div>
        ) : (
          <div className="subtle-grid">
            {campaign.applications.map((application: (typeof campaign.applications)[number]) => {
              const applicationStatus = APP_STATUS[application.status] ?? APP_STATUS.PENDING
              return (
                <div key={application.id} className="glass-card" style={{ boxShadow: 'var(--shadow-sm)' }}>
                  <div className="split-row" style={{ marginBottom: 14 }}>
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
                          Proposed rate {formatCents(application.proposedRate)}
                        </p>
                      </div>
                    </div>
                    <span className="status-pill" style={{ background: applicationStatus.bg, color: applicationStatus.color }}>
                      {applicationStatus.label}
                    </span>
                  </div>

                  <p className="page-copy" style={{ margin: 0 }}>{application.pitch}</p>

                  {application.status === 'PENDING' && (
                    <ApplicationActions
                      applicationId={application.id}
                      proposedRate={application.proposedRate}
                      creatorName={application.creator.name ?? 'Creator'}
                    />
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}

function Skeleton() {
  return (
    <div className="subtle-grid" style={{ gap: 20 }}>
      <div className="shimmer" style={{ height: 140, borderRadius: 28 }} />
      <div className="shimmer" style={{ height: 160, borderRadius: 28 }} />
      <div className="subtle-grid">
        {[0, 1, 2].map(i => <div key={i} className="shimmer" style={{ height: 220, borderRadius: 28 }} />)}
      </div>
    </div>
  )
}

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return (
    <Suspense fallback={<Skeleton />}>
      <CampaignDetailContent id={id} />
    </Suspense>
  )
}
