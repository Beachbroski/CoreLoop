import { Suspense } from 'react'
import prisma from '@/lib/prisma'
import { formatCents } from '@/lib/utils'
import { resolveDashboardViewer } from '@/lib/view-as'
import { AdminViewBanner } from '../../AdminViewBanner'

const PAYOUT_STATUS: Record<string, { bg: string; color: string; label: string }> = {
  PENDING: { bg: 'var(--warning-soft)', color: 'var(--warning)', label: 'Pending' },
  PROCESSING: { bg: 'var(--accent-soft)', color: 'var(--accent)', label: 'Processing' },
  PAID: { bg: 'var(--success-soft)', color: 'var(--success)', label: 'Paid' },
  FAILED: { bg: 'var(--danger-soft)', color: 'var(--danger)', label: 'Failed' },
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(value)
}

async function PayoutsContent({ viewAsId }: { viewAsId?: string }) {
  const { viewer: user, isAdminViewing, viewAsNotFound } = await resolveDashboardViewer('CREATOR', viewAsId)

  const payouts = await prisma.payout.findMany({
    where: { creatorId: user.id },
    include: {
      submission: {
        include: {
          application: {
            include: { campaign: { select: { title: true } } },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  const totalPaid = payouts
    .filter(payout => payout.status === 'PAID')
    .reduce((sum, payout) => sum + payout.amount, 0)
  const totalPending = payouts
    .filter(payout => payout.status === 'PENDING' || payout.status === 'PROCESSING')
    .reduce((sum, payout) => sum + payout.amount, 0)
  const failedCount = payouts.filter(payout => payout.status === 'FAILED').length

  return (
    <div className="subtle-grid" style={{ gap: 24 }}>
      {isAdminViewing && (
        <AdminViewBanner viewingAsName={user.name} viewingAsEmail={user.email} notFound={viewAsNotFound} />
      )}
      <div>
        <p style={{ margin: '0 0 8px', color: 'var(--text-faint)', fontSize: '.82rem', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' }}>
          Payouts
        </p>
        <h1 className="page-title" style={{ marginBottom: 10 }}>Every payout, in one place.</h1>
        <p className="page-copy" style={{ margin: 0, maxWidth: 680 }}>
          Track what&apos;s been paid, what&apos;s still processing, and flag anything that failed.
        </p>
      </div>

      <div className="subtle-grid three-col">
        <div className="metric-card">
          <p className="metric-value">{formatCents(totalPaid)}</p>
          <p className="metric-label">Total paid</p>
        </div>
        <div className="metric-card">
          <p className="metric-value">{formatCents(totalPending)}</p>
          <p className="metric-label">Pending / processing</p>
        </div>
        <div className="metric-card">
          <p className="metric-value">{failedCount}</p>
          <p className="metric-label">Failed payouts</p>
        </div>
      </div>

      <section className="dashboard-panel">
        <div className="section-header">
          <div className="section-header-copy">
            <h2 style={{ margin: 0 }}>Payout history</h2>
            <p className="page-copy" style={{ margin: '8px 0 0' }}>
              One row per approved submission.
            </p>
          </div>
        </div>

        {payouts.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon" />
            <h3 style={{ margin: '0 0 8px' }}>No payouts yet</h3>
            <p className="page-copy" style={{ margin: 0 }}>
              Payouts show up here once a brand approves your submitted content.
            </p>
          </div>
        ) : (
          <div>
            {payouts.map(payout => {
              const statusInfo = PAYOUT_STATUS[payout.status] ?? PAYOUT_STATUS.PENDING
              return (
                <div key={payout.id} className="list-row">
                  <div>
                    <p style={{ margin: '0 0 6px', fontWeight: 600 }}>
                      {payout.submission.application.campaign.title}
                    </p>
                    <p style={{ margin: 0, color: 'var(--text-soft)', fontSize: '.9rem' }}>
                      {formatDate(payout.createdAt)} · Platform fee {formatCents(payout.platformFee)}
                    </p>
                    {payout.status === 'FAILED' && (
                      <p style={{ margin: '6px 0 0', color: 'var(--danger)', fontSize: '.9rem' }}>
                        This payout failed. Reach out to support if it doesn&apos;t resolve on its own.
                      </p>
                    )}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ margin: '0 0 6px', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                      {formatCents(payout.amount)}
                    </p>
                    <span className="status-pill" style={{ background: statusInfo.bg, color: statusInfo.color }}>
                      {statusInfo.label}
                    </span>
                  </div>
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
      <div>
        <div className="shimmer" style={{ height: 52, width: 320, marginBottom: 12 }} />
        <div className="shimmer" style={{ height: 22, width: 460 }} />
      </div>
      <div className="subtle-grid three-col">
        {[0, 1, 2].map(i => <div className="shimmer" key={i} style={{ height: 120, borderRadius: 28 }} />)}
      </div>
      <div className="shimmer" style={{ height: 320, borderRadius: 28 }} />
    </div>
  )
}

export default async function PayoutsPage({
  searchParams,
}: {
  searchParams: Promise<{ viewAs?: string }>
}) {
  const { viewAs } = await searchParams

  return (
    <Suspense fallback={<Skeleton />}>
      <PayoutsContent viewAsId={viewAs} />
    </Suspense>
  )
}
