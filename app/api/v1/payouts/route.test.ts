import { beforeEach, describe, expect, it, vi } from 'vitest'

const { findManyMock, countMock, aggregateMock } = vi.hoisted(() => ({
  findManyMock: vi.fn(),
  countMock: vi.fn(),
  aggregateMock: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  default: { payout: { findMany: findManyMock, count: countMock, aggregate: aggregateMock } },
}))

vi.mock('@/lib/mobile-api-guard', () => ({
  withMobileApi: (_opts: unknown, handler: (ctx: unknown) => Promise<Response>) => handler,
}))

const { GET } = await import('./route')

const creator = { id: 'user_1', email: 'creator@example.com', name: null, role: 'CREATOR' as const }

/** A payout row as Prisma returns it for this route, relation chain included. */
function payoutRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'payout_1',
    amount: 4500,
    platformFee: 500,
    status: 'PAID',
    createdAt: new Date('2026-07-01T00:00:00.000Z'),
    submission: {
      application: {
        campaign: {
          id: 'campaign_1',
          title: 'Summer Skincare Launch',
          brand: { name: 'Glow Co' },
        },
      },
    },
    ...overrides,
  }
}

describe('GET /api/v1/payouts', () => {
  beforeEach(() => {
    findManyMock.mockReset()
    countMock.mockReset()
    aggregateMock.mockReset()
    aggregateMock.mockResolvedValue({ _sum: { amount: 0 } })
  })

  it("only queries the caller's own payouts and excludes stripeTransferId", async () => {
    findManyMock.mockResolvedValue([payoutRow()])
    countMock.mockResolvedValue(1)

    const res = await GET({ req: new Request('https://example.com/api/v1/payouts'), user: creator } as never)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data[0]).not.toHaveProperty('stripeTransferId')
    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { creatorId: 'user_1' },
        select: expect.not.objectContaining({ stripeTransferId: true }),
      }),
    )
  })

  // Without this the Earnings screen shows a number smaller than the rate the
  // creator proposed, with nothing on screen saying what it paid for.
  it('names the brand and campaign each payout came from, traced through the submission', async () => {
    findManyMock.mockResolvedValue([payoutRow()])
    countMock.mockResolvedValue(1)

    const res = await GET({ req: new Request('https://example.com/api/v1/payouts'), user: creator } as never)
    const body = await res.json()

    expect(body.data[0].campaign).toEqual({
      id: 'campaign_1',
      title: 'Summer Skincare Launch',
      brand: { name: 'Glow Co' },
    })
    // Flattened onto the payout — the app is never handed the relation chain.
    expect(body.data[0]).not.toHaveProperty('submission')
  })

  // User.name is nullable, so a brand that never set one is representable —
  // the row still has to render (the app falls back to "A brand").
  it('passes a null brand name through rather than dropping the campaign', async () => {
    findManyMock.mockResolvedValue([
      payoutRow({
        submission: {
          application: {
            campaign: { id: 'campaign_1', title: 'Summer Skincare Launch', brand: { name: null } },
          },
        },
      }),
    ])
    countMock.mockResolvedValue(1)

    const res = await GET({ req: new Request('https://example.com/api/v1/payouts'), user: creator } as never)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data[0].campaign.brand).toEqual({ name: null })
    expect(body.data[0].campaign.title).toBe('Summer Skincare Launch')
  })

  it('reaches the campaign through Payout -> Submission -> Application without over-fetching', async () => {
    findManyMock.mockResolvedValue([])
    countMock.mockResolvedValue(0)

    await GET({ req: new Request('https://example.com/api/v1/payouts'), user: creator } as never)

    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          submission: {
            select: {
              application: {
                select: {
                  campaign: {
                    select: { id: true, title: true, brand: { select: { name: true } } },
                  },
                },
              },
            },
          },
        }),
      }),
    )
  })

  // The client renders this as "lifetime paid out". Deriving it from the
  // returned page would silently undercount any creator past the page limit.
  it('returns a lifetime PAID total aggregated across all payouts, not just this page', async () => {
    findManyMock.mockResolvedValue([])
    countMock.mockResolvedValue(42)
    aggregateMock.mockResolvedValue({ _sum: { amount: 1_234_500 } })

    const res = await GET({ req: new Request('https://example.com/api/v1/payouts'), user: creator } as never)
    const body = await res.json()

    expect(body.meta.lifetimePaidAmount).toBe(1_234_500)
    expect(aggregateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { creatorId: 'user_1', status: 'PAID' },
        _sum: { amount: true },
      }),
    )
  })

  it('reports a zero lifetime total when the creator has no paid payouts', async () => {
    findManyMock.mockResolvedValue([])
    countMock.mockResolvedValue(0)
    aggregateMock.mockResolvedValue({ _sum: { amount: null } })

    const res = await GET({ req: new Request('https://example.com/api/v1/payouts'), user: creator } as never)
    const body = await res.json()

    expect(body.meta.lifetimePaidAmount).toBe(0)
  })
})
