'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { compareToLastWeek } from '@/lib/utils'
import { WaitlistStatusControl } from './WaitlistStatusControl'

type WaitlistStatus = 'NEW' | 'CONTACTED' | 'APPROVED' | 'INVITED'

export type AdminWaitlistSubmission = {
  id: string
  leadType: 'CREATOR' | 'BUSINESS'
  name: string | null
  email: string
  primaryPlatform: string | null
  handle: string | null
  niche: string | null
  followerRange: string | null
  companyName: string | null
  companyType: string | null
  budgetRange: string | null
  industry: string | null
  referralCode: string
  referralLink: string
  referralCount: number
  status: WaitlistStatus
  referredBy: { name: string | null; referralCode: string } | null
  profileCompletedAt: string | null
  createdAt: string
}

type AdminWaitlistDashboardProps = {
  submissions: AdminWaitlistSubmission[]
  exportHref: string
}

type SortKey = 'name' | 'referralCount' | 'status' | 'createdAt'
type SortDirection = 'asc' | 'desc'

const statusOptions: Array<{ value: 'ALL' | WaitlistStatus; label: string }> = [
  { value: 'ALL', label: 'All statuses' },
  { value: 'NEW', label: 'New' },
  { value: 'CONTACTED', label: 'Contacted' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'INVITED', label: 'Invited' },
]

const DEFAULT_SORT_DIRECTION: Record<SortKey, SortDirection> = {
  name: 'asc',
  referralCount: 'desc',
  status: 'asc',
  createdAt: 'desc',
}

function profileSummary(submission: AdminWaitlistSubmission) {
  if (submission.leadType === 'BUSINESS') {
    const parts = [
      submission.companyType,
      submission.industry,
      submission.budgetRange,
    ].filter(Boolean)

    return parts.length > 0 ? parts.join(' · ') : 'Business details pending.'
  }

  const parts = [
    submission.primaryPlatform,
    submission.handle,
    submission.niche,
    submission.followerRange,
  ].filter(Boolean)

  return parts.length > 0 ? parts.join(' · ') : 'Email captured. Creator details pending.'
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value))
}

function formatShortDate(value: Date) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(value)
}

function topEntries(counts: Map<string, number>, limit: number) {
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
}

export function AdminWaitlistDashboard({
  submissions,
  exportHref,
}: AdminWaitlistDashboardProps) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<'ALL' | WaitlistStatus>('ALL')
  const [leadTypeFilter, setLeadTypeFilter] = useState<'ALL' | 'CREATOR' | 'BUSINESS'>('ALL')
  const [profileFilter, setProfileFilter] = useState<'ALL' | 'COMPLETE' | 'INCOMPLETE'>('ALL')
  const [referralFilter, setReferralFilter] = useState<'ALL' | 'ONE_PLUS' | 'THREE_PLUS'>('ALL')
  const [copiedId, setCopiedId] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('createdAt')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  const metrics = useMemo(() => {
    const complete = submissions.filter(submission => submission.profileCompletedAt).length
    const creatorLeads = submissions.filter(submission => submission.leadType === 'CREATOR').length
    const businessLeads = submissions.filter(submission => submission.leadType === 'BUSINESS').length
    const totalReferrals = submissions.reduce((sum, submission) => sum + submission.referralCount, 0)
    const rewardCandidates = submissions.filter(submission => submission.referralCount >= 3).length

    return {
      total: submissions.length,
      complete,
      creatorLeads,
      businessLeads,
      incomplete: submissions.length - complete,
      totalReferrals,
      rewardCandidates,
    }
  }, [submissions])

  const signupTrend = useMemo(() => {
    const days: { date: Date; label: string; count: number }[] = []
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    for (let i = 13; i >= 0; i -= 1) {
      const date = new Date(today.getTime() - i * 24 * 60 * 60 * 1000)
      days.push({ date, label: formatShortDate(date), count: 0 })
    }

    for (const submission of submissions) {
      const createdAt = new Date(submission.createdAt)
      createdAt.setHours(0, 0, 0, 0)
      const bucket = days.find(day => day.date.getTime() === createdAt.getTime())
      if (bucket) bucket.count += 1
    }

    const max = Math.max(1, ...days.map(day => day.count))
    const scaleMax = Math.max(4, max)
    const thisWeek = days.slice(7, 14).reduce((sum, day) => sum + day.count, 0)
    const lastWeek = days.slice(0, 7).reduce((sum, day) => sum + day.count, 0)

    return { days, scaleMax, thisWeek, lastWeek }
  }, [submissions])

  const topReferrers = useMemo(() => {
    return submissions
      .filter(submission => submission.referralCount > 0)
      .sort((a, b) => b.referralCount - a.referralCount)
      .slice(0, 5)
  }, [submissions])

  const breakdowns = useMemo(() => {
    function countBy(pick: (submission: AdminWaitlistSubmission) => string | null) {
      const counts = new Map<string, number>()
      for (const submission of submissions) {
        const value = pick(submission)
        if (!value) continue
        counts.set(value, (counts.get(value) ?? 0) + 1)
      }
      return topEntries(counts, 6)
    }

    return {
      platform: countBy(submission => submission.primaryPlatform),
      niche: countBy(submission => submission.niche),
      followerRange: countBy(submission => submission.followerRange),
    }
  }, [submissions])

  const newestSubmissions = submissions.slice(0, 5)

  const filteredSubmissions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    const filtered = submissions.filter(submission => {
      const searchableText = [
        submission.name,
        submission.email,
        submission.handle,
        submission.niche,
        submission.primaryPlatform,
        submission.companyName,
        submission.companyType,
        submission.budgetRange,
        submission.industry,
        submission.referralCode,
        submission.referredBy?.name,
        submission.referredBy?.referralCode,
      ].filter(Boolean).join(' ').toLowerCase()

      if (normalizedQuery && !searchableText.includes(normalizedQuery)) return false
      if (status !== 'ALL' && submission.status !== status) return false
      if (leadTypeFilter !== 'ALL' && submission.leadType !== leadTypeFilter) return false
      if (profileFilter === 'COMPLETE' && !submission.profileCompletedAt) return false
      if (profileFilter === 'INCOMPLETE' && submission.profileCompletedAt) return false
      if (referralFilter === 'ONE_PLUS' && submission.referralCount < 1) return false
      if (referralFilter === 'THREE_PLUS' && submission.referralCount < 3) return false

      return true
    })

    const direction = sortDirection === 'asc' ? 1 : -1
    return filtered.sort((a, b) => {
      switch (sortKey) {
        case 'name':
          return direction * (a.name || a.email).localeCompare(b.name || b.email)
        case 'referralCount':
          return direction * (a.referralCount - b.referralCount)
        case 'status':
          return direction * a.status.localeCompare(b.status)
        case 'createdAt':
        default:
          return direction * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      }
    })
  }, [leadTypeFilter, profileFilter, query, referralFilter, sortDirection, sortKey, status, submissions])

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDirection(direction => (direction === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDirection(DEFAULT_SORT_DIRECTION[key])
    }
  }

  function sortIndicator(key: SortKey) {
    if (key !== sortKey) return ''
    return sortDirection === 'asc' ? ' ↑' : ' ↓'
  }

  async function copyReferralLink(submission: AdminWaitlistSubmission) {
    try {
      await navigator.clipboard.writeText(submission.referralLink)
      setCopiedId(submission.id)
      window.setTimeout(() => setCopiedId(''), 1600)
    } catch {
      setCopiedId('')
    }
  }

  return (
    <section className="subtle-grid spacing-xl">
      <section className="admin-metric-grid">
        <article className="metric-card">
          <p className="metric-value">{metrics.total}</p>
          <p className="metric-label">Total waitlist leads</p>
          {(() => {
            const trend = compareToLastWeek(signupTrend.thisWeek, signupTrend.lastWeek)
            return (
              <p className={`metric-trend metric-trend-${trend.direction}`}>
                {trend.direction === 'up' ? '↑' : trend.direction === 'down' ? '↓' : '→'} {trend.label}
              </p>
            )
          })()}
        </article>
        <article className="metric-card">
          <p className="metric-value">{metrics.creatorLeads}</p>
          <p className="metric-label">Creator leads</p>
        </article>
        <article className="metric-card">
          <p className="metric-value">{metrics.businessLeads}</p>
          <p className="metric-label">Business leads</p>
        </article>
        <article className="metric-card">
          <p className="metric-value">{metrics.complete}</p>
          <p className="metric-label">Completed profiles</p>
        </article>
        <article className="metric-card">
          <p className="metric-value">{metrics.rewardCandidates}</p>
          <p className="metric-label">3+ referral candidates</p>
        </article>
      </section>

      <div className="subtle-grid two-col">
        <section className="dashboard-panel">
          <div className="section-header">
            <div className="section-header-copy">
              <h2 style={{ margin: 0 }}>Signups, last 14 days</h2>
              <p className="page-copy" style={{ margin: '8px 0 0' }}>
                {signupTrend.thisWeek} this week vs {signupTrend.lastWeek} the week before.
              </p>
            </div>
          </div>
          <div className="admin-trend-chart" aria-label="Waitlist signups for the last 14 days">
            {signupTrend.days.map(day => {
              const height = day.count === 0
                ? 0
                : Math.max(18, (day.count / signupTrend.scaleMax) * 100)

              return (
                <div key={day.label} className="admin-trend-bar-col" title={`${day.label}: ${day.count}`}>
                  <span className="admin-trend-count">{day.count || ''}</span>
                  <div className="admin-trend-bar-track">
                    <div
                      className={`admin-trend-bar ${day.count === 0 ? 'admin-trend-bar-empty' : ''}`}
                      style={{ height: `${height}%` }}
                    />
                  </div>
                  <span className="admin-trend-bar-label">{day.label}</span>
                </div>
              )
            })}
          </div>
        </section>

        <section className="dashboard-panel">
          <div className="section-header">
            <div className="section-header-copy">
              <h2 style={{ margin: 0 }}>Top referrers</h2>
              <p className="page-copy" style={{ margin: '8px 0 0' }}>
                Who&apos;s actually driving signups.
              </p>
            </div>
          </div>
          {topReferrers.length === 0 ? (
            <p className="page-copy" style={{ margin: 0 }}>No referrals tracked yet.</p>
          ) : (
            <div className="subtle-grid" style={{ gap: 10 }}>
              {topReferrers.map((submission, index) => (
                <div key={submission.id} className="list-row">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className="pill" style={{ minWidth: 28, justifyContent: 'center' }}>{index + 1}</span>
                    <span style={{ fontWeight: 600 }}>{submission.name || submission.email}</span>
                  </div>
                  <span className="status-pill" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
                    {submission.referralCount} referral{submission.referralCount === 1 ? '' : 's'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="dashboard-panel">
        <div className="section-header">
          <div className="section-header-copy">
            <h2 style={{ margin: 0 }}>Creator profile breakdown</h2>
            <p className="page-copy" style={{ margin: '8px 0 0' }}>
              Where the waitlist skews by platform, niche, and audience size.
            </p>
          </div>
        </div>
        <div className="subtle-grid three-col">
          {(['platform', 'niche', 'followerRange'] as const).map(key => {
            const rows = breakdowns[key]
            const max = Math.max(1, ...rows.map(([, count]) => count))
            const heading = key === 'platform' ? 'Platform' : key === 'niche' ? 'Niche' : 'Follower range'

            return (
              <div key={key}>
                <p className="sidebar-label" style={{ margin: '0 0 10px' }}>{heading}</p>
                {rows.length === 0 ? (
                  <p className="page-copy" style={{ margin: 0, fontSize: '.9rem' }}>No data yet.</p>
                ) : (
                  <div className="subtle-grid" style={{ gap: 8 }}>
                    {rows.map(([label, count]) => (
                      <div key={label}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.85rem', marginBottom: 3 }}>
                          <span>{label}</span>
                          <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--text-soft)' }}>{count}</span>
                        </div>
                        <div className="admin-breakdown-track">
                          <div className="admin-breakdown-fill" style={{ width: `${(count / max) * 100}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>

      <section className="dashboard-panel">
        <div className="section-header">
          <div className="section-header-copy">
            <h2 style={{ margin: 0 }}>Newest leads</h2>
            <p className="page-copy" style={{ margin: '8px 0 0' }}>
              Fast scan of the most recent creator and business activity.
            </p>
          </div>
          <div className="section-header-action">
            <Link href={exportHref} className="apple-btn-ghost">Export CSV</Link>
          </div>
        </div>

        {newestSubmissions.length === 0 ? (
          <p className="page-copy" style={{ margin: 0 }}>No leads yet.</p>
        ) : (
          <div className="admin-newest-grid">
            {newestSubmissions.map(submission => (
              <article key={submission.id} className="admin-newest-card">
                <p style={{ margin: 0, fontWeight: 700 }}>{submission.name || submission.email}</p>
                <p className="page-copy" style={{ margin: '6px 0 0' }}>
                  {submission.leadType === 'BUSINESS' ? submission.companyName || submission.email : submission.name || submission.email}
                </p>
                <p className="page-copy" style={{ margin: '6px 0 0' }}>
                  {submission.profileCompletedAt ? profileSummary(submission) : 'Email saved. Details pending.'}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="dashboard-panel">
        <div className="section-header">
          <div className="section-header-copy">
            <h2 style={{ margin: 0 }}>Waitlist submissions</h2>
            <p className="page-copy" style={{ margin: '8px 0 0' }}>
              Search, filter, sort, copy referral links, export, and move creator or business leads through the invite pipeline.
            </p>
          </div>
          <div className="section-header-action">
            <p className="pill">{filteredSubmissions.length} shown</p>
          </div>
        </div>

        <div className="admin-filter-grid">
          <label>
            <span className="field-label">Search</span>
            <input
              className="apple-input"
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Email, handle, niche, referral code"
            />
          </label>

          <label>
            <span className="field-label">Status</span>
            <select
              className="apple-select"
              value={status}
              onChange={event => setStatus(event.target.value as 'ALL' | WaitlistStatus)}
            >
              {statusOptions.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>

          <label>
            <span className="field-label">Lead type</span>
            <select
              className="apple-select"
              value={leadTypeFilter}
              onChange={event => setLeadTypeFilter(event.target.value as 'ALL' | 'CREATOR' | 'BUSINESS')}
            >
              <option value="ALL">All leads</option>
              <option value="CREATOR">Creators</option>
              <option value="BUSINESS">Businesses</option>
            </select>
          </label>

          <label>
            <span className="field-label">Profile</span>
            <select
              className="apple-select"
              value={profileFilter}
              onChange={event => setProfileFilter(event.target.value as 'ALL' | 'COMPLETE' | 'INCOMPLETE')}
            >
              <option value="ALL">All profiles</option>
              <option value="COMPLETE">Completed</option>
              <option value="INCOMPLETE">Email-only</option>
            </select>
          </label>

          <label>
            <span className="field-label">Referrals</span>
            <select
              className="apple-select"
              value={referralFilter}
              onChange={event => setReferralFilter(event.target.value as 'ALL' | 'ONE_PLUS' | 'THREE_PLUS')}
            >
              <option value="ALL">Any count</option>
              <option value="ONE_PLUS">1+ referrals</option>
              <option value="THREE_PLUS">3+ referrals</option>
            </select>
          </label>
        </div>

        {filteredSubmissions.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon" />
            <h3 style={{ margin: '0 0 8px' }}>No matching submissions</h3>
            <p className="page-copy" style={{ margin: 0 }}>
              Clear a filter or wait for more creator leads to come in.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="waitlist-table">
              <thead>
                <tr>
                  <th>
                    <button type="button" className="waitlist-table-sort" onClick={() => toggleSort('name')}>
                      Lead{sortIndicator('name')}
                    </button>
                  </th>
                  <th>Profile</th>
                  <th>Referred by</th>
                  <th>
                    <button type="button" className="waitlist-table-sort" onClick={() => toggleSort('referralCount')}>
                      Referrals{sortIndicator('referralCount')}
                    </button>
                  </th>
                  <th>
                    <button type="button" className="waitlist-table-sort" onClick={() => toggleSort('status')}>
                      Status{sortIndicator('status')}
                    </button>
                  </th>
                  <th>
                    <button type="button" className="waitlist-table-sort" onClick={() => toggleSort('createdAt')}>
                      Joined{sortIndicator('createdAt')}
                    </button>
                  </th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSubmissions.map(submission => (
                  <tr key={submission.id}>
                    <td>
                      <p style={{ margin: 0, fontWeight: 600 }}>
                        {submission.leadType === 'BUSINESS'
                          ? submission.companyName || 'Business lead'
                          : submission.name || 'Creator lead'}
                      </p>
                      <p style={{ margin: '2px 0 0', color: 'var(--text-soft)', fontSize: '.85rem' }}>{submission.email}</p>
                    </td>
                    <td style={{ color: 'var(--text-soft)', fontSize: '.9rem' }}>{profileSummary(submission)}</td>
                    <td style={{ color: 'var(--text-soft)', fontSize: '.9rem' }}>
                      {submission.leadType === 'BUSINESS'
                        ? 'Business lead'
                        : submission.referredBy
                        ? `${submission.referredBy.name || 'Creator lead'} (${submission.referredBy.referralCode})`
                        : 'Direct signup'}
                    </td>
                    <td style={{ fontVariantNumeric: 'tabular-nums' }}>{submission.referralCount}</td>
                    <td>
                      <WaitlistStatusControl submissionId={submission.id} initialStatus={submission.status} />
                    </td>
                    <td style={{ color: 'var(--text-soft)', fontSize: '.9rem', whiteSpace: 'nowrap' }}>
                      {formatDate(submission.createdAt)}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="apple-btn-ghost"
                        style={{ whiteSpace: 'nowrap' }}
                        onClick={() => copyReferralLink(submission)}
                      >
                        {copiedId === submission.id ? 'Copied' : 'Copy link'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  )
}
