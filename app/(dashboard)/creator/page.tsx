import { Suspense } from 'react'
import Link from 'next/link'
import type { Application } from '@prisma/client'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import prisma from '@/lib/prisma'
import { formatCents } from '@/lib/utils'

const APP_STATUS: Record<string, { bg: string; color: string; label: string }> = {
  PENDING: { bg: 'var(--warning-soft)', color: 'var(--warning)', label: 'Pending' },
  ACCEPTED: { bg: 'var(--success-soft)', color: 'var(--success)', label: 'Accepted' },
  REJECTED: { bg: 'var(--danger-soft)', color: 'var(--danger)', label: 'Rejected' },
}

type CreatorDashboardApplication = Application & {
  campaign: { title: string }
}

async function CreatorDashboardContent() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const user = await prisma.user.findUnique({ where: { clerkId: userId } })
  if (!user) redirect('/onboarding')

  const [applications, totalApplications, accepted, totalEarned] = await Promise.all([
    prisma.application.findMany({
      where: { creatorId: user.id },
      include: { campaign: { select: { title: true } } },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }) as Promise<CreatorDashboardApplication[]>,
    prisma.application.count({ where: { creatorId: user.id } }),
    prisma.application.count({ where: { creatorId: user.id, status: 'ACCEPTED' } }),
    prisma.payout.aggregate({
      where: { creatorId: user.id, status: 'PAID' },
      _sum: { amount: true },
    }),
  ])

  const stats = [
    { label: 'Applications submitted', value: String(totalApplications) },
    { label: 'Accepted this cycle', value: String(accepted) },
    { label: 'Total earned', value: formatCents(totalEarned._sum.amount ?? 0) },
  ]

  return (
    <div className="subtle-grid" style={{ gap: 26 }}>
      <div className="page-header">
        <div className="page-header-copy">
          <p style={{ margin: '0 0 8px', color: 'var(--text-faint)', fontSize: '.82rem', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' }}>
            Creator dashboard
          </p>
          <h1 className="page-title" style={{ marginBottom: 10 }}>Welcome back, {user.name ?? 'Creator'}.</h1>
          <p className="page-copy" style={{ margin: 0, maxWidth: 680 }}>
            Keep your pipeline warm, stay on top of approvals, and make it easy for brands to say yes.
          </p>
        </div>
        <Link href="/creator/campaigns" className="apple-btn page-header-action">Browse campaigns</Link>
      </div>

      {!user.stripeOnboarded && (
        <div className="banner-warning split-row">
          <div>
            <p style={{ margin: '0 0 4px', fontWeight: 600 }}>Connect Stripe to unlock applications and payouts</p>
            <p style={{ margin: 0, color: 'var(--text-soft)', fontSize: '.95rem' }}>
              You’ll need a connected payout account before you can apply to live campaigns.
            </p>
          </div>
          <Link href="/creator/settings" className="apple-btn page-header-action">Set up payments</Link>
        </div>
      )}

      <div className="subtle-grid three-col">
        {stats.map(stat => (
          <div key={stat.label} className="metric-card">
            <p className="metric-value">{stat.value}</p>
            <p className="metric-label" style={{ maxWidth: 180 }}>{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="subtle-grid two-col">
        <section className="dashboard-panel">
          <div className="section-header">
            <div className="section-header-copy">
              <h2 style={{ margin: 0 }}>Recent applications</h2>
              <p style={{ margin: '6px 0 0', color: 'var(--text-soft)' }}>See what needs follow-up and where momentum is building.</p>
            </div>
            <Link href="/creator/applications" className="apple-link section-header-action">View all</Link>
          </div>

          {applications.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon" />
              <h3 style={{ margin: '0 0 8px' }}>No applications yet</h3>
              <p className="page-copy" style={{ margin: '0 0 18px' }}>
                Browse open campaigns and make your first pitch while the queue is still fresh.
              </p>
              <Link href="/creator/campaigns" className="apple-btn">Browse campaigns</Link>
            </div>
          ) : (
            <div>
              {applications.map((app: CreatorDashboardApplication) => {
                const status = APP_STATUS[app.status] ?? APP_STATUS.PENDING
                return (
                  <div key={app.id} className="list-row">
                    <div>
                      <p style={{ margin: '0 0 6px', fontWeight: 600 }}>{app.campaign.title}</p>
                      <p style={{ margin: 0, color: 'var(--text-soft)', fontSize: '.94rem' }}>
                        Proposed rate {formatCents(app.proposedRate)}
                      </p>
                    </div>
                    <span className="status-pill" style={{ background: status.bg, color: status.color }}>
                      {status.label}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        <section className="dashboard-panel">
          <div>
            <h2 style={{ margin: '0 0 8px' }}>How to get shortlisted faster</h2>
            <p style={{ margin: 0, color: 'var(--text-soft)' }}>
              The highest-converting creators make the next step obvious for brands.
            </p>
          </div>
          <div className="subtle-grid">
            {[
              'Lead with one sharp angle, not a generic “I’d love to work together.”',
              'Quote a rate that fits the brief instead of forcing the brand to negotiate from zero.',
              'Connect payouts early so approval feels safe and immediate.',
            ].map(item => (
              <div key={item} className="glass-card" style={{ boxShadow: 'var(--shadow-sm)' }}>
                <p style={{ margin: 0, lineHeight: 1.65 }}>{item}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
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
        {[0, 1, 2].map(i => <div className="shimmer" key={i} style={{ height: 140, borderRadius: 28 }} />)}
      </div>
      <div className="subtle-grid two-col">
        {[0, 1].map(i => <div className="shimmer" key={i} style={{ height: 360, borderRadius: 28 }} />)}
      </div>
    </div>
  )
}

export default function CreatorDashboardPage() {
  return (
    <Suspense fallback={<Skeleton />}>
      <CreatorDashboardContent />
    </Suspense>
  )
}
