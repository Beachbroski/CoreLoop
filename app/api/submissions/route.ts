import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import prisma from '@/lib/prisma'
import { checkRateLimit, getRequestIp, isTrustedOrigin } from '@/lib/request-security'

const createSchema = z.object({
  applicationId: z.string().min(1),
  contentUrl: z.string().url(),
  caption: z.string().optional(),
  notes: z.string().optional(),
})

export async function POST(req: Request) {
  try {
    if (!isTrustedOrigin(req)) {
      return Response.json({ error: 'Invalid request origin' }, { status: 403 })
    }

    const { userId } = await auth()
    if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const user = await prisma.user.findUnique({ where: { clerkId: userId } })
    if (!user) return Response.json({ error: 'User not found' }, { status: 404 })
    if (user.role !== 'CREATOR') {
      return Response.json({ error: 'Only creators can submit content' }, { status: 403 })
    }

    const rateLimit = checkRateLimit(`submissions:create:${user.id}:${getRequestIp(req)}`, {
      limit: 20,
      windowMs: 60_000,
    })
    if (!rateLimit.ok) {
      return Response.json(
        { error: 'Too many submission attempts. Please try again shortly.' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } },
      )
    }

    const body = await req.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    const application = await prisma.application.findUnique({
      where: { id: parsed.data.applicationId },
    })
    if (!application) return Response.json({ error: 'Application not found' }, { status: 404 })
    if (application.creatorId !== user.id) {
      return Response.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (application.status !== 'ACCEPTED') {
      return Response.json({ error: 'Application must be accepted before submitting content' }, { status: 400 })
    }

    const submission = await prisma.submission.create({
      data: {
        applicationId: parsed.data.applicationId,
        creatorId: user.id,
        contentUrl: parsed.data.contentUrl,
        caption: parsed.data.caption,
        notes: parsed.data.notes,
      },
    })

    return Response.json({ success: true, data: submission }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/submissions]', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const user = await prisma.user.findUnique({ where: { clerkId: userId } })
    if (!user) return Response.json({ error: 'User not found' }, { status: 404 })

    if (user.role === 'BRAND') {
      const submissions = await prisma.submission.findMany({
        where: { application: { campaign: { brandId: user.id } } },
        include: {
          application: {
            include: {
              campaign: { select: { id: true, title: true } },
            },
          },
          creator: { select: { name: true, avatarUrl: true } },
        },
        orderBy: { createdAt: 'desc' },
      })
      return Response.json({ success: true, data: submissions })
    }

    const submissions = await prisma.submission.findMany({
      where: { creatorId: user.id },
      include: {
        application: {
          include: {
            campaign: { select: { id: true, title: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })
    return Response.json({ success: true, data: submissions })
  } catch (err) {
    console.error('[GET /api/submissions]', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
