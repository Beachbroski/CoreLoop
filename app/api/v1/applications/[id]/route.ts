import prisma from '@/lib/prisma'
import { withMobileApi } from '@/lib/mobile-api-guard'
import { applicationSchema } from '@creatordocks/shared'

type RouteContext = { params: Promise<{ id: string }> }

const campaignSummarySelect = { id: true, title: true, budget: true, niche: true } as const

export const GET = withMobileApi<RouteContext>(
  { rateLimit: { limit: 60, windowMs: 60_000 }, role: 'CREATOR' },
  async ({ user, context }) => {
    const { id } = await context.params

    const application = await prisma.application.findUnique({
      where: { id },
      include: { campaign: { select: campaignSummarySelect } },
    })

    // A real application belonging to someone else looks identical to a
    // nonexistent one — never confirm existence of another creator's data.
    if (!application || application.creatorId !== user.id) {
      return Response.json({ success: false, error: 'Application not found' }, { status: 404 })
    }

    const data = applicationSchema.parse({ ...application, createdAt: application.createdAt.toISOString() })
    return Response.json({ success: true, data })
  },
)

export const DELETE = withMobileApi<RouteContext>(
  { rateLimit: { limit: 20, windowMs: 60_000 }, role: 'CREATOR' },
  async ({ user, context }) => {
    const { id } = await context.params

    const application = await prisma.application.findUnique({ where: { id } })
    if (!application || application.creatorId !== user.id) {
      return Response.json({ success: false, error: 'Application not found' }, { status: 404 })
    }

    if (application.status !== 'PENDING') {
      return Response.json(
        { success: false, error: 'Only pending applications can be withdrawn' },
        { status: 409 },
      )
    }

    await prisma.application.delete({ where: { id } })

    return Response.json({ success: true, data: null })
  },
)
