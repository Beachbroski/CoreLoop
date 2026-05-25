import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import prisma from '@/lib/prisma'

const campaignSchema = z.object({
  title: z.string().min(5).max(100),
  description: z.string().min(20).max(2000),
  objective: z.string().max(240).optional().or(z.literal('')),
  deliverables: z.string().max(1200).optional().or(z.literal('')),
  targetAudience: z.string().max(240).optional().or(z.literal('')),
  creatorRequirements: z.string().max(1200).optional().or(z.literal('')),
  callToAction: z.string().max(240).optional().or(z.literal('')),
  usageRights: z.string().max(240).optional().or(z.literal('')),
  creatorsNeeded: z.number().int().min(1).max(100).optional(),
  budget: z.number().int().min(500),
  deadline: z.string().datetime(),
  niche: z.string().min(1),
  platforms: z.array(z.string()).min(1),
})

export async function GET(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const niche = searchParams.get('niche')
    const platform = searchParams.get('platform')

    const campaigns = await prisma.campaign.findMany({
      where: {
        status: 'ACTIVE',
        ...(niche ? { niche } : {}),
        ...(platform ? { platforms: { has: platform } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        brand: { select: { name: true, avatarUrl: true } },
      },
    })

    return Response.json({ success: true, data: campaigns })
  } catch (err) {
    console.error('[GET /api/campaigns]', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const user = await prisma.user.findUnique({ where: { clerkId: userId } })
    if (!user) return Response.json({ error: 'User not found' }, { status: 404 })
    if (user.role !== 'BRAND') {
      return Response.json({ error: 'Only brands can create campaigns' }, { status: 403 })
    }

    const body = await req.json()
    const parsed = campaignSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    const deadline = new Date(parsed.data.deadline)
    if (deadline <= new Date()) {
      return Response.json({ error: 'Deadline must be in the future' }, { status: 400 })
    }

    const campaign = await prisma.campaign.create({
      data: {
        brandId: user.id,
        title: parsed.data.title,
        description: parsed.data.description,
        objective: parsed.data.objective || null,
        deliverables: parsed.data.deliverables || null,
        targetAudience: parsed.data.targetAudience || null,
        creatorRequirements: parsed.data.creatorRequirements || null,
        callToAction: parsed.data.callToAction || null,
        usageRights: parsed.data.usageRights || null,
        creatorsNeeded: parsed.data.creatorsNeeded ?? null,
        budget: parsed.data.budget,
        deadline,
        niche: parsed.data.niche,
        platforms: parsed.data.platforms,
        status: 'ACTIVE',
      },
    })

    return Response.json({ success: true, data: campaign }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/campaigns]', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
