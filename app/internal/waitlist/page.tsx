import Link from 'next/link'
import { UserButton } from '@clerk/nextjs'
import { redirect } from 'next/navigation'
import prisma from '@/lib/prisma'
import { getCurrentAppUser } from '@/lib/current-app-user'
import { WaitlistStatusControl } from './WaitlistStatusControl'

function formatDate(value: Date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(value)
}

function creatorProfileSummary(submission: {
  primaryPlatform: string | null
  handle: string | null
  niche: string | null
  followerRange: string | null
}) {
  const parts = [
    submission.primaryPlatform,
    submission.handle,
    submission.niche,
    submission.followerRange,
  ].filter(Boolean)

  return parts.length > 0 ? parts.join(' · ') : 'Email captured. Creator details pending.'
}

export default async function InternalWaitlistPage() {
  const { userId, user } = await getCurrentAppUser()
  if (!userId) redirect('/sign-in')

  if (!user) redirect('/waitlist')
  if (user.role !== 'ADMIN') redirect('/waitlist')

  const submissions = await prisma.waitlistSubmission.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      referredBy: {
        select: { id: true, name: true, referralCode: true },
      },
      _count: {
        select: { referrals: true },
      },
    },
  })

  const homeHref = '/internal/waitlist'
  const totalReferrals = submissions.reduce((sum, submission) => sum + submission._count.referrals, 0)
  const invitedCount = submissions.filter(submission => submission.status === 'INVITED').length

  return (
    <div>
      <nav className="apple-nav">
        <Link href={homeHref} className="brand-lockup">
          <span className="brand-mark" />
          <span className="brand-wordmark">CreatorDocks</span>
        </Link>
        <div className="nav-links">
          <Link href={homeHref} className="nav-link">Dashboard</Link>
          <Link href="/waitlist" className="nav-link">Public waitlist</Link>
          <Link href="/internal/waitlist/export" className="apple-btn-ghost">Export CSV</Link>
        </div>
      </nav>

      <main className="apple-shell" style={{ paddingTop: 28, paddingBottom: 60 }}>
        <section className="subtle-grid spacing-xl">
          <header className="page-header">
            <div className="page-header-copy">
              <span className="eyebrow">Internal waitlist ops</span>
              <h1 className="page-title" style={{ marginTop: 18, marginBottom: 12 }}>
                Review CreatorDocks creator leads and referral momentum.
              </h1>
              <p className="page-copy" style={{ margin: 0 }}>
                This route stays off the public nav. Use it to triage creator intake, track referrals, and decide who gets invited into testing first.
              </p>
            </div>
            <div className="page-header-action">
              <Link href="/waitlist" className="apple-btn">View public page</Link>
            </div>
          </header>

          <section className="three-col">
            <article className="metric-card">
              <p className="metric-value">{submissions.length}</p>
              <p className="metric-label">Creators on the waitlist</p>
            </article>
            <article className="metric-card">
              <p className="metric-value">{totalReferrals}</p>
              <p className="metric-label">Tracked referrals</p>
            </article>
            <article className="metric-card">
              <p className="metric-value">{invitedCount}</p>
              <p className="metric-label">Invites marked sent</p>
            </article>
          </section>

          <section className="dashboard-panel">
            <div className="section-header">
              <div className="section-header-copy">
                <h2 style={{ margin: 0 }}>Waitlist submissions</h2>
                <p className="page-copy" style={{ margin: '8px 0 0' }}>
                  Each creator gets a unique referral code. Reward fulfillment still stays manual even though the relationships are tracked here.
                </p>
              </div>
              <div className="section-header-action">
                <div className="admin-user-menu">
                  <span className="pill">Admin: {user.email}</span>
                  <UserButton appearance={{ elements: { avatarBox: 'w-10 h-10' } }} />
                </div>
              </div>
            </div>

            {submissions.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon" />
                <h3 style={{ margin: '0 0 8px' }}>No waitlist submissions yet</h3>
                <p className="page-copy" style={{ margin: 0 }}>
                  Once the public waitlist starts converting, the creator roster will appear here.
                </p>
              </div>
            ) : (
              <div className="waitlist-admin-grid">
                {submissions.map(submission => (
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
                        <p className="page-copy" style={{ margin: 0 }}>
                          {creatorProfileSummary(submission)}
                        </p>
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
                        <p className="page-copy" style={{ margin: 0 }}>{submission._count.referrals}</p>
                      </div>
                      <div>
                        <p className="sidebar-label" style={{ margin: '0 0 6px' }}>Joined</p>
                        <p className="page-copy" style={{ margin: 0 }}>{formatDate(submission.createdAt)}</p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </section>
      </main>
    </div>
  )
}
