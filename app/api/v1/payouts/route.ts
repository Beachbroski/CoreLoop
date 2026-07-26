import prisma from '@/lib/prisma'
import { withMobileApi } from '@/lib/mobile-api-guard'
import { listPayoutsQuerySchema, payoutSchema } from '@creatordocks/shared'

export const GET = withMobileApi(
  { rateLimit: { limit: 60, windowMs: 60_000 }, role: 'CREATOR' },
  async ({ req, user }) => {
    const { searchParams } = new URL(req.url)
    const parsed = listPayoutsQuerySchema.safeParse(Object.fromEntries(searchParams))
    if (!parsed.success) {
      return Response.json(
        { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid query' },
        { status: 400 },
      )
    }

    const { page, limit } = parsed.data
    const where = { creatorId: user.id }

    const [payouts, total] = await Promise.all([
      prisma.payout.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: { id: true, amount: true, platformFee: true, status: true, createdAt: true },
      }),
      prisma.payout.count({ where }),
    ])

    const data = payouts.map((payout) =>
      payoutSchema.parse({ ...payout, createdAt: payout.createdAt.toISOString() }),
    )

    return Response.json({ success: true, data, meta: { total, page, limit } })
  },
)
