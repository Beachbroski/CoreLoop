import Link from 'next/link'
import type { Application, Campaign } from '@prisma/client'
import { Suspense } from 'react'
import prisma from '@/lib/prisma'
import { buildBrandMetrics, formatPercent } from '@/lib/brand-metrics'
import { formatCents, type Trend } from '@/lib/utils'
import { resolveDashboardViewer } from '@/lib/view-as'
import { AdminViewBanner } from '../AdminViewBanner'
import { AttentionList } from './metrics/AttentionList'
import { FunnelBars } from './metrics/FunnelBars'

const STATUS: Record<string, { bg: string; color: string; label: string }> = {
  DRAFT: { bg: 'rgba(15,23,42,0.06)', color: 'var(--text-soft)', label: 'Draft' },
  ACTIVE: { bg: 'var(--accent-soft)', color: 'var(--accent)', label: 'Active' },
  IN_PROGRESS: { bg: 'var(--success-soft)', color: 'var(--success)', label: 'In progress' },
  COMPLETE: { bg: 'rgba(15,23,42,0.06)', color: 'var(--text-soft)', label: 'Complete' },
  CANCELLED: { bg: 'var(--danger-soft)', color: 'var(--danger)', label: 'Cancelled' },
}

type CampaignWithApplications = Campaign & { applications: Application[] }

async function BrandDashboardContent({ viewAsId }: { viewAsId?: string }) {
  const { viewer: user, isAdminViewing, readOnly, viewAsNotFound } = await resolveDashboardViewer('BRAND', viewAsId)

  const [campaigns, submissions, payouts] = await Promise.all([
    prisma.campaign.findMany({
      where: { brandId: user.id },
      include: { applications: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.submission.findMany({
      where: { application: { campaign: { brandId: user.id } } },
      select: { id: true, applicationId: true, status: true },
    }),
    prisma.payout.findMany({
      where: { submission: { application: { campaign: { brandId: user.id } } } },
      select: { id: true, submissionId: true, amount: true, platformFee: true, status: true },
    }),
  ])

  const allApplications = campaigns.flatMap((campaign: CampaignWithApplications) => campaign.applications)
  const metrics = buildBrandMetrics({ campaigns, applications: allApplications, submissions, payouts })
  const awaitingReview = metrics.attention.pendingApplications + metrics.attention.submissionsAwaitingReview

  const stats: Array<{ label: string; value: string; trend?: Trend }> = [
    { label: 'Applications received', value: String(metrics.applications.total), trend: metrics.trend.trend },
    { label: 'Acceptance rate', value: formatPercent(metrics.applications.acceptanceRate) },
    { label: 'Awaiting your review', value: String(awaitingReview) },
    { label: 'Paid to creators', value: formatCents(metrics.spend.realizedCents) },
  ]

  return (
    <div className="subtle-grid" style={{ gap: 26 }}>
      {isAdminViewing && (
        <AdminViewBanner viewingAsName={user.name} viewingAsEmail={user.email} notFound={viewAsNotFound} />
      )}

      <div className="page-header">
        <div className="page-header-copy">
          <p style={{ margin: '0 0 8px', color: 'var(--text-faint)', fontSize: '.82rem', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' }}>
            Brand dashboard
          </p>
          <h1 className="page-title" style={{ marginBottom: 10 }}>Build campaigns people want to reply to.</h1>
          <p className="page-copy" style={{ margin: 0, maxWidth: 720 }}>
            Keep the top of funnel moving, spot strong creator fit early, and manage every live brief in one clean system.
          </p>
        </div>
        {!readOnly && <Link href="/brand/campaigns/new" className="apple-btn page-header-action">New campaign</Link>}
      </div>

      <div className="subtle-grid four-col">
        {stats.map(stat => (
          <div key={stat.label} className="metric-card">
            <p className="metric-value">{stat.value}</p>
            <p className="metric-label" style={{ maxWidth: 190 }}>{stat.label}</p>
            {stat.trend && (
              <p className={`metric-trend metric-trend-${stat.trend.direction}`}>
                {stat.trend.direction === 'up' ? '↑' : stat.trend.direction === 'down' ? '↓' : '→'} {stat.trend.label}
              </p>
            )}
          </div>
        ))}
      </div>

      <div className="subtle-grid two-col">
        <section className="dashboard-panel">
          <div className="split-row">
            <div>
              <h2 style={{ margin: 0 }}>Live campaign queue</h2>
              <p style={{ margin: '6px 0 0', color: 'var(--text-soft)' }}>
                Everything important at a glance: budget, deadline, momentum, and status.
              </p>
            </div>
          </div>

          {campaigns.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon" />
              <h3 style={{ margin: '0 0 8px' }}>No campaigns yet</h3>
              <p className="page-copy" style={{ margin: '0 0 18px' }}>
                Post your first campaign and start attracting creators with briefs that feel clear and premium.
              </p>
              {!readOnly && <Link href="/brand/campaigns/new" className="apple-btn">Post a campaign</Link>}
            </div>
          ) : (
            <div>
              {campaigns.map((campaign: CampaignWithApplications) => {
                const status = STATUS[campaign.status] ?? STATUS.DRAFT
                return (
                  <div key={campaign.id} className="list-row">
                    <div style={{ minWidth: 0 }}>
                      <p style={{ margin: '0 0 6px', fontWeight: 600 }}>{campaign.title}</p>
                      <p style={{ margin: 0, color: 'var(--text-soft)', fontSize: '.94rem' }}>
                        {campaign.niche} · {formatCents(campaign.budget)} · Due {new Date(campaign.deadline).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="chip-row" style={{ justifyContent: 'flex-end' }}>
                      <span className="status-pill" style={{ background: status.bg, color: status.color }}>
                        {status.label}
                      </span>
                      {campaign.creatorsNeeded ? (
                        <span className="pill">
                          {campaign.creatorsNeeded} slot{campaign.creatorsNeeded === 1 ? '' : 's'}
                        </span>
                      ) : null}
                      <span className="pill">{campaign.applications.length} applicant{campaign.applications.length !== 1 ? 's' : ''}</span>
                      <Link href={`/brand/campaigns/${campaign.id}`} className="apple-link">Manage</Link>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        <section className="dashboard-panel">
          <div className="section-header">
            <div className="section-header-copy">
              <h2 style={{ margin: 0 }}>Where things stand</h2>
              <p style={{ margin: '8px 0 0', color: 'var(--text-soft)' }}>
                What is waiting on you, and how far your applicants get.
              </p>
            </div>
            <div className="section-header-action">
              <Link href="/brand/metrics" className="apple-btn-ghost">View metrics</Link>
            </div>
          </div>

          <AttentionList attention={metrics.attention} />

          <div style={{ marginTop: 22 }}>
            <p className="sidebar-label" style={{ margin: '0 0 12px' }}>Pipeline</p>
            {metrics.hasApplications ? (
              <>
                <FunnelBars steps={metrics.funnel.steps} compact />
                <p style={{ margin: '14px 0 0', color: 'var(--text-faint)', fontSize: '.8rem' }}>
                  {formatCents(metrics.spend.outstandingCents)} still owed on accepted work.
                </p>
              </>
            ) : (
              <p className="page-copy" style={{ margin: 0, fontSize: '.92rem' }}>
                No applications yet. As creators apply, this shows how many convert to accepted, delivered, approved,
                and paid.
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="subtle-grid" style={{ gap: 20 }}>
      <div>
        <div className="shimmer" style={{ height: 52, width: 320, marginBottom: 12 }} />
        <div className="shimmer" style={{ height: 22, width: 460 }} />
      </div>
      <div className="subtle-grid four-col">
        {[0, 1, 2, 3].map(i => <div className="shimmer" key={i} style={{ height: 140, borderRadius: 28 }} />)}
      </div>
      <div className="subtle-grid two-col">
        {[0, 1].map(i => <div className="shimmer" key={i} style={{ height: 360, borderRadius: 28 }} />)}
      </div>
    </div>
  )
}

export default async function BrandDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ viewAs?: string }>
}) {
  const { viewAs } = await searchParams

  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <BrandDashboardContent viewAsId={viewAs} />
    </Suspense>
  )
}
