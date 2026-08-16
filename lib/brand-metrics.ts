import { compareToLastWeek, type Trend } from './utils'

// Pure aggregation helpers for the brand metrics dashboard.
//
// Every function here takes rows that were already fetched and scoped to a single
// brand — there are no Prisma calls in this file so the logic stays testable without
// a database. Callers are responsible for passing brand-scoped rows.
//
// Money is INTEGER CENTS everywhere. Ratios are returned as fractions (0..1) or `null`
// when the denominator is zero, so the UI can decide how to render "not applicable".
//
// Deliberately NOT computed here: anything about reach, views, clicks, engagement or
// ROAS (no such columns exist), and anything about time-to-decision (the schema has no
// status-change timestamps — only `createdAt` and a single mutable `updatedAt`).

export type CampaignStatusValue = 'DRAFT' | 'ACTIVE' | 'IN_PROGRESS' | 'COMPLETE' | 'CANCELLED'
export type ApplicationStatusValue = 'PENDING' | 'ACCEPTED' | 'REJECTED'
export type SubmissionStatusValue = 'PENDING' | 'APPROVED' | 'REVISION_REQUESTED' | 'REJECTED'
export type PayoutStatusValue = 'PENDING' | 'PROCESSING' | 'PAID' | 'FAILED'

export interface MetricsCampaign {
  id: string
  title: string
  status: CampaignStatusValue
  budget: number
  creatorsNeeded: number | null
}

export interface MetricsApplication {
  id: string
  campaignId: string
  creatorId: string
  proposedRate: number
  status: ApplicationStatusValue
  createdAt: Date
}

export interface MetricsSubmission {
  id: string
  applicationId: string
  status: SubmissionStatusValue
}

export interface MetricsPayout {
  id: string
  submissionId: string
  amount: number
  platformFee: number
  status: PayoutStatusValue
}

export interface BrandMetricsInput {
  campaigns: readonly MetricsCampaign[]
  applications: readonly MetricsApplication[]
  submissions: readonly MetricsSubmission[]
  payouts: readonly MetricsPayout[]
  now?: Date
}

const CAMPAIGN_STATUS_ORDER: readonly CampaignStatusValue[] = [
  'DRAFT',
  'ACTIVE',
  'IN_PROGRESS',
  'COMPLETE',
  'CANCELLED',
]

const CAMPAIGN_STATUS_LABEL: Record<CampaignStatusValue, string> = {
  DRAFT: 'Draft',
  ACTIVE: 'Active',
  IN_PROGRESS: 'In progress',
  COMPLETE: 'Complete',
  CANCELLED: 'Cancelled',
}

const TREND_DAYS = 14

function sumBy<T>(rows: readonly T[], pick: (row: T) => number): number {
  return rows.reduce((total, row) => total + pick(row), 0)
}

function countWhere<T>(rows: readonly T[], match: (row: T) => boolean): number {
  return rows.reduce((total, row) => (match(row) ? total + 1 : total), 0)
}

// Returns `null` instead of NaN/Infinity so callers never render a divide-by-zero.
export function ratio(numerator: number, denominator: number): number | null {
  if (!Number.isFinite(denominator) || denominator <= 0) return null
  return numerator / denominator
}

export function formatPercent(value: number | null, fallback = '—'): string {
  if (value === null || !Number.isFinite(value)) return fallback
  return `${Math.round(value * 100)}%`
}

/* ---------------------------------------------------------------- funnel -- */

export type FunnelStepKey = 'applied' | 'accepted' | 'submitted' | 'approved' | 'paid'

export interface FunnelStep {
  key: FunnelStepKey
  label: string
  hint: string
  count: number
  shareOfTop: number | null
  conversionFromPrevious: number | null
  previousLabel: string | null
}

export interface FunnelSummary {
  steps: FunnelStep[]
  submissionRowCount: number
  approvedSubmissionRowCount: number
}

interface StageCounts {
  applied: number
  accepted: number
  submitted: number
  approved: number
  paid: number
}

// Each stage counts APPLICATIONS that reached it, not raw rows, so the funnel stays
// monotonic: a creator who resubmits after a revision request is still one application.
// Raw submission row counts are reported separately on `FunnelSummary`.
function countStages(
  applications: readonly MetricsApplication[],
  scopedSubmissions: readonly MetricsSubmission[],
  payouts: readonly MetricsPayout[],
): StageCounts {
  const submissionById = new Map(scopedSubmissions.map(submission => [submission.id, submission]))

  const submittedApplicationIds = new Set(scopedSubmissions.map(submission => submission.applicationId))
  const approvedApplicationIds = new Set(
    scopedSubmissions
      .filter(submission => submission.status === 'APPROVED')
      .map(submission => submission.applicationId),
  )

  const paidApplicationIds = new Set<string>()
  for (const payout of payouts) {
    if (payout.status !== 'PAID') continue
    const submission = submissionById.get(payout.submissionId)
    if (submission) paidApplicationIds.add(submission.applicationId)
  }

  return {
    applied: applications.length,
    accepted: countWhere(applications, application => application.status === 'ACCEPTED'),
    submitted: submittedApplicationIds.size,
    approved: approvedApplicationIds.size,
    paid: paidApplicationIds.size,
  }
}

export function buildFunnel(
  applications: readonly MetricsApplication[],
  submissions: readonly MetricsSubmission[],
  payouts: readonly MetricsPayout[],
): FunnelSummary {
  // Submissions that point at an application outside this brand's set are ignored, so a
  // stage can never exceed the top of the funnel.
  const applicationIds = new Set(applications.map(application => application.id))
  const scopedSubmissions = submissions.filter(submission => applicationIds.has(submission.applicationId))
  const stages = countStages(applications, scopedSubmissions, payouts)

  const definitions: Array<{ key: FunnelStepKey; label: string; hint: string; count: number }> = [
    { key: 'applied', label: 'Applications received', hint: 'Creators who pitched a campaign', count: stages.applied },
    { key: 'accepted', label: 'Accepted', hint: 'Pitches you approved to start work', count: stages.accepted },
    { key: 'submitted', label: 'Content submitted', hint: 'Accepted creators who delivered', count: stages.submitted },
    { key: 'approved', label: 'Content approved', hint: 'Deliveries you signed off on', count: stages.approved },
    { key: 'paid', label: 'Paid out', hint: 'Creators whose transfer completed', count: stages.paid },
  ]

  const top = stages.applied
  const steps = definitions.map((definition, index) => {
    const previous = index === 0 ? null : definitions[index - 1]
    return {
      ...definition,
      shareOfTop: ratio(definition.count, top),
      conversionFromPrevious: previous ? ratio(definition.count, previous.count) : null,
      previousLabel: previous ? previous.label : null,
    }
  })

  return {
    steps,
    submissionRowCount: scopedSubmissions.length,
    approvedSubmissionRowCount: countWhere(scopedSubmissions, submission => submission.status === 'APPROVED'),
  }
}

/* ----------------------------------------------------------------- rates -- */

export interface ApplicationRates {
  total: number
  pending: number
  accepted: number
  rejected: number
  acceptanceRate: number | null
  rejectionRate: number | null
  pendingRate: number | null
}

export function computeApplicationRates(applications: readonly MetricsApplication[]): ApplicationRates {
  const total = applications.length
  const pending = countWhere(applications, application => application.status === 'PENDING')
  const accepted = countWhere(applications, application => application.status === 'ACCEPTED')
  const rejected = countWhere(applications, application => application.status === 'REJECTED')

  return {
    total,
    pending,
    accepted,
    rejected,
    acceptanceRate: ratio(accepted, total),
    rejectionRate: ratio(rejected, total),
    pendingRate: ratio(pending, total),
  }
}

export interface SubmissionRates {
  total: number
  pending: number
  approved: number
  revisionRequested: number
  rejected: number
  approvalRate: number | null
  revisionRequestRate: number | null
  rejectionRate: number | null
  pendingRate: number | null
}

export function computeSubmissionRates(submissions: readonly MetricsSubmission[]): SubmissionRates {
  const total = submissions.length
  const pending = countWhere(submissions, submission => submission.status === 'PENDING')
  const approved = countWhere(submissions, submission => submission.status === 'APPROVED')
  const revisionRequested = countWhere(submissions, submission => submission.status === 'REVISION_REQUESTED')
  const rejected = countWhere(submissions, submission => submission.status === 'REJECTED')

  return {
    total,
    pending,
    approved,
    revisionRequested,
    rejected,
    approvalRate: ratio(approved, total),
    revisionRequestRate: ratio(revisionRequested, total),
    rejectionRate: ratio(rejected, total),
    pendingRate: ratio(pending, total),
  }
}

/* ----------------------------------------------------------------- spend -- */

export interface SpendMetrics {
  realizedCents: number
  committedCents: number
  outstandingCents: number
  platformFeesCents: number
  inFlightCents: number
  inFlightCount: number
  paidPayoutCount: number
  failedPayoutCount: number
  failedPayoutCents: number
  totalBudgetCents: number
  budgetUtilization: number | null
  acceptedApplications: number
  distinctAcceptedCreators: number
  avgCostPerAcceptedCreatorCents: number | null
}

export function computeSpend(
  campaigns: readonly MetricsCampaign[],
  applications: readonly MetricsApplication[],
  payouts: readonly MetricsPayout[],
): SpendMetrics {
  const paid = payouts.filter(payout => payout.status === 'PAID')
  const failed = payouts.filter(payout => payout.status === 'FAILED')
  const inFlight = payouts.filter(payout => payout.status === 'PENDING' || payout.status === 'PROCESSING')

  const acceptedApplications = applications.filter(application => application.status === 'ACCEPTED')
  const realizedCents = sumBy(paid, payout => payout.amount)
  const committedCents = sumBy(acceptedApplications, application => application.proposedRate)
  const totalBudgetCents = sumBy(campaigns, campaign => campaign.budget)

  return {
    realizedCents,
    committedCents,
    // An application can be accepted, paid, then flipped back to REJECTED (status is
    // mutable), which would make a raw subtraction negative. Outstanding obligation
    // can never be less than zero, so it floors at zero.
    outstandingCents: Math.max(0, committedCents - realizedCents),
    platformFeesCents: sumBy(paid, payout => payout.platformFee),
    inFlightCents: sumBy(inFlight, payout => payout.amount),
    inFlightCount: inFlight.length,
    paidPayoutCount: paid.length,
    failedPayoutCount: failed.length,
    failedPayoutCents: sumBy(failed, payout => payout.amount),
    totalBudgetCents,
    budgetUtilization: ratio(committedCents, totalBudgetCents),
    acceptedApplications: acceptedApplications.length,
    distinctAcceptedCreators: new Set(acceptedApplications.map(application => application.creatorId)).size,
    avgCostPerAcceptedCreatorCents:
      acceptedApplications.length > 0 ? Math.round(committedCents / acceptedApplications.length) : null,
  }
}

/* ------------------------------------------------------------- campaigns -- */

export interface CampaignMetrics {
  id: string
  title: string
  status: CampaignStatusValue
  statusLabel: string
  budgetCents: number
  creatorsNeeded: number | null
  applicationCount: number
  pendingCount: number
  acceptedCount: number
  rejectedCount: number
  committedCents: number
  realizedCents: number
  budgetUtilization: number | null
  fillRate: number | null
  isOverBudget: boolean
}

export function buildCampaignMetrics(
  campaigns: readonly MetricsCampaign[],
  applications: readonly MetricsApplication[],
  submissions: readonly MetricsSubmission[],
  payouts: readonly MetricsPayout[],
): CampaignMetrics[] {
  const applicationById = new Map(applications.map(application => [application.id, application]))
  const submissionById = new Map(submissions.map(submission => [submission.id, submission]))

  const realizedByCampaign = new Map<string, number>()
  for (const payout of payouts) {
    if (payout.status !== 'PAID') continue
    const submission = submissionById.get(payout.submissionId)
    if (!submission) continue
    const application = applicationById.get(submission.applicationId)
    if (!application) continue
    realizedByCampaign.set(
      application.campaignId,
      (realizedByCampaign.get(application.campaignId) ?? 0) + payout.amount,
    )
  }

  return campaigns.map(campaign => {
    const own = applications.filter(application => application.campaignId === campaign.id)
    const accepted = own.filter(application => application.status === 'ACCEPTED')
    const committedCents = sumBy(accepted, application => application.proposedRate)
    const budgetUtilization = ratio(committedCents, campaign.budget)

    return {
      id: campaign.id,
      title: campaign.title,
      status: campaign.status,
      statusLabel: CAMPAIGN_STATUS_LABEL[campaign.status] ?? campaign.status,
      budgetCents: campaign.budget,
      creatorsNeeded: campaign.creatorsNeeded,
      applicationCount: own.length,
      pendingCount: countWhere(own, application => application.status === 'PENDING'),
      acceptedCount: accepted.length,
      rejectedCount: countWhere(own, application => application.status === 'REJECTED'),
      committedCents,
      realizedCents: realizedByCampaign.get(campaign.id) ?? 0,
      budgetUtilization,
      // `creatorsNeeded` is optional on the model, and 0 is not a meaningful target.
      fillRate: campaign.creatorsNeeded ? ratio(accepted.length, campaign.creatorsNeeded) : null,
      isOverBudget: budgetUtilization !== null && budgetUtilization > 1,
    }
  })
}

export interface StatusSlice {
  status: CampaignStatusValue
  label: string
  count: number
  share: number | null
}

export function buildCampaignStatusMix(campaigns: readonly MetricsCampaign[]): StatusSlice[] {
  const total = campaigns.length

  return CAMPAIGN_STATUS_ORDER.map(status => ({
    status,
    count: countWhere(campaigns, campaign => campaign.status === status),
  }))
    .filter(slice => slice.count > 0)
    .map(slice => ({
      status: slice.status,
      label: CAMPAIGN_STATUS_LABEL[slice.status],
      count: slice.count,
      share: ratio(slice.count, total),
    }))
}

/* ------------------------------------------------------------ over time -- */

export interface DayBucket {
  key: string
  label: string
  count: number
}

export interface ApplicationTrend {
  days: DayBucket[]
  max: number
  thisWeek: number
  lastWeek: number
  trend: Trend
}

function dayKey(date: Date): string {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

function shortDateLabel(date: Date): string {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date)
}

// Buckets applications into the trailing `days` local calendar days, oldest first.
// Applications older than the window are intentionally excluded from the buckets.
export function buildApplicationTrend(
  applications: readonly MetricsApplication[],
  options: { now?: Date; days?: number } = {},
): ApplicationTrend {
  const days = Math.max(1, options.days ?? TREND_DAYS)
  const today = new Date(options.now ?? new Date())
  today.setHours(0, 0, 0, 0)

  const counts = new Map<string, number>()
  for (const application of applications) {
    const key = dayKey(new Date(application.createdAt))
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  const buckets: DayBucket[] = []
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(today.getTime() - offset * 24 * 60 * 60 * 1000)
    const key = dayKey(date)
    buckets.push({ key, label: shortDateLabel(date), count: counts.get(key) ?? 0 })
  }

  const half = Math.max(1, Math.floor(days / 2))
  const thisWeek = sumBy(buckets.slice(days - half), bucket => bucket.count)
  const lastWeek = sumBy(buckets.slice(days - half * 2, days - half), bucket => bucket.count)

  return {
    days: buckets,
    max: Math.max(1, ...buckets.map(bucket => bucket.count)),
    thisWeek,
    lastWeek,
    trend: compareToLastWeek(thisWeek, lastWeek),
  }
}

/* --------------------------------------------------------------- summary -- */

export interface AttentionMetrics {
  pendingApplications: number
  submissionsAwaitingReview: number
  revisionsRequested: number
  failedPayouts: number
  failedPayoutCents: number
  total: number
}

export function buildAttention(
  applications: readonly MetricsApplication[],
  submissions: readonly MetricsSubmission[],
  payouts: readonly MetricsPayout[],
): AttentionMetrics {
  const pendingApplications = countWhere(applications, application => application.status === 'PENDING')
  const submissionsAwaitingReview = countWhere(submissions, submission => submission.status === 'PENDING')
  const revisionsRequested = countWhere(submissions, submission => submission.status === 'REVISION_REQUESTED')
  const failed = payouts.filter(payout => payout.status === 'FAILED')

  return {
    pendingApplications,
    submissionsAwaitingReview,
    revisionsRequested,
    failedPayouts: failed.length,
    failedPayoutCents: sumBy(failed, payout => payout.amount),
    total: pendingApplications + submissionsAwaitingReview + failed.length,
  }
}

export interface BrandMetrics {
  hasCampaigns: boolean
  hasApplications: boolean
  funnel: FunnelSummary
  applications: ApplicationRates
  submissions: SubmissionRates
  spend: SpendMetrics
  campaigns: CampaignMetrics[]
  statusMix: StatusSlice[]
  trend: ApplicationTrend
  attention: AttentionMetrics
}

export function buildBrandMetrics(input: BrandMetricsInput): BrandMetrics {
  const { campaigns, applications, submissions, payouts, now } = input

  return {
    hasCampaigns: campaigns.length > 0,
    hasApplications: applications.length > 0,
    funnel: buildFunnel(applications, submissions, payouts),
    applications: computeApplicationRates(applications),
    submissions: computeSubmissionRates(submissions),
    spend: computeSpend(campaigns, applications, payouts),
    campaigns: buildCampaignMetrics(campaigns, applications, submissions, payouts),
    statusMix: buildCampaignStatusMix(campaigns),
    trend: buildApplicationTrend(applications, { now }),
    attention: buildAttention(applications, submissions, payouts),
  }
}
