import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import { requireTesterApiUser } from '@/lib/admin-api-guard'
import prisma from '@/lib/prisma'
import { releasePayout } from '@/lib/payout'
import { checkRateLimit, getRequestIp, isTrustedOrigin } from '@/lib/request-security'

const schema = z.object({
  submissionId: z.string().min(1),
})

export async function POST(req: Request) {
  try {
    if (!isTrustedOrigin(req)) {
      return Response.json({ error: 'Invalid request origin' }, { status: 403 })
    }

    const testerGate = await requireTesterApiUser()
    if (testerGate.response) return testerGate.response

    const { userId } = await auth()
    if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { id: true, role: true },
    })
    if (!user) return Response.json({ error: 'User not found' }, { status: 404 })
    if (user.role !== 'BRAND') {
      return Response.json({ error: 'Only brands can release payouts' }, { status: 403 })
    }

    const rateLimit = checkRateLimit(`stripe:release-payout:${user.id}:${getRequestIp(req)}`, {
      limit: 10,
      windowMs: 60_000,
    })
    if (!rateLimit.ok) {
      return Response.json(
        { error: 'Too many payout attempts. Please try again shortly.' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } },
      )
    }

    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    const submission = await prisma.submission.findUnique({
      where: { id: parsed.data.submissionId },
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
    if (!submission.application.paymentIntentId) {
      return Response.json({ error: 'No payment authorization was found for this application' }, { status: 400 })
    }

    await releasePayout(submission.id, submission.application.paymentIntentId)

    return Response.json({ success: true })
  } catch (err) {
    console.error('[POST /api/stripe/release-payout]', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
