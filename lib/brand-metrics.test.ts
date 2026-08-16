import { describe, expect, it } from 'vitest'
import {
  buildApplicationTrend,
  buildAttention,
  buildBrandMetrics,
  buildCampaignMetrics,
  buildCampaignStatusMix,
  buildFunnel,
  computeApplicationRates,
  computeSpend,
  computeSubmissionRates,
  formatPercent,
  ratio,
  type MetricsApplication,
  type MetricsCampaign,
  type MetricsPayout,
  type MetricsSubmission,
} from './brand-metrics'

const NOW = new Date(2026, 7, 15, 12, 0, 0)

function daysAgo(count: number, hour = 9): Date {
  const date = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() - count)
  date.setHours(hour, 0, 0, 0)
  return date
}

function campaign(overrides: Partial<MetricsCampaign> = {}): MetricsCampaign {
  return {
    id: 'campaign-1',
    title: 'Summer launch',
    status: 'ACTIVE',
    budget: 500_000,
    creatorsNeeded: 5,
    ...overrides,
  }
}

function application(overrides: Partial<MetricsApplication> = {}): MetricsApplication {
  return {
    id: 'application-1',
    campaignId: 'campaign-1',
    creatorId: 'creator-1',
    proposedRate: 50_000,
    status: 'PENDING',
    createdAt: daysAgo(1),
    ...overrides,
  }
}

function submission(overrides: Partial<MetricsSubmission> = {}): MetricsSubmission {
  return {
    id: 'submission-1',
    applicationId: 'application-1',
    status: 'PENDING',
    ...overrides,
  }
}

function payout(overrides: Partial<MetricsPayout> = {}): MetricsPayout {
  return {
    id: 'payout-1',
    submissionId: 'submission-1',
    amount: 50_000,
    platformFee: 7_500,
    status: 'PENDING',
    ...overrides,
  }
}

describe('ratio', () => {
  it('returns a fraction for a positive denominator', () => {
    expect(ratio(1, 4)).toBe(0.25)
  })

  it('returns null instead of dividing by zero', () => {
    expect(ratio(3, 0)).toBeNull()
    expect(ratio(0, 0)).toBeNull()
  })

  it('returns null for negative or non-finite denominators', () => {
    expect(ratio(1, -5)).toBeNull()
    expect(ratio(1, Number.NaN)).toBeNull()
  })
})

describe('formatPercent', () => {
  it('rounds fractions to whole percents', () => {
    expect(formatPercent(0.5)).toBe('50%')
    expect(formatPercent(0.333)).toBe('33%')
    expect(formatPercent(1.25)).toBe('125%')
  })

  it('falls back for null', () => {
    expect(formatPercent(null)).toBe('—')
    expect(formatPercent(null, 'n/a')).toBe('n/a')
  })
})

describe('buildFunnel', () => {
  it('returns zeroed steps and null conversions with no data', () => {
    const funnel = buildFunnel([], [], [])

    expect(funnel.steps).toHaveLength(5)
    expect(funnel.steps.every(step => step.count === 0)).toBe(true)
    expect(funnel.steps.every(step => step.shareOfTop === null)).toBe(true)
    expect(funnel.steps.every(step => step.conversionFromPrevious === null)).toBe(true)
    expect(funnel.submissionRowCount).toBe(0)
  })

  it('counts each stage and its conversion', () => {
    const applications = [
      application({ id: 'a1', status: 'ACCEPTED' }),
      application({ id: 'a2', status: 'ACCEPTED' }),
      application({ id: 'a3', status: 'REJECTED' }),
      application({ id: 'a4', status: 'PENDING' }),
    ]
    const submissions = [
      submission({ id: 's1', applicationId: 'a1', status: 'APPROVED' }),
      submission({ id: 's2', applicationId: 'a2', status: 'PENDING' }),
    ]
    const payouts = [payout({ id: 'p1', submissionId: 's1', status: 'PAID' })]

    const funnel = buildFunnel(applications, submissions, payouts)
    const counts = funnel.steps.map(step => step.count)

    expect(counts).toEqual([4, 2, 2, 1, 1])
    expect(funnel.steps[1].shareOfTop).toBe(0.5)
    expect(funnel.steps[1].conversionFromPrevious).toBe(0.5)
    expect(funnel.steps[1].previousLabel).toBe('Applications received')
    expect(funnel.steps[2].conversionFromPrevious).toBe(1)
    expect(funnel.steps[3].conversionFromPrevious).toBe(0.5)
    expect(funnel.approvedSubmissionRowCount).toBe(1)
  })

  it('does not let resubmissions inflate the funnel above the top', () => {
    const applications = [application({ id: 'a1', status: 'ACCEPTED' })]
    const submissions = [
      submission({ id: 's1', applicationId: 'a1', status: 'REVISION_REQUESTED' }),
      submission({ id: 's2', applicationId: 'a1', status: 'REVISION_REQUESTED' }),
      submission({ id: 's3', applicationId: 'a1', status: 'APPROVED' }),
    ]

    const funnel = buildFunnel(applications, submissions, [])

    expect(funnel.steps.map(step => step.count)).toEqual([1, 1, 1, 1, 0])
    expect(funnel.steps.every(step => (step.shareOfTop ?? 0) <= 1)).toBe(true)
    expect(funnel.submissionRowCount).toBe(3)
  })

  it('ignores submissions and payouts that do not belong to the given applications', () => {
    const applications = [application({ id: 'a1', status: 'ACCEPTED' })]
    const submissions = [
      submission({ id: 's1', applicationId: 'a1', status: 'APPROVED' }),
      submission({ id: 'orphan', applicationId: 'other-brand', status: 'APPROVED' }),
    ]
    const payouts = [
      payout({ id: 'p1', submissionId: 'orphan', status: 'PAID' }),
      payout({ id: 'p2', submissionId: 'missing', status: 'PAID' }),
    ]

    const funnel = buildFunnel(applications, submissions, payouts)

    expect(funnel.steps.map(step => step.count)).toEqual([1, 1, 1, 1, 0])
    expect(funnel.submissionRowCount).toBe(1)
  })

  it('only counts PAID payouts in the paid stage', () => {
    const applications = [application({ id: 'a1', status: 'ACCEPTED' })]
    const submissions = [submission({ id: 's1', applicationId: 'a1', status: 'APPROVED' })]

    for (const status of ['PENDING', 'PROCESSING', 'FAILED'] as const) {
      const funnel = buildFunnel(applications, submissions, [payout({ submissionId: 's1', status })])
      expect(funnel.steps[4].count).toBe(0)
    }
  })

  it('returns a null conversion when the previous stage is empty', () => {
    const funnel = buildFunnel([application({ id: 'a1', status: 'REJECTED' })], [], [])

    expect(funnel.steps[1].count).toBe(0)
    expect(funnel.steps[2].conversionFromPrevious).toBeNull()
  })
})

describe('computeApplicationRates', () => {
  it('returns null rates with no applications', () => {
    const rates = computeApplicationRates([])

    expect(rates).toMatchObject({ total: 0, pending: 0, accepted: 0, rejected: 0 })
    expect(rates.acceptanceRate).toBeNull()
    expect(rates.rejectionRate).toBeNull()
    expect(rates.pendingRate).toBeNull()
  })

  it('splits applications by status', () => {
    const rates = computeApplicationRates([
      application({ id: 'a1', status: 'ACCEPTED' }),
      application({ id: 'a2', status: 'REJECTED' }),
      application({ id: 'a3', status: 'REJECTED' }),
      application({ id: 'a4', status: 'PENDING' }),
    ])

    expect(rates.accepted).toBe(1)
    expect(rates.acceptanceRate).toBe(0.25)
    expect(rates.rejectionRate).toBe(0.5)
    expect(rates.pendingRate).toBe(0.25)
  })
})

describe('computeSubmissionRates', () => {
  it('returns null rates with no submissions', () => {
    const rates = computeSubmissionRates([])

    expect(rates.total).toBe(0)
    expect(rates.approvalRate).toBeNull()
    expect(rates.revisionRequestRate).toBeNull()
    expect(rates.rejectionRate).toBeNull()
    expect(rates.pendingRate).toBeNull()
  })

  it('tracks the revision-request rate', () => {
    const rates = computeSubmissionRates([
      submission({ id: 's1', status: 'APPROVED' }),
      submission({ id: 's2', status: 'REVISION_REQUESTED' }),
      submission({ id: 's3', status: 'REJECTED' }),
      submission({ id: 's4', status: 'PENDING' }),
    ])

    expect(rates.approvalRate).toBe(0.25)
    expect(rates.revisionRequestRate).toBe(0.25)
    expect(rates.rejectionRate).toBe(0.25)
    expect(rates.pending).toBe(1)
    expect(rates.pendingRate).toBe(0.25)
  })
})

describe('computeSpend', () => {
  it('returns zeros with no data', () => {
    const spend = computeSpend([], [], [])

    expect(spend).toMatchObject({
      realizedCents: 0,
      committedCents: 0,
      outstandingCents: 0,
      platformFeesCents: 0,
      failedPayoutCount: 0,
      totalBudgetCents: 0,
      acceptedApplications: 0,
      distinctAcceptedCreators: 0,
    })
    expect(spend.budgetUtilization).toBeNull()
    expect(spend.avgCostPerAcceptedCreatorCents).toBeNull()
  })

  it('separates realized, committed, outstanding and fees', () => {
    const campaigns = [campaign({ budget: 300_000 })]
    const applications = [
      application({ id: 'a1', status: 'ACCEPTED', proposedRate: 100_000 }),
      application({ id: 'a2', status: 'ACCEPTED', proposedRate: 60_000, creatorId: 'creator-2' }),
      application({ id: 'a3', status: 'PENDING', proposedRate: 90_000, creatorId: 'creator-3' }),
    ]
    const payouts = [
      payout({ id: 'p1', submissionId: 's1', amount: 100_000, platformFee: 15_000, status: 'PAID' }),
      payout({ id: 'p2', submissionId: 's2', amount: 60_000, platformFee: 9_000, status: 'PENDING' }),
      payout({ id: 'p3', submissionId: 's3', amount: 25_000, platformFee: 3_750, status: 'FAILED' }),
    ]

    const spend = computeSpend(campaigns, applications, payouts)

    expect(spend.committedCents).toBe(160_000)
    expect(spend.realizedCents).toBe(100_000)
    expect(spend.outstandingCents).toBe(60_000)
    expect(spend.platformFeesCents).toBe(15_000)
    expect(spend.inFlightCents).toBe(60_000)
    expect(spend.inFlightCount).toBe(1)
    expect(spend.failedPayoutCount).toBe(1)
    expect(spend.failedPayoutCents).toBe(25_000)
    expect(spend.paidPayoutCount).toBe(1)
    expect(spend.budgetUtilization).toBeCloseTo(160_000 / 300_000)
  })

  it('floors outstanding at zero when a paid application was later rejected', () => {
    const applications = [application({ id: 'a1', status: 'REJECTED', proposedRate: 40_000 })]
    const payouts = [payout({ amount: 40_000, status: 'PAID' })]

    const spend = computeSpend([], applications, payouts)

    expect(spend.committedCents).toBe(0)
    expect(spend.realizedCents).toBe(40_000)
    expect(spend.outstandingCents).toBe(0)
  })

  it('counts distinct creators separately from accepted applications', () => {
    const applications = [
      application({ id: 'a1', campaignId: 'c1', creatorId: 'creator-1', status: 'ACCEPTED' }),
      application({ id: 'a2', campaignId: 'c2', creatorId: 'creator-1', status: 'ACCEPTED' }),
    ]

    const spend = computeSpend([], applications, [])

    expect(spend.acceptedApplications).toBe(2)
    expect(spend.distinctAcceptedCreators).toBe(1)
  })

  it('rounds the average cost to whole cents', () => {
    const applications = [
      application({ id: 'a1', status: 'ACCEPTED', proposedRate: 3_333 }),
      application({ id: 'a2', status: 'ACCEPTED', proposedRate: 3_334, creatorId: 'creator-2' }),
    ]

    const spend = computeSpend([], applications, [])

    expect(spend.avgCostPerAcceptedCreatorCents).toBe(3_334)
    expect(Number.isInteger(spend.avgCostPerAcceptedCreatorCents)).toBe(true)
  })

  it('returns a null budget utilization when every budget is zero', () => {
    const spend = computeSpend(
      [campaign({ budget: 0 })],
      [application({ status: 'ACCEPTED', proposedRate: 10_000 })],
      [],
    )

    expect(spend.budgetUtilization).toBeNull()
  })
})

describe('buildCampaignMetrics', () => {
  it('returns an empty list with no campaigns', () => {
    expect(buildCampaignMetrics([], [application()], [], [])).toEqual([])
  })

  it('reports zeros for a campaign with no applications', () => {
    const [row] = buildCampaignMetrics([campaign({ id: 'c1' })], [], [], [])

    expect(row).toMatchObject({
      applicationCount: 0,
      acceptedCount: 0,
      committedCents: 0,
      realizedCents: 0,
      isOverBudget: false,
    })
    expect(row.budgetUtilization).toBe(0)
    expect(row.fillRate).toBe(0)
  })

  it('scopes applications and payouts to their own campaign', () => {
    const campaigns = [
      campaign({ id: 'c1', budget: 200_000, creatorsNeeded: 2 }),
      campaign({ id: 'c2', budget: 100_000, creatorsNeeded: 1 }),
    ]
    const applications = [
      application({ id: 'a1', campaignId: 'c1', status: 'ACCEPTED', proposedRate: 80_000 }),
      application({ id: 'a2', campaignId: 'c1', status: 'PENDING', proposedRate: 70_000 }),
      application({ id: 'a3', campaignId: 'c2', status: 'ACCEPTED', proposedRate: 50_000 }),
    ]
    const submissions = [
      submission({ id: 's1', applicationId: 'a1' }),
      submission({ id: 's3', applicationId: 'a3' }),
    ]
    const payouts = [
      payout({ id: 'p1', submissionId: 's1', amount: 80_000, status: 'PAID' }),
      payout({ id: 'p3', submissionId: 's3', amount: 50_000, status: 'FAILED' }),
    ]

    const [first, second] = buildCampaignMetrics(campaigns, applications, submissions, payouts)

    expect(first).toMatchObject({
      applicationCount: 2,
      acceptedCount: 1,
      pendingCount: 1,
      committedCents: 80_000,
      realizedCents: 80_000,
      statusLabel: 'Active',
    })
    expect(first.fillRate).toBe(0.5)
    expect(first.budgetUtilization).toBe(0.4)
    expect(second.committedCents).toBe(50_000)
    expect(second.realizedCents).toBe(0)
    expect(second.fillRate).toBe(1)
  })

  it('returns a null fill rate when creatorsNeeded is missing or zero', () => {
    const rows = buildCampaignMetrics(
      [campaign({ id: 'c1', creatorsNeeded: null }), campaign({ id: 'c2', creatorsNeeded: 0 })],
      [application({ id: 'a1', campaignId: 'c1', status: 'ACCEPTED' })],
      [],
      [],
    )

    expect(rows[0].fillRate).toBeNull()
    expect(rows[1].fillRate).toBeNull()
  })

  it('returns a null budget utilization when the budget is zero', () => {
    const [row] = buildCampaignMetrics(
      [campaign({ id: 'c1', budget: 0 })],
      [application({ campaignId: 'c1', status: 'ACCEPTED', proposedRate: 10_000 })],
      [],
      [],
    )

    expect(row.budgetUtilization).toBeNull()
    expect(row.isOverBudget).toBe(false)
  })

  it('flags a campaign whose committed spend exceeds its budget', () => {
    const [row] = buildCampaignMetrics(
      [campaign({ id: 'c1', budget: 50_000 })],
      [
        application({ id: 'a1', campaignId: 'c1', status: 'ACCEPTED', proposedRate: 40_000 }),
        application({ id: 'a2', campaignId: 'c1', status: 'ACCEPTED', proposedRate: 40_000 }),
      ],
      [],
      [],
    )

    expect(row.committedCents).toBe(80_000)
    expect(row.budgetUtilization).toBe(1.6)
    expect(row.isOverBudget).toBe(true)
  })
})

describe('buildCampaignStatusMix', () => {
  it('returns nothing with no campaigns', () => {
    expect(buildCampaignStatusMix([])).toEqual([])
  })

  it('keeps canonical order, drops empty statuses and shares to one', () => {
    const mix = buildCampaignStatusMix([
      campaign({ id: 'c1', status: 'COMPLETE' }),
      campaign({ id: 'c2', status: 'DRAFT' }),
      campaign({ id: 'c3', status: 'ACTIVE' }),
      campaign({ id: 'c4', status: 'ACTIVE' }),
    ])

    expect(mix.map(slice => slice.status)).toEqual(['DRAFT', 'ACTIVE', 'COMPLETE'])
    expect(mix.map(slice => slice.count)).toEqual([1, 2, 1])
    expect(mix.map(slice => slice.label)).toEqual(['Draft', 'Active', 'Complete'])
    expect(mix.reduce((total, slice) => total + (slice.share ?? 0), 0)).toBeCloseTo(1)
  })
})

describe('buildApplicationTrend', () => {
  it('builds a zeroed 14-day window with no applications', () => {
    const trend = buildApplicationTrend([], { now: NOW })

    expect(trend.days).toHaveLength(14)
    expect(trend.days.every(day => day.count === 0)).toBe(true)
    expect(trend.max).toBe(1)
    expect(trend.thisWeek).toBe(0)
    expect(trend.lastWeek).toBe(0)
    expect(trend.trend.direction).toBe('flat')
  })

  it('buckets applications by calendar day, oldest first', () => {
    const trend = buildApplicationTrend(
      [
        application({ id: 'a1', createdAt: daysAgo(0, 8) }),
        application({ id: 'a2', createdAt: daysAgo(0, 20) }),
        application({ id: 'a3', createdAt: daysAgo(13) }),
      ],
      { now: NOW },
    )

    expect(trend.days[13].count).toBe(2)
    expect(trend.days[0].count).toBe(1)
    expect(trend.max).toBe(2)
  })

  it('excludes applications older than the window', () => {
    const trend = buildApplicationTrend([application({ createdAt: daysAgo(40) })], { now: NOW })

    expect(trend.days.every(day => day.count === 0)).toBe(true)
  })

  it('splits the window into this week and last week', () => {
    const trend = buildApplicationTrend(
      [
        application({ id: 'a1', createdAt: daysAgo(1) }),
        application({ id: 'a2', createdAt: daysAgo(2) }),
        application({ id: 'a3', createdAt: daysAgo(3) }),
        application({ id: 'a4', createdAt: daysAgo(10) }),
      ],
      { now: NOW },
    )

    expect(trend.thisWeek).toBe(3)
    expect(trend.lastWeek).toBe(1)
    expect(trend.trend.direction).toBe('up')
  })

  it('honours a custom window length', () => {
    const trend = buildApplicationTrend([], { now: NOW, days: 7 })

    expect(trend.days).toHaveLength(7)
  })
})

describe('buildAttention', () => {
  it('is empty when nothing is waiting', () => {
    const attention = buildAttention(
      [application({ status: 'ACCEPTED' })],
      [submission({ status: 'APPROVED' })],
      [payout({ status: 'PAID' })],
    )

    expect(attention.total).toBe(0)
  })

  it('counts pending reviews and failed payouts', () => {
    const attention = buildAttention(
      [application({ id: 'a1', status: 'PENDING' }), application({ id: 'a2', status: 'PENDING' })],
      [
        submission({ id: 's1', status: 'PENDING' }),
        submission({ id: 's2', status: 'REVISION_REQUESTED' }),
      ],
      [payout({ id: 'p1', amount: 30_000, status: 'FAILED' })],
    )

    expect(attention).toMatchObject({
      pendingApplications: 2,
      submissionsAwaitingReview: 1,
      revisionsRequested: 1,
      failedPayouts: 1,
      failedPayoutCents: 30_000,
      total: 4,
    })
  })
})

describe('buildBrandMetrics', () => {
  it('handles a brand with no campaigns at all', () => {
    const metrics = buildBrandMetrics({ campaigns: [], applications: [], submissions: [], payouts: [], now: NOW })

    expect(metrics.hasCampaigns).toBe(false)
    expect(metrics.hasApplications).toBe(false)
    expect(metrics.campaigns).toEqual([])
    expect(metrics.statusMix).toEqual([])
    expect(metrics.spend.realizedCents).toBe(0)
    expect(metrics.applications.acceptanceRate).toBeNull()
    expect(metrics.attention.total).toBe(0)
  })

  it('handles campaigns that have never received an application', () => {
    const metrics = buildBrandMetrics({
      campaigns: [campaign({ id: 'c1' })],
      applications: [],
      submissions: [],
      payouts: [],
      now: NOW,
    })

    expect(metrics.hasCampaigns).toBe(true)
    expect(metrics.hasApplications).toBe(false)
    expect(metrics.campaigns).toHaveLength(1)
    expect(metrics.funnel.steps[0].count).toBe(0)
  })

  it('composes every section for a realistic brand', () => {
    const metrics = buildBrandMetrics({
      campaigns: [campaign({ id: 'c1', budget: 400_000, creatorsNeeded: 2, status: 'IN_PROGRESS' })],
      applications: [
        application({ id: 'a1', campaignId: 'c1', creatorId: 'creator-1', status: 'ACCEPTED', proposedRate: 120_000 }),
        application({ id: 'a2', campaignId: 'c1', creatorId: 'creator-2', status: 'ACCEPTED', proposedRate: 80_000 }),
        application({ id: 'a3', campaignId: 'c1', creatorId: 'creator-3', status: 'PENDING', proposedRate: 90_000 }),
      ],
      submissions: [
        submission({ id: 's1', applicationId: 'a1', status: 'APPROVED' }),
        submission({ id: 's2', applicationId: 'a2', status: 'PENDING' }),
      ],
      payouts: [payout({ id: 'p1', submissionId: 's1', amount: 120_000, platformFee: 18_000, status: 'PAID' })],
      now: NOW,
    })

    expect(metrics.funnel.steps.map(step => step.count)).toEqual([3, 2, 2, 1, 1])
    expect(metrics.spend.committedCents).toBe(200_000)
    expect(metrics.spend.realizedCents).toBe(120_000)
    expect(metrics.spend.outstandingCents).toBe(80_000)
    expect(metrics.spend.platformFeesCents).toBe(18_000)
    expect(metrics.campaigns[0].fillRate).toBe(1)
    expect(metrics.statusMix).toEqual([{ status: 'IN_PROGRESS', label: 'In progress', count: 1, share: 1 }])
    expect(metrics.attention.pendingApplications).toBe(1)
    expect(metrics.attention.submissionsAwaitingReview).toBe(1)
    expect(metrics.trend.days).toHaveLength(14)
  })
})
