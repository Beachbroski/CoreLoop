import prisma from '@/lib/prisma'
import { withMobileApi } from '@/lib/mobile-api-guard'
import { campaignDetailSchema } from '@creatordocks/shared'

type RouteContext = { params: Promise<{ id: string }> }

export const GET = withMobileApi<RouteContext>(
  { rateLimit: { limit: 60, windowMs: 60_000 } },
  async ({ context }) => {
    const { id } = await context.params

    // Only ACTIVE, not-yet-expired campaigns are ever visible to the mobile
    // app — a DRAFT/CANCELLED campaign or one past its deadline returns 404
    // rather than leaking its existence/status. `gte` mirrors the feed
    // (app/api/v1/campaigns/route.ts) and POST /api/v1/applications exactly,
    // so a campaign reachable here can still be applied to.
    const campaign = await prisma.campaign.findFirst({
      where: { id, status: 'ACTIVE', deadline: { gte: new Date() } },
      select: {
        id: true,
        title: true,
        description: true,
        objective: true,
        deliverables: true,
        targetAudience: true,
        creatorRequirements: true,
        callToAction: true,
        usageRights: true,
        creatorsNeeded: true,
        budget: true,
        deadline: true,
        niche: true,
        platforms: true,
        createdAt: true,
        brand: { select: { name: true, avatarUrl: true } },
      },
    })

    if (!campaign) {
      return Response.json({ success: false, error: 'Campaign not found' }, { status: 404 })
    }

    const data = campaignDetailSchema.parse({
      ...campaign,
      deadline: campaign.deadline.toISOString(),
      createdAt: campaign.createdAt.toISOString(),
    })

    return Response.json({ success: true, data })
  },
)
