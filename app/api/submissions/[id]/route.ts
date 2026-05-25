import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import prisma from '@/lib/prisma'
import { releasePayout } from '@/lib/payout'

const updateSchema = z.object({
  status: z.enum(['APPROVED', 'REVISION_REQUESTED', 'REJECTED']),
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

    const submission = await prisma.submission.findUnique({
      where: { id },
      include: {
        application: {
          include: { campaign: true },
        },
      },
    })
    if (!submission) return Response.json({ error: 'Submission not found' }, { status: 404 })
    if (submission.application.campaign.brandId !== user.id) {
      return Response.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    const updated = await prisma.submission.update({
      where: { id },
      data: { status: parsed.data.status },
    })

    if (parsed.data.status === 'APPROVED') {
      const paymentIntentId = submission.application.paymentIntentId
      if (!paymentIntentId) {
        return Response.json({ error: 'No payment intent found for this application' }, { status: 400 })
      }
      await releasePayout(submission.id, paymentIntentId)
    }

    return Response.json({ success: true, data: updated })
  } catch (err) {
    console.error('[PATCH /api/submissions/[id]]', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
