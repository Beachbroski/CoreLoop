'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { WaitlistStatusControl } from './WaitlistStatusControl'

type WaitlistStatus = 'NEW' | 'CONTACTED' | 'APPROVED' | 'INVITED'

export type AdminWaitlistSubmission = {
  id: string
  name: string | null
  email: string
  primaryPlatform: string | null
  handle: string | null
  niche: string | null
  followerRange: string | null
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

const statusOptions: Array<{ value: 'ALL' | WaitlistStatus; label: string }> = [
  { value: 'ALL', label: 'All statuses' },
  { value: 'NEW', label: 'New' },
  { value: 'CONTACTED', label: 'Contacted' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'INVITED', label: 'Invited' },
]

function profileSummary(submission: AdminWaitlistSubmission) {
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

export function AdminWaitlistDashboard({
  submissions,
  exportHref,
}: AdminWaitlistDashboardProps) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<'ALL' | WaitlistStatus>('ALL')
  const [profileFilter, setProfileFilter] = useState<'ALL' | 'COMPLETE' | 'INCOMPLETE'>('ALL')
  const [referralFilter, setReferralFilter] = useState<'ALL' | 'ONE_PLUS' | 'THREE_PLUS'>('ALL')
  const [copiedId, setCopiedId] = useState('')

  const metrics = useMemo(() => {
    const complete = submissions.filter(submission => submission.profileCompletedAt).length
    const totalReferrals = submissions.reduce((sum, submission) => sum + submission.referralCount, 0)
    const rewardCandidates = submissions.filter(submission => submission.referralCount >= 3).length

    return {
      total: submissions.length,
      complete,
      incomplete: submissions.length - complete,
      totalReferrals,
      rewardCandidates,
    }
  }, [submissions])

  const newestSubmissions = submissions.slice(0, 5)

  const filteredSubmissions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    return submissions.filter(submission => {
      const searchableText = [
        submission.name,
        submission.email,
        submission.handle,
        submission.niche,
        submission.primaryPlatform,
        submission.referralCode,
        submission.referredBy?.name,
        submission.referredBy?.referralCode,
      ].filter(Boolean).join(' ').toLowerCase()

      if (normalizedQuery && !searchableText.includes(normalizedQuery)) return false
      if (status !== 'ALL' && submission.status !== status) return false
      if (profileFilter === 'COMPLETE' && !submission.profileCompletedAt) return false
      if (profileFilter === 'INCOMPLETE' && submission.profileCompletedAt) return false
      if (referralFilter === 'ONE_PLUS' && submission.referralCount < 1) return false
      if (referralFilter === 'THREE_PLUS' && submission.referralCount < 3) return false

      return true
    })
  }, [profileFilter, query, referralFilter, status, submissions])

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
          <p className="metric-label">Creators on the waitlist</p>
        </article>
        <article className="metric-card">
          <p className="metric-value">{metrics.complete}</p>
          <p className="metric-label">Completed profiles</p>
        </article>
        <article className="metric-card">
          <p className="metric-value">{metrics.incomplete}</p>
          <p className="metric-label">Email-only leads</p>
        </article>
        <article className="metric-card">
          <p className="metric-value">{metrics.totalReferrals}</p>
          <p className="metric-label">Tracked referrals</p>
        </article>
        <article className="metric-card">
          <p className="metric-value">{metrics.rewardCandidates}</p>
          <p className="metric-label">3+ referral candidates</p>
        </article>
      </section>

      <section className="dashboard-panel">
        <div className="section-header">
          <div className="section-header-copy">
            <h2 style={{ margin: 0 }}>Newest leads</h2>
            <p className="page-copy" style={{ margin: '8px 0 0' }}>
              Fast scan of the most recent creator activity.
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
              Search, filter, copy referral links, export, and move creator leads through the invite pipeline.
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
          <div className="waitlist-admin-grid">
            {filteredSubmissions.map(submission => (
              <article key={submission.id} className="dashboard-panel waitlist-admin-card">
                <div className="section-header">
                  <div className="section-header-copy">
                    <h3 style={{ margin: 0 }}>{submission.name || 'Creator lead'}</h3>
                    <p className="page-copy" style={{ margin: '8px 0 0' }}>
                      {submission.email}
                    </p>
                  </div>
                  <div className="section-header-action">
                    <WaitlistStatusControl submissionId={submission.id} initialStatus={submission.status} />
                  </div>
                </div>

                <div className="waitlist-meta-grid">
                  <div>
                    <p className="sidebar-label" style={{ margin: '0 0 6px' }}>Creator profile</p>
                    <p className="page-copy" style={{ margin: 0 }}>{profileSummary(submission)}</p>
                  </div>
                  <div>
                    <p className="sidebar-label" style={{ margin: '0 0 6px' }}>Referral code</p>
                    <p className="page-copy" style={{ margin: 0, fontWeight: 600, color: 'var(--text)' }}>
                      {submission.referralCode}
                    </p>
                  </div>
                  <div>
                    <p className="sidebar-label" style={{ margin: '0 0 6px' }}>Referred by</p>
                    <p className="page-copy" style={{ margin: 0 }}>
                      {submission.referredBy
                        ? `${submission.referredBy.name || 'Creator lead'} (${submission.referredBy.referralCode})`
                        : 'Direct signup'}
                    </p>
                  </div>
                  <div>
                    <p className="sidebar-label" style={{ margin: '0 0 6px' }}>Referral count</p>
                    <p className="page-copy" style={{ margin: 0 }}>{submission.referralCount}</p>
                  </div>
                  <div>
                    <p className="sidebar-label" style={{ margin: '0 0 6px' }}>Profile status</p>
                    <p className="page-copy" style={{ margin: 0 }}>
                      {submission.profileCompletedAt ? 'Complete' : 'Email-only'}
                    </p>
                  </div>
                  <div>
                    <p className="sidebar-label" style={{ margin: '0 0 6px' }}>Joined</p>
                    <p className="page-copy" style={{ margin: 0 }}>{formatDate(submission.createdAt)}</p>
                  </div>
                </div>

                <div className="admin-card-actions">
                  <button
                    type="button"
                    className="apple-btn-ghost"
                    onClick={() => copyReferralLink(submission)}
                  >
                    {copiedId === submission.id ? 'Copied' : 'Copy referral link'}
                  </button>
                  <a href={submission.referralLink} className="apple-btn-ghost">
                    Open referral link
                  </a>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  )
}
