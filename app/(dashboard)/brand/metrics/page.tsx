import { Suspense } from 'react'
import Link from 'next/link'
import prisma from '@/lib/prisma'
import { buildBrandMetrics } from '@/lib/brand-metrics'
import { resolveDashboardViewer } from '@/lib/view-as'
import { AdminViewBanner } from '../../AdminViewBanner'
import { BrandMetricsView } from './BrandMetricsView'

async function MetricsContent({ viewAsId }: { viewAsId?: string }) {
  const { viewer: user, isAdminViewing, readOnly, viewAsNotFound } = await resolveDashboardViewer('BRAND', viewAsId)

  const [campaigns, applications, submissions, payouts] = await Promise.all([
    prisma.campaign.findMany({
      where: { brandId: user.id },
      select: { id: true, title: true, status: true, budget: true, creatorsNeeded: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.application.findMany({
      where: { campaign: { brandId: user.id } },
      select: { id: true, campaignId: true, creatorId: true, proposedRate: true, status: true, createdAt: true },
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

  const metrics = buildBrandMetrics({ campaigns, applications, submissions, payouts })

  return (
    <div className="subtle-grid spacing-xl">
      {isAdminViewing && (
        <AdminViewBanner viewingAsName={user.name} viewingAsEmail={user.email} notFound={viewAsNotFound} />
      )}
      <BrandMetricsView metrics={metrics} readOnly={readOnly} />
    </div>
  )
}

function MetricsSkeleton() {
  return (
    <div className="subtle-grid" style={{ gap: 20 }}>
      <div className="admin-metric-grid">
        {[0, 1, 2, 3, 4].map(i => <div className="shimmer" key={i} style={{ height: 150, borderRadius: 28 }} />)}
      </div>
      <div className="subtle-grid two-col">
        {[0, 1].map(i => <div className="shimmer" key={i} style={{ height: 380, borderRadius: 28 }} />)}
      </div>
      <div className="shimmer" style={{ height: 320, borderRadius: 28 }} />
    </div>
  )
}

export default async function BrandMetricsPage({
  searchParams,
}: {
  searchParams: Promise<{ viewAs?: string }>
}) {
  const { viewAs } = await searchParams

  return (
    <div className="subtle-grid" style={{ gap: 26 }}>
      <div className="page-header">
        <div className="page-header-copy">
          <p style={{ margin: '0 0 8px', color: 'var(--text-faint)', fontSize: '.82rem', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' }}>
            Metrics
          </p>
          <h1 className="page-title" style={{ marginBottom: 10 }}>Is this working, and what is it costing you?</h1>
          <p className="page-copy" style={{ margin: 0, maxWidth: 720 }}>
            Every number here is computed from your own campaigns, applications, submissions, and payouts — nothing is
            modelled or estimated.
          </p>
        </div>
        <Link href="/brand" className="apple-btn-ghost page-header-action">Back to dashboard</Link>
      </div>

      <Suspense fallback={<MetricsSkeleton />}>
        <MetricsContent viewAsId={viewAs} />
      </Suspense>
    </div>
  )
}
