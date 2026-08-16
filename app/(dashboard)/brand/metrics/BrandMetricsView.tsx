import Link from 'next/link'
import { formatPercent, type BrandMetrics, type CampaignStatusValue } from '@/lib/brand-metrics'
import { formatCents } from '@/lib/utils'
import { AttentionList } from './AttentionList'
import { BreakdownList } from './BreakdownList'
import { FunnelBars } from './FunnelBars'

const STATUS_TONE: Record<CampaignStatusValue, { bg: string; color: string; bar: string }> = {
  DRAFT: { bg: 'rgba(15,23,42,0.06)', color: 'var(--text-soft)', bar: 'var(--text-faint)' },
  ACTIVE: { bg: 'var(--accent-soft)', color: 'var(--accent)', bar: 'var(--accent)' },
  IN_PROGRESS: { bg: 'var(--success-soft)', color: 'var(--success)', bar: 'var(--success)' },
  COMPLETE: { bg: 'rgba(15,23,42,0.06)', color: 'var(--text-soft)', bar: 'var(--text-soft)' },
  CANCELLED: { bg: 'var(--danger-soft)', color: 'var(--danger)', bar: 'var(--danger)' },
}

const MONEY_VALUE_STYLE = { fontSize: 'clamp(1.5rem, 2.4vw, 2.15rem)', overflowWrap: 'break-word' as const }

interface BrandMetricsViewProps {
  metrics: BrandMetrics
  readOnly: boolean
}

interface MoneyCard {
  label: string
  value: string
  caption: string
}

export function BrandMetricsView({ metrics, readOnly }: BrandMetricsViewProps) {
  const { spend, funnel, applications, submissions, trend, attention, statusMix, campaigns } = metrics

  if (!metrics.hasCampaigns) {
    return (
      <div className="empty-state">
        <div className="empty-icon" />
        <h3 style={{ margin: '0 0 8px' }}>No campaigns, no metrics yet</h3>
        <p className="page-copy" style={{ margin: '0 auto 18px', maxWidth: 460 }}>
          Every number on this page is computed from your own campaigns, applications, and payouts. Post your first
          campaign and the funnel starts filling in as creators apply.
        </p>
        {!readOnly && <Link href="/brand/campaigns/new" className="apple-btn">Post a campaign</Link>}
      </div>
    )
  }

  const moneyCards: MoneyCard[] = [
    {
      label: 'Paid to creators',
      value: formatCents(spend.realizedCents),
      caption: `${spend.paidPayoutCount} completed payout${spend.paidPayoutCount === 1 ? '' : 's'}`,
    },
    {
      label: 'Committed',
      value: formatCents(spend.committedCents),
      caption: `${spend.acceptedApplications} accepted · ${spend.distinctAcceptedCreators} creator${spend.distinctAcceptedCreators === 1 ? '' : 's'}`,
    },
    {
      label: 'Still owed',
      value: formatCents(spend.outstandingCents),
      caption: spend.inFlightCount > 0 ? `${formatCents(spend.inFlightCents)} already in flight` : 'Accepted work not yet paid',
    },
    {
      label: 'Platform fees paid',
      value: formatCents(spend.platformFeesCents),
      caption: 'Charged on completed payouts',
    },
    {
      label: 'Avg per accepted creator',
      value: spend.avgCostPerAcceptedCreatorCents === null
        ? '—'
        : formatCents(spend.avgCostPerAcceptedCreatorCents),
      caption: 'Committed rate, averaged',
    },
  ]

  return (
    <div className="subtle-grid spacing-xl">
      <section className="admin-metric-grid">
        {moneyCards.map(card => (
          <article key={card.label} className="metric-card">
            <p className="metric-value" style={MONEY_VALUE_STYLE}>{card.value}</p>
            <p className="metric-label">{card.label}</p>
            <p style={{ margin: '6px 0 0', color: 'var(--text-faint)', fontSize: '.8rem' }}>{card.caption}</p>
          </article>
        ))}
      </section>

      <div className="subtle-grid two-col">
        <section className="dashboard-panel">
          <div className="section-header">
            <div className="section-header-copy">
              <h2 style={{ margin: 0 }}>From application to paid</h2>
              <p className="page-copy" style={{ margin: '8px 0 0' }}>
                Where creators drop out of the pipeline, and how much of the top of funnel makes it to a payout.
              </p>
            </div>
          </div>

          {!metrics.hasApplications ? (
            <p className="page-copy" style={{ margin: 0 }}>
              No applications yet. The funnel fills in as creators apply to your live campaigns.
            </p>
          ) : (
            <>
              <FunnelBars steps={funnel.steps} />
              <p style={{ margin: '18px 0 0', color: 'var(--text-faint)', fontSize: '.8rem', lineHeight: 1.6 }}>
                Each step counts applications, not files: a creator who resubmits after a revision request is still one
                application. {funnel.submissionRowCount} content file{funnel.submissionRowCount === 1 ? '' : 's'} received
                in total.
              </p>
            </>
          )}
        </section>

        <section className="dashboard-panel">
          <div className="section-header">
            <div className="section-header-copy">
              <h2 style={{ margin: 0 }}>Applications, last 14 days</h2>
              <p className="page-copy" style={{ margin: '8px 0 0' }}>
                {trend.thisWeek} this week vs {trend.lastWeek} the week before.
              </p>
              <p className={`metric-trend metric-trend-${trend.trend.direction}`}>
                {trend.trend.direction === 'up' ? '↑' : trend.trend.direction === 'down' ? '↓' : '→'} {trend.trend.label}
              </p>
            </div>
          </div>
          <div className="admin-trend-chart">
            {trend.days.map(day => (
              <div key={day.key} className="admin-trend-bar-col" title={`${day.label}: ${day.count}`}>
                <div
                  className="admin-trend-bar"
                  style={{ height: `${Math.max(4, (day.count / trend.max) * 100)}%` }}
                />
                <span className="admin-trend-bar-label">{day.label}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="subtle-grid two-col">
        <section className="dashboard-panel">
          <div className="section-header">
            <div className="section-header-copy">
              <h2 style={{ margin: 0 }}>Decisions you have made</h2>
              <p className="page-copy" style={{ margin: '8px 0 0' }}>
                How selective you are on pitches, and how often delivered content clears review first time.
              </p>
            </div>
          </div>
          <div className="subtle-grid two-col">
            <BreakdownList
              title={`Applications (${applications.total})`}
              emptyLabel="No applications yet."
              rows={[
                { label: 'Accepted', count: applications.accepted, share: applications.acceptanceRate, tone: 'var(--success)' },
                { label: 'Rejected', count: applications.rejected, share: applications.rejectionRate, tone: 'var(--danger)' },
                { label: 'Still pending', count: applications.pending, share: applications.pendingRate, tone: 'var(--warning)' },
              ]}
            />
            <BreakdownList
              title={`Content reviews (${submissions.total})`}
              emptyLabel="No content submitted yet."
              rows={[
                { label: 'Approved', count: submissions.approved, share: submissions.approvalRate, tone: 'var(--success)' },
                { label: 'Revision requested', count: submissions.revisionRequested, share: submissions.revisionRequestRate, tone: 'var(--accent)' },
                { label: 'Rejected', count: submissions.rejected, share: submissions.rejectionRate, tone: 'var(--danger)' },
                { label: 'Awaiting review', count: submissions.pending, share: submissions.pendingRate, tone: 'var(--warning)' },
              ]}
            />
          </div>
        </section>

        <section className="dashboard-panel">
          <div className="section-header">
            <div className="section-header-copy">
              <h2 style={{ margin: 0 }}>Needs your attention</h2>
              <p className="page-copy" style={{ margin: '8px 0 0' }}>
                Work sitting with you, not with your creators.
              </p>
            </div>
          </div>
          <AttentionList attention={attention} />
        </section>
      </div>

      <section className="dashboard-panel">
        <div className="section-header">
          <div className="section-header-copy">
            <h2 style={{ margin: 0 }}>Campaign performance</h2>
            <p className="page-copy" style={{ margin: '8px 0 0' }}>
              Budget committed against what you set aside, and how many of your creator slots are filled.
            </p>
          </div>
          <div className="section-header-action">
            <span className="pill">{campaigns.length} campaign{campaigns.length === 1 ? '' : 's'}</span>
          </div>
        </div>

        <div style={{ margin: '4px 0 22px' }}>
          <div className="admin-breakdown-track" style={{ display: 'flex', height: 10 }}>
            {statusMix.map(slice => (
              <div
                key={slice.status}
                className="admin-breakdown-fill"
                style={{ width: `${(slice.share ?? 0) * 100}%`, background: STATUS_TONE[slice.status].bar, borderRadius: 0 }}
                title={`${slice.label}: ${slice.count}`}
              />
            ))}
          </div>
          <div className="chip-row" style={{ marginTop: 12 }}>
            {statusMix.map(slice => (
              <span
                key={slice.status}
                className="status-pill"
                style={{ background: STATUS_TONE[slice.status].bg, color: STATUS_TONE[slice.status].color }}
              >
                {slice.label} · {slice.count}
              </span>
            ))}
          </div>
        </div>

        <div className="subtle-grid" style={{ gap: 14 }}>
          {campaigns.map(row => {
            const tone = STATUS_TONE[row.status]
            return (
              <article key={row.id} className="glass-card" style={{ boxShadow: 'var(--shadow-sm)' }}>
                <div className="split-row" style={{ marginBottom: 16 }}>
                  <p style={{ margin: 0, fontWeight: 600 }}>{row.title}</p>
                  <span className="status-pill" style={{ background: tone.bg, color: tone.color }}>{row.statusLabel}</span>
                </div>

                <div className="subtle-grid two-col" style={{ gap: 18 }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.85rem', marginBottom: 4 }}>
                      <span style={{ color: 'var(--text-soft)' }}>Budget committed</span>
                      <span
                        style={{
                          fontVariantNumeric: 'tabular-nums',
                          color: row.isOverBudget ? 'var(--danger)' : 'var(--text-soft)',
                          fontWeight: row.isOverBudget ? 600 : 400,
                        }}
                      >
                        {formatPercent(row.budgetUtilization)}
                      </span>
                    </div>
                    <div className="admin-breakdown-track">
                      <div
                        className="admin-breakdown-fill"
                        style={{
                          width: `${Math.min(100, (row.budgetUtilization ?? 0) * 100)}%`,
                          background: row.isOverBudget ? 'var(--danger)' : 'var(--accent)',
                        }}
                      />
                    </div>
                    <p style={{ margin: '6px 0 0', color: 'var(--text-faint)', fontSize: '.8rem' }}>
                      {formatCents(row.committedCents)} of {formatCents(row.budgetCents)}
                      {row.budgetCents === 0 ? ' — no budget set' : ''}
                    </p>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.85rem', marginBottom: 4 }}>
                      <span style={{ color: 'var(--text-soft)' }}>Creator slots filled</span>
                      <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--text-soft)' }}>
                        {formatPercent(row.fillRate)}
                      </span>
                    </div>
                    <div className="admin-breakdown-track">
                      <div
                        className="admin-breakdown-fill"
                        style={{ width: `${Math.min(100, (row.fillRate ?? 0) * 100)}%`, background: 'var(--success)' }}
                      />
                    </div>
                    <p style={{ margin: '6px 0 0', color: 'var(--text-faint)', fontSize: '.8rem' }}>
                      {row.creatorsNeeded
                        ? `${row.acceptedCount} of ${row.creatorsNeeded} accepted`
                        : `${row.acceptedCount} accepted — no target set`}
                    </p>
                  </div>
                </div>

                <div className="chip-row" style={{ marginTop: 16, alignItems: 'center' }}>
                  <span className="pill">{row.applicationCount} application{row.applicationCount === 1 ? '' : 's'}</span>
                  {row.pendingCount > 0 && (
                    <span className="status-pill" style={{ background: 'var(--warning-soft)', color: 'var(--warning)' }}>
                      {row.pendingCount} awaiting decision
                    </span>
                  )}
                  <span className="pill">Paid {formatCents(row.realizedCents)}</span>
                  <Link href={`/brand/campaigns/${row.id}`} className="apple-link">Manage</Link>
                </div>
              </article>
            )
          })}
        </div>
      </section>
    </div>
  )
}
