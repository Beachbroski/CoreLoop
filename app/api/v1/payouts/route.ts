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

    // The lifetime total is aggregated across ALL payouts, never derived from
    // the returned page — the client shows it as "lifetime paid out", so summing
    // one page would silently undercount any creator past the page limit.
    const [payouts, total, paidAggregate] = await Promise.all([
      prisma.payout.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: { id: true, amount: true, platformFee: true, status: true, createdAt: true },
      }),
      prisma.payout.count({ where }),
      prisma.payout.aggregate({ where: { ...where, status: 'PAID' }, _sum: { amount: true } }),
    ])

    const data = payouts.map((payout) =>
      payoutSchema.parse({ ...payout, createdAt: payout.createdAt.toISOString() }),
    )

    return Response.json({
      success: true,
      data,
      meta: { total, page, limit, lifetimePaidAmount: paidAggregate._sum.amount ?? 0 },
    })
  },
)
