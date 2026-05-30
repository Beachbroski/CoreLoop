import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import { requireAdminApiUser } from '@/lib/admin-api-guard'
import prisma from '@/lib/prisma'
import { releasePayout } from '@/lib/payout'
import { checkRateLimit, getRequestIp, isTrustedOrigin } from '@/lib/request-security'

const updateSchema = z.object({
  status: z.enum(['APPROVED', 'REVISION_REQUESTED', 'REJECTED']),
})

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (!isTrustedOrigin(req)) {
      return Response.json({ error: 'Invalid request origin' }, { status: 403 })
    }

    const adminGate = await requireAdminApiUser()
    if (adminGate.response) return adminGate.response

    const { userId } = await auth()
    if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params

    const user = await prisma.user.findUnique({ where: { clerkId: userId } })
    if (!user) return Response.json({ error: 'User not found' }, { status: 404 })
    if (user.role !== 'BRAND') {
      return Response.json({ error: 'Only brands can review submissions' }, { status: 403 })
    }

    const rateLimit = checkRateLimit(`submissions:review:${user.id}:${getRequestIp(req)}`, {
      limit: 20,
      windowMs: 60_000,
    })
    if (!rateLimit.ok) {
      return Response.json(
        { error: 'Too many submission review attempts. Please try again shortly.' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } },
      )
    }

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

    if (submission.status === 'APPROVED') {
      return Response.json(
        { error: 'Approved submissions can no longer be moved to another state' },
        { status: 409 },
      )
    }

    if (parsed.data.status === 'APPROVED') {
      const paymentIntentId = submission.application.paymentIntentId
      if (!paymentIntentId) {
        return Response.json(
          { error: 'No payment authorization was found for this application' },
          { status: 400 },
        )
      }

      await releasePayout(submission.id, paymentIntentId)
      const approvedSubmission = await prisma.submission.findUnique({ where: { id } })
      return Response.json({ success: true, data: approvedSubmission })
    }

    const updated = await prisma.submission.update({
      where: { id },
      data: { status: parsed.data.status },
    })

    return Response.json({ success: true, data: updated })
  } catch (err) {
    console.error('[PATCH /api/submissions/[id]]', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
