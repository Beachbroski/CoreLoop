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

describe('GET /api/v1/payouts', () => {
  beforeEach(() => {
    findManyMock.mockReset()
    countMock.mockReset()
    aggregateMock.mockReset()
    aggregateMock.mockResolvedValue({ _sum: { amount: 0 } })
  })

  it("only queries the caller's own payouts and excludes stripeTransferId", async () => {
    findManyMock.mockResolvedValue([
      {
        id: 'payout_1',
        amount: 4500,
        platformFee: 500,
        status: 'PAID',
        createdAt: new Date('2026-07-01T00:00:00.000Z'),
      },
    ])
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
