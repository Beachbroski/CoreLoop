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
  const where = {
    status: 'ACTIVE' as const,
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
