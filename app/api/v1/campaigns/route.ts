import prisma from '@/lib/prisma'
import { withMobileApi } from '@/lib/mobile-api-guard'
import { campaignListItemSchema, listCampaignsQuerySchema } from '@creatordocks/shared'

export const GET = withMobileApi({ rateLimit: { limit: 60, windowMs: 60_000 } }, async ({ req }) => {
  const { searchParams } = new URL(req.url)
  const parsed = listCampaignsQuerySchema.safeParse(Object.fromEntries(searchParams))
  if (!parsed.success) {
    return Response.json(
      { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid query' },
      { status: 400 },
    )
  }

  const { page, limit, niche, platform } = parsed.data
  // Past the deadline a campaign is a dead end: POST /api/v1/applications
  // rejects it with a 400, but the creator only finds that out after opening
  // the brief and writing a pitch. `gte` mirrors that route's boundary exactly
  // (it rejects on `deadline < now`), so everything this feed shows can still
  // be applied to. `count` shares the clause, so `meta.total` agrees with the
  // page. Brands review their own expired campaigns on web — /api/v1 is the
  // creator surface only.
  const where = {
    status: 'ACTIVE' as const,
    deadline: { gte: new Date() },
    ...(niche ? { niche } : {}),
    ...(platform ? { platforms: { has: platform } } : {}),
  }

  const [campaigns, total] = await Promise.all([
    prisma.campaign.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        title: true,
        budget: true,
        deadline: true,
        niche: true,
        platforms: true,
        creatorsNeeded: true,
        createdAt: true,
        brand: { select: { name: true, avatarUrl: true } },
      },
    }),
    prisma.campaign.count({ where }),
  ])

  const data = campaigns.map((campaign) =>
    campaignListItemSchema.parse({
      ...campaign,
      deadline: campaign.deadline.toISOString(),
      createdAt: campaign.createdAt.toISOString(),
    }),
  )

  return Response.json({ success: true, data, meta: { total, page, limit } })
})
