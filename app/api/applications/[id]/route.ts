import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import prisma from '@/lib/prisma'

const updateSchema = z.object({
  status: z.enum(['ACCEPTED', 'REJECTED']),
})

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

    const application = await prisma.application.findUnique({
      where: { id },
      include: { campaign: true },
    })
    if (!application) return Response.json({ error: 'Application not found' }, { status: 404 })
    if (application.campaign.brandId !== user.id) {
      return Response.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    const updated = await prisma.application.update({
      where: { id },
      data: { status: parsed.data.status },
    })

    if (parsed.data.status === 'ACCEPTED') {
      await prisma.campaign.update({
        where: { id: application.campaignId },
        data: { status: 'IN_PROGRESS' },
      })
    }

    return Response.json({ success: true, data: updated })
  } catch (err) {
    console.error('[PATCH /api/applications/[id]]', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
