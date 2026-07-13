import { Suspense } from 'react'
import type { Campaign } from '@prisma/client'
import prisma from '@/lib/prisma'
import { formatCents } from '@/lib/utils'
import { resolveDashboardViewer } from '@/lib/view-as'
import { AdminViewBanner } from '../../AdminViewBanner'
import { ApplyModal } from './ApplyModal'

const NICHES = ['Fashion', 'Beauty', 'Fitness', 'Gaming', 'Food', 'Tech', 'Lifestyle', 'Finance', 'Other']
const PLATFORMS = ['TikTok', 'Instagram', 'YouTube', 'X', 'Discord']

type CampaignFeedItem = Campaign & {
  brand: { name: string | null; avatarUrl: string | null }
  applications: { id: string }[]
}

function truncateText(value: string | null | undefined, maxLength: number) {
  if (!value) return null
  return value.length > maxLength ? `${value.slice(0, maxLength).trimEnd()}…` : value
}

async function CampaignFeedContent({
  niche,
  platform,
  viewAsId,
}: {
  niche?: string
  platform?: string
  viewAsId?: string
}) {
  const { viewer: user, isAdminViewing, readOnly, viewAsNotFound } = await resolveDashboardViewer('CREATOR', viewAsId)

  const campaigns: CampaignFeedItem[] = await prisma.campaign.findMany({
    where: {
      status: 'ACTIVE',
      ...(niche ? { niche } : {}),
      ...(platform ? { platforms: { has: platform } } : {}),
    },
    include: {
      brand: { select: { name: true, avatarUrl: true } },
      applications: { where: { creatorId: user.id }, select: { id: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  if (campaigns.length === 0) {
    return (
      <>
        {isAdminViewing && (
          <AdminViewBanner viewingAsName={user.name} viewingAsEmail={user.email} notFound={viewAsNotFound} />
        )}
        <div className="empty-state">
          <div className="empty-icon" />
          <h3 style={{ margin: '0 0 8px' }}>No campaigns match these filters</h3>
          <p className="page-copy" style={{ margin: 0 }}>Try broadening the niche or platform and check back for fresh briefs.</p>
        </div>
      </>
    )
  }

  return (
    <>
      {isAdminViewing && (
        <AdminViewBanner viewingAsName={user.name} viewingAsEmail={user.email} notFound={viewAsNotFound} />
      )}
      <div className="subtle-grid two-col">
      {campaigns.map((campaign: CampaignFeedItem) => {
        const alreadyApplied = campaign.applications.length > 0
        return (
          <article key={campaign.id} className="apple-card" style={{ display: 'grid', gap: 16 }}>
            <div className="split-row">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {campaign.brand.avatarUrl ? (
                  <img
                    src={campaign.brand.avatarUrl}
                    alt={campaign.brand.name ?? 'Brand'}
                    style={{ width: 32, height: 32, borderRadius: 999, objectFit: 'cover' }}
                  />
                ) : (
                  <div className="brand-mark" style={{ width: 32, height: 32, borderRadius: 12 }} />
                )}
                <div>
                  <p style={{ margin: '0 0 3px', fontWeight: 600 }}>{campaign.brand.name ?? 'Brand'}</p>
                  <p style={{ margin: 0, color: 'var(--text-soft)', fontSize: '.9rem' }}>{campaign.niche}</p>
                </div>
              </div>
              <span className="pill">Due {new Date(campaign.deadline).toLocaleDateString()}</span>
            </div>

            <div>
              <h2 style={{ margin: '0 0 8px', fontSize: '1.45rem', letterSpacing: '-0.04em' }}>{campaign.title}</h2>
              <p
                className="page-copy"
                style={{
                  margin: 0,
                  display: '-webkit-box',
                  overflow: 'hidden',
                  WebkitBoxOrient: 'vertical',
                  WebkitLineClamp: 3,
                }}
              >
                {campaign.description}
              </p>
            </div>

            <div className="chip-row">
              {campaign.platforms.map(platformName => (
                <span key={platformName} className="platform-pill">{platformName}</span>
              ))}
              {campaign.creatorsNeeded ? (
                <span className="pill">
                  {campaign.creatorsNeeded} creator{campaign.creatorsNeeded === 1 ? '' : 's'} needed
                </span>
              ) : null}
            </div>

            {(campaign.objective || campaign.deliverables || campaign.callToAction || campaign.targetAudience || campaign.creatorRequirements || campaign.usageRights) && (
              <div className="subtle-grid" style={{ gap: 10 }}>
                {campaign.objective ? (
                  <div className="glass-card" style={{ boxShadow: 'var(--shadow-sm)', padding: '14px 16px' }}>
                    <p style={{ margin: '0 0 4px', color: 'var(--text-faint)', fontSize: '.78rem', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' }}>
                      Goal
                    </p>
                    <p style={{ margin: 0, color: 'var(--text)', lineHeight: 1.6 }}>
                      {truncateText(campaign.objective, 140)}
                    </p>
                  </div>
                ) : null}

                {campaign.deliverables ? (
                  <div className="glass-card" style={{ boxShadow: 'var(--shadow-sm)', padding: '14px 16px' }}>
                    <p style={{ margin: '0 0 4px', color: 'var(--text-faint)', fontSize: '.78rem', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' }}>
                      Deliverables
                    </p>
                    <p style={{ margin: 0, color: 'var(--text)', lineHeight: 1.6 }}>
                      {truncateText(campaign.deliverables, 160)}
                    </p>
                  </div>
                ) : null}

                {campaign.callToAction ? (
                  <div className="glass-card" style={{ boxShadow: 'var(--shadow-sm)', padding: '14px 16px' }}>
                    <p style={{ margin: '0 0 4px', color: 'var(--text-faint)', fontSize: '.78rem', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' }}>
                      CTA
                    </p>
                    <p style={{ margin: 0, color: 'var(--text)', lineHeight: 1.6 }}>
                      {truncateText(campaign.callToAction, 120)}
                    </p>
                  </div>
                ) : null}

                {campaign.targetAudience ? (
                  <div className="glass-card" style={{ boxShadow: 'var(--shadow-sm)', padding: '14px 16px' }}>
                    <p style={{ margin: '0 0 4px', color: 'var(--text-faint)', fontSize: '.78rem', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' }}>
                      Target audience
                    </p>
                    <p style={{ margin: 0, color: 'var(--text)', lineHeight: 1.6 }}>
                      {truncateText(campaign.targetAudience, 160)}
                    </p>
                  </div>
                ) : null}

                {campaign.creatorRequirements ? (
                  <div className="glass-card" style={{ boxShadow: 'var(--shadow-sm)', padding: '14px 16px' }}>
                    <p style={{ margin: '0 0 4px', color: 'var(--text-faint)', fontSize: '.78rem', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' }}>
                      Creator requirements
                    </p>
                    <p style={{ margin: 0, color: 'var(--text)', lineHeight: 1.6 }}>
                      {truncateText(campaign.creatorRequirements, 160)}
                    </p>
                  </div>
                ) : null}

                {campaign.usageRights ? (
                  <div className="glass-card" style={{ boxShadow: 'var(--shadow-sm)', padding: '14px 16px' }}>
                    <p style={{ margin: '0 0 4px', color: 'var(--text-faint)', fontSize: '.78rem', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' }}>
                      Usage rights
                    </p>
                    <p style={{ margin: 0, color: 'var(--text)', lineHeight: 1.6 }}>
                      {truncateText(campaign.usageRights, 160)}
                    </p>
                  </div>
                ) : null}
              </div>
            )}

            <div className="split-row" style={{ marginTop: 4 }}>
              <div>
                <p style={{ margin: '0 0 4px', fontSize: '1.55rem', fontWeight: 700, letterSpacing: '-0.05em' }}>
                  {formatCents(campaign.budget)}
                </p>
                <p style={{ margin: 0, color: 'var(--text-soft)', fontSize: '.92rem' }}>Clear budget. No guesswork.</p>
              </div>

              {alreadyApplied ? (
                <span className="status-pill" style={{ background: 'rgba(15,23,42,0.06)', color: 'var(--text-soft)' }}>
                  Applied
                </span>
              ) : readOnly ? (
                <span className="pill">Read-only admin view</span>
              ) : user.stripeOnboarded ? (
                <ApplyModal campaignId={campaign.id} campaignTitle={campaign.title} budget={campaign.budget} />
              ) : (
                <span className="pill">Connect Stripe first</span>
              )}
            </div>
          </article>
        )
      })}
      </div>
    </>
  )
}

function Skeleton() {
  return (
    <div className="subtle-grid two-col">
      {[0, 1, 2, 3].map(i => (
        <div className="shimmer" key={i} style={{ height: 280, borderRadius: 28 }} />
      ))}
    </div>
  )
}

export default async function CreatorCampaignsPage({
  searchParams,
}: {
  searchParams: Promise<{ niche?: string; platform?: string; viewAs?: string }>
}) {
  const { niche, platform, viewAs } = await searchParams
  const viewAsSuffix = viewAs ? `&viewAs=${viewAs}` : ''

  return (
    <div className="subtle-grid" style={{ gap: 24 }}>
      <div>
        <p style={{ margin: '0 0 8px', color: 'var(--text-faint)', fontSize: '.82rem', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' }}>
          Campaign discovery
        </p>
        <h1 className="page-title" style={{ marginBottom: 10 }}>Find a creator deal that actually fits.</h1>
        <p className="page-copy" style={{ margin: 0, maxWidth: 700 }}>
          Browse live briefs, filter by niche or platform, and apply while the opportunity still feels fresh.
        </p>
      </div>

      <div className="filter-bar">
        <a
          href={viewAs ? `/creator/campaigns?viewAs=${viewAs}` : '/creator/campaigns'}
          className={`filter-chip ${!niche && !platform ? 'filter-chip-active' : ''}`}
        >
          All
        </a>
        {NICHES.map(item => (
          <a
            key={item}
            href={`/creator/campaigns?niche=${item}${viewAsSuffix}`}
            className={`filter-chip ${niche === item ? 'filter-chip-active' : ''}`}
          >
            {item}
          </a>
        ))}
        {PLATFORMS.map(item => (
          <a
            key={item}
            href={`/creator/campaigns?platform=${item}${viewAsSuffix}`}
            className={`filter-chip ${platform === item ? 'filter-chip-active' : ''}`}
          >
            {item}
          </a>
        ))}
      </div>

      <Suspense fallback={<Skeleton />}>
        <CampaignFeedContent niche={niche} platform={platform} viewAsId={viewAs} />
      </Suspense>
    </div>
  )
}
