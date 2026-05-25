import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import prisma from '@/lib/prisma'

const updateSchema = z.object({
  status: z.enum(['DRAFT', 'ACTIVE', 'IN_PROGRESS', 'COMPLETE', 'CANCELLED']).optional(),
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
    const { userId } = await auth()
    if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params

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

    return Response.json({ success: true, data: campaign })
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
    const { userId } = await auth()
    if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params

    const user = await prisma.user.findUnique({ where: { clerkId: userId } })
    if (!user) return Response.json({ error: 'User not found' }, { status: 404 })

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
