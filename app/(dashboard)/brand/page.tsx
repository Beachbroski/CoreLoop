import Link from 'next/link'
import type { Application, Campaign } from '@prisma/client'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import prisma from '@/lib/prisma'
import { formatCents } from '@/lib/utils'

const STATUS: Record<string, { bg: string; color: string; label: string }> = {
  DRAFT: { bg: 'rgba(15,23,42,0.06)', color: 'var(--text-soft)', label: 'Draft' },
  ACTIVE: { bg: 'var(--accent-soft)', color: 'var(--accent)', label: 'Active' },
  IN_PROGRESS: { bg: 'var(--success-soft)', color: 'var(--success)', label: 'In progress' },
  COMPLETE: { bg: 'rgba(15,23,42,0.06)', color: 'var(--text-soft)', label: 'Complete' },
  CANCELLED: { bg: 'var(--danger-soft)', color: 'var(--danger)', label: 'Cancelled' },
}

type CampaignWithApplications = Campaign & { applications: Application[] }

async function BrandDashboardContent() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const user = await prisma.user.findUnique({ where: { clerkId: userId } })
  if (!user) redirect('/onboarding')

  const campaigns: CampaignWithApplications[] = await prisma.campaign.findMany({
    where: { brandId: user.id },
    include: { applications: true },
    orderBy: { createdAt: 'desc' },
  })

  const totalApplications = campaigns.reduce(
    (sum: number, campaign: CampaignWithApplications) => sum + campaign.applications.length,
    0,
  )
  const totalSpent = await prisma.payout.aggregate({
    where: {
      creator: {
        id: {
          in: campaigns.flatMap((campaign: CampaignWithApplications) =>
            campaign.applications.map(app => app.creatorId),
          ),
        },
      },
    },
    _sum: { amount: true },
  })

  const stats = [
    { label: 'Campaigns launched', value: String(campaigns.length) },
    { label: 'Applications received', value: String(totalApplications) },
    { label: 'Total creator spend', value: formatCents(totalSpent._sum.amount ?? 0) },
  ]

  return (
    <div className="subtle-grid" style={{ gap: 26 }}>
      <div className="page-header">
        <div>
          <p style={{ margin: '0 0 8px', color: 'var(--text-faint)', fontSize: '.82rem', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' }}>
            Brand dashboard
          </p>
          <h1 className="page-title" style={{ marginBottom: 10 }}>Build campaigns people want to reply to.</h1>
          <p className="page-copy" style={{ margin: 0, maxWidth: 720 }}>
            Keep the top of funnel moving, spot strong creator fit early, and manage every live brief in one clean system.
          </p>
        </div>
        <Link href="/brand/campaigns/new" className="apple-btn">New campaign</Link>
      </div>

      <div className="subtle-grid three-col">
        {stats.map(stat => (
          <div key={stat.label} className="metric-card">
            <p className="metric-value">{stat.value}</p>
            <p className="metric-label">{stat.label}</p>
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
              <Link href="/brand/campaigns/new" className="apple-btn">Post a campaign</Link>
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
          <div>
            <h2 style={{ margin: '0 0 8px' }}>What makes a campaign convert</h2>
            <p style={{ margin: 0, color: 'var(--text-soft)' }}>
              Better briefs feel more concrete, more trustworthy, and easier to imagine creating for.
            </p>
          </div>
          <div className="subtle-grid">
            {[
              'Lead with an outcome, not just a product mention.',
              'Use realistic budgets so creators self-select faster.',
              'Give each brief a clean deadline and a narrow ask instead of six optional deliverables.',
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

function DashboardSkeleton() {
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

export default function BrandDashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <BrandDashboardContent />
    </Suspense>
  )
}
