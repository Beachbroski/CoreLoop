import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import { requireTesterApiUser } from '@/lib/admin-api-guard'
import prisma from '@/lib/prisma'
import { checkRateLimit, getRequestIp, isTrustedOrigin } from '@/lib/request-security'
import { cancelPaymentIntentIfCancelable } from '@/lib/stripe-payments'

const updateSchema = z.object({
  status: z.enum(['DRAFT', 'ACTIVE', 'CANCELLED']).optional(),
  title: z.string().min(5).max(100).optional(),
  description: z.string().min(20).max(2000).optional(),
  objective: z.string().max(240).optional().or(z.literal('')),
  deliverables: z.string().max(1200).optional().or(z.literal('')),
  targetAudience: z.string().max(240).optional().or(z.literal('')),
  creatorRequirements: z.string().max(1200).optional().or(z.literal('')),
  callToAction: z.string().max(240).optional().or(z.literal('')),
  usageRights: z.string().max(240).optional().or(z.literal('')),
  creatorsNeeded: z.number().int().min(1).max(100).optional().nullable(),
  budget: z.number().int().min(500).optional(),
  deadline: z.string().datetime().optional(),
  niche: z.string().min(1).optional(),
  platforms: z.array(z.string()).min(1).optional(),
})

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const testerGate = await requireTesterApiUser()
    if (testerGate.response) return testerGate.response

    const { userId } = await auth()
    if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { id: true, role: true },
    })
    if (!user) return Response.json({ error: 'User not found' }, { status: 404 })

    if (user.role === 'BRAND') {
      const campaign = await prisma.campaign.findUnique({
        where: { id },
        include: {
          brand: { select: { name: true, avatarUrl: true } },
          applications: {
            include: {
              creator: { select: { name: true, avatarUrl: true } },
            },
            orderBy: { createdAt: 'desc' },
          },
        },
      })

      if (!campaign) return Response.json({ error: 'Campaign not found' }, { status: 404 })
      if (campaign.brandId !== user.id) {
        return Response.json({ error: 'Forbidden' }, { status: 403 })
      }

      return Response.json({ success: true, data: campaign })
    }

    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: {
        brand: { select: { name: true, avatarUrl: true } },
        applications: {
          where: { creatorId: user.id },
          select: {
            id: true,
            status: true,
            proposedRate: true,
            createdAt: true,
          },
        },
      },
    })

    if (!campaign) return Response.json({ error: 'Campaign not found' }, { status: 404 })
    if (campaign.status !== 'ACTIVE' && campaign.applications.length === 0) {
      return Response.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { applications, ...campaignData } = campaign
    return Response.json({
      success: true,
      data: {
        ...campaignData,
        myApplication: applications[0] ?? null,
      },
    })
  } catch (err) {
    console.error('[GET /api/campaigns/[id]]', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (!isTrustedOrigin(req)) {
      return Response.json({ error: 'Invalid request origin' }, { status: 403 })
    }

    const testerGate = await requireTesterApiUser()
    if (testerGate.response) return testerGate.response

    const { userId } = await auth()
    if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params

    const user = await prisma.user.findUnique({ where: { clerkId: userId } })
    if (!user) return Response.json({ error: 'User not found' }, { status: 404 })
    if (user.role !== 'BRAND') {
      return Response.json({ error: 'Only brands can update campaigns' }, { status: 403 })
    }

    const rateLimit = checkRateLimit(`campaigns:update:${user.id}:${getRequestIp(req)}`, {
      limit: 20,
      windowMs: 60_000,
    })
    if (!rateLimit.ok) {
      return Response.json(
        { error: 'Too many campaign update attempts. Please try again shortly.' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } },
      )
    }

    const campaign = await prisma.campaign.findUnique({ where: { id } })
    if (!campaign) return Response.json({ error: 'Campaign not found' }, { status: 404 })
    if (campaign.brandId !== user.id) {
      return Response.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    if (parsed.data.deadline) {
      const deadline = new Date(parsed.data.deadline)
      if (deadline <= new Date()) {
        return Response.json({ error: 'Deadline must be in the future' }, { status: 400 })
      }
    }

    if (parsed.data.status === 'CANCELLED') {
      const applicationsWithPayments = await prisma.application.findMany({
        where: {
          campaignId: id,
          paymentIntentId: { not: null },
        },
        select: { paymentIntentId: true },
      })

      await Promise.all(
        applicationsWithPayments.map(async ({ paymentIntentId }) => {
          if (!paymentIntentId) return
          try {
            await cancelPaymentIntentIfCancelable(paymentIntentId)
          } catch (err) {
            console.warn('[PATCH /api/campaigns/[id]] unable to cancel payment intent', err)
          }
        }),
      )
    }

    const updated = await prisma.campaign.update({
      where: { id },
      data: {
        ...parsed.data,
        ...(parsed.data.objective !== undefined ? { objective: parsed.data.objective || null } : {}),
        ...(parsed.data.deliverables !== undefined ? { deliverables: parsed.data.deliverables || null } : {}),
        ...(parsed.data.targetAudience !== undefined ? { targetAudience: parsed.data.targetAudience || null } : {}),
        ...(parsed.data.creatorRequirements !== undefined ? { creatorRequirements: parsed.data.creatorRequirements || null } : {}),
        ...(parsed.data.callToAction !== undefined ? { callToAction: parsed.data.callToAction || null } : {}),
        ...(parsed.data.usageRights !== undefined ? { usageRights: parsed.data.usageRights || null } : {}),
        ...(parsed.data.deadline ? { deadline: new Date(parsed.data.deadline) } : {}),
      },
    })

    return Response.json({ success: true, data: updated })
  } catch (err) {
    console.error('[PATCH /api/campaigns/[id]]', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
