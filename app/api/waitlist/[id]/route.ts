import { z } from 'zod'
import { requireAdminApiUser } from '@/lib/admin-api-guard'
import prisma from '@/lib/prisma'
import { checkRateLimit, getRequestIp, isTrustedOrigin } from '@/lib/request-security'

const statusSchema = z.object({
  status: z.enum(['NEW', 'CONTACTED', 'APPROVED', 'INVITED']),
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

    const rateLimit = checkRateLimit(`waitlist:update:${adminGate.user.id}:${getRequestIp(req)}`, {
      limit: 30,
      windowMs: 60_000,
    })

    if (!rateLimit.ok) {
      return Response.json(
        { error: 'Too many waitlist status updates. Please try again shortly.' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } },
      )
    }

    const parsed = statusSchema.safeParse(await req.json())
    if (!parsed.success) {
      return Response.json({ error: parsed.error.issues[0]?.message ?? 'Invalid status.' }, { status: 400 })
    }

    const { id } = await params

    const updated = await prisma.waitlistSubmission.update({
      where: { id },
      data: { status: parsed.data.status },
      include: {
        referredBy: {
          select: { id: true, name: true, referralCode: true },
        },
        _count: {
          select: { referrals: true },
        },
      },
    })

    return Response.json({
      success: true,
      data: {
        id: updated.id,
        status: updated.status,
        referralCount: updated._count.referrals,
        referredBy: updated.referredBy,
      },
    })
  } catch (err) {
    console.error('[PATCH /api/waitlist/[id]]', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
