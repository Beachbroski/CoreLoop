import prisma from '@/lib/prisma'
import { withMobileApi } from '@/lib/mobile-api-guard'
import { listPayoutsQuerySchema, payoutSchema } from '@creatordocks/shared'

// Payout -> Submission -> Application -> Campaign is the only path from a
// payment back to the work that earned it. Every hop is a plain `select` so
// the intermediate rows carry nothing but the edge to the next one.
const campaignProvenanceSelect = {
  select: {
    application: {
      select: {
        campaign: {
          // brand.name only — the earnings row names the brand in text, so
          // pulling its avatar too would be a join's worth of unused bytes.
          select: { id: true, title: true, brand: { select: { name: true } } },
        },
      },
    },
  },
} as const

// The relation chain is flattened away on the wire — the app is told what the
// payment was for, not how the tables get there.
function toPayoutResponse(payout: {
  id: string
  amount: number
  platformFee: number
  status: string
  createdAt: Date
  submission: { application: { campaign: { id: string; title: string; brand: { name: string | null } } } }
}) {
  const { submission, ...rest } = payout
  return payoutSchema.parse({
    ...rest,
    createdAt: payout.createdAt.toISOString(),
    campaign: submission.application.campaign,
  })
}

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
        select: {
          id: true,
          amount: true,
          platformFee: true,
          status: true,
          createdAt: true,
          submission: campaignProvenanceSelect,
        },
      }),
      prisma.payout.count({ where }),
      prisma.payout.aggregate({ where: { ...where, status: 'PAID' }, _sum: { amount: true } }),
    ])

    return Response.json({
      success: true,
      data: payouts.map(toPayoutResponse),
      meta: { total, page, limit, lifetimePaidAmount: paidAggregate._sum.amount ?? 0 },
    })
  },
)
