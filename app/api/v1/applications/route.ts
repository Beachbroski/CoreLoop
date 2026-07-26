import prisma from '@/lib/prisma'
import { withMobileApi } from '@/lib/mobile-api-guard'
import { applicationSchema, createApplicationRequestSchema, listApplicationsQuerySchema } from '@creatordocks/shared'

function toApplicationResponse(application: {
  id: string
  campaignId: string
  pitch: string
  proposedRate: number
  status: string
  createdAt: Date
  campaign: { id: string; title: string; budget: number; niche: string }
}) {
  return applicationSchema.parse({
    ...application,
    createdAt: application.createdAt.toISOString(),
  })
}

const campaignSummarySelect = { id: true, title: true, budget: true, niche: true } as const

export const POST = withMobileApi(
  { rateLimit: { limit: 15, windowMs: 60_000 }, role: 'CREATOR' },
  async ({ req, user }) => {
    const body = await req.json().catch(() => null)
    const parsed = createApplicationRequestSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json(
        { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid request' },
        { status: 400 },
      )
    }

    const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { stripeOnboarded: true } })
    if (!dbUser?.stripeOnboarded) {
      return Response.json(
        { success: false, error: 'Complete Stripe onboarding before applying to campaigns' },
        { status: 403 },
      )
    }

    const campaign = await prisma.campaign.findUnique({ where: { id: parsed.data.campaignId } })
    if (!campaign) return Response.json({ success: false, error: 'Campaign not found' }, { status: 404 })
    if (campaign.status !== 'ACTIVE') {
      return Response.json({ success: false, error: 'Campaign is not accepting applications' }, { status: 400 })
    }
    if (campaign.deadline < new Date()) {
      return Response.json({ success: false, error: "This campaign's deadline has passed" }, { status: 400 })
    }
    if (campaign.brandId === user.id) {
      return Response.json({ success: false, error: 'Cannot apply to your own campaign' }, { status: 403 })
    }

    const existing = await prisma.application.findUnique({
      where: { campaignId_creatorId: { campaignId: parsed.data.campaignId, creatorId: user.id } },
    })
    if (existing) {
      return Response.json({ success: false, error: 'Already applied to this campaign' }, { status: 409 })
    }

    const application = await prisma.application.create({
      data: {
        campaignId: parsed.data.campaignId,
        creatorId: user.id,
        pitch: parsed.data.pitch,
        proposedRate: parsed.data.proposedRate,
      },
      include: { campaign: { select: campaignSummarySelect } },
    })

    return Response.json({ success: true, data: toApplicationResponse(application) }, { status: 201 })
  },
)

export const GET = withMobileApi(
  { rateLimit: { limit: 60, windowMs: 60_000 }, role: 'CREATOR' },
  async ({ req, user }) => {
    const { searchParams } = new URL(req.url)
    const parsed = listApplicationsQuerySchema.safeParse(Object.fromEntries(searchParams))
    if (!parsed.success) {
      return Response.json(
        { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid query' },
        { status: 400 },
      )
    }

    const { page, limit } = parsed.data
    const where = { creatorId: user.id }

    const [applications, total] = await Promise.all([
      prisma.application.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { campaign: { select: campaignSummarySelect } },
      }),
      prisma.application.count({ where }),
    ])

    return Response.json({
      success: true,
      data: applications.map(toApplicationResponse),
      meta: { total, page, limit },
    })
  },
)
