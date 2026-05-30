import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import { requireAdminApiUser } from '@/lib/admin-api-guard'
import prisma from '@/lib/prisma'
import { checkRateLimit, getRequestIp, isTrustedOrigin } from '@/lib/request-security'

const createSchema = z.object({
  campaignId: z.string().min(1),
  pitch: z.string().min(20).max(2000),
  proposedRate: z.number().int().min(100).max(10_000_000),
})

export async function POST(req: Request) {
  try {
    if (!isTrustedOrigin(req)) {
      return Response.json({ error: 'Invalid request origin' }, { status: 403 })
    }

    const adminGate = await requireAdminApiUser()
    if (adminGate.response) return adminGate.response

    const { userId } = await auth()
    if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const user = await prisma.user.findUnique({ where: { clerkId: userId } })
    if (!user) return Response.json({ error: 'User not found' }, { status: 404 })
    if (user.role !== 'CREATOR') {
      return Response.json({ error: 'Only creators can apply to campaigns' }, { status: 403 })
    }

    const rateLimit = checkRateLimit(`applications:create:${user.id}:${getRequestIp(req)}`, {
      limit: 15,
      windowMs: 60_000,
    })
    if (!rateLimit.ok) {
      return Response.json(
        { error: 'Too many application attempts. Please try again shortly.' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } },
      )
    }

    if (!user.stripeOnboarded) {
      return Response.json(
        { error: 'Complete Stripe onboarding before applying to campaigns' },
        { status: 403 },
      )
    }

    const body = await req.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    const campaign = await prisma.campaign.findUnique({
      where: { id: parsed.data.campaignId },
    })
    if (!campaign) return Response.json({ error: 'Campaign not found' }, { status: 404 })
    if (campaign.status !== 'ACTIVE') {
      return Response.json({ error: 'Campaign is not accepting applications' }, { status: 400 })
    }
    if (campaign.brandId === user.id) {
      return Response.json({ error: 'Cannot apply to your own campaign' }, { status: 403 })
    }

    const existing = await prisma.application.findUnique({
      where: { campaignId_creatorId: { campaignId: parsed.data.campaignId, creatorId: user.id } },
    })
    if (existing) {
      return Response.json({ error: 'Already applied to this campaign' }, { status: 409 })
    }

    const application = await prisma.application.create({
      data: {
        campaignId: parsed.data.campaignId,
        creatorId: user.id,
        pitch: parsed.data.pitch,
        proposedRate: parsed.data.proposedRate,
      },
    })

    return Response.json({ success: true, data: application }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/applications]', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET() {
  try {
    const adminGate = await requireAdminApiUser()
    if (adminGate.response) return adminGate.response

    const { userId } = await auth()
    if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const user = await prisma.user.findUnique({ where: { clerkId: userId } })
    if (!user) return Response.json({ error: 'User not found' }, { status: 404 })

    if (user.role === 'BRAND') {
      const applications = await prisma.application.findMany({
        where: { campaign: { brandId: user.id } },
        include: {
          campaign: { select: { id: true, title: true } },
          creator: { select: { name: true, avatarUrl: true } },
        },
        orderBy: { createdAt: 'desc' },
      })
      return Response.json({ success: true, data: applications })
    }

    const applications = await prisma.application.findMany({
      where: { creatorId: user.id },
      include: {
        campaign: {
          select: { id: true, title: true, budget: true, niche: true },
          include: { brand: { select: { name: true, avatarUrl: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    })
    return Response.json({ success: true, data: applications })
  } catch (err) {
    console.error('[GET /api/applications]', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
