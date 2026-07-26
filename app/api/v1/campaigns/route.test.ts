import { beforeEach, describe, expect, it, vi } from 'vitest'

const { findManyMock, countMock } = vi.hoisted(() => ({
  findManyMock: vi.fn(),
  countMock: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  default: { campaign: { findMany: findManyMock, count: countMock } },
}))

vi.mock('@/lib/mobile-api-guard', () => ({
  withMobileApi: (_opts: unknown, handler: (ctx: unknown) => Promise<Response>) => handler,
}))

const { GET } = await import('./route')

const dbCampaign = {
  id: 'camp_1',
  title: 'Summer glow-up',
  budget: 5000,
  deadline: new Date('2026-08-01T00:00:00.000Z'),
  niche: 'beauty',
  platforms: ['instagram'],
  creatorsNeeded: 3,
  createdAt: new Date('2026-07-01T00:00:00.000Z'),
  brand: { name: 'Acme Co', avatarUrl: null },
}

function ctx(url: string) {
  return { req: new Request(url), user: { id: 'user_1', email: 'a@b.com', name: null, role: 'CREATOR' } }
}

describe('GET /api/v1/campaigns', () => {
  beforeEach(() => {
    findManyMock.mockReset()
    countMock.mockReset()
  })

  it('returns active campaigns with pagination meta', async () => {
    findManyMock.mockResolvedValue([dbCampaign])
    countMock.mockResolvedValue(1)

    const res = await GET(ctx('https://example.com/api/v1/campaigns') as never)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data).toHaveLength(1)
    expect(body.data[0].deadline).toBe('2026-08-01T00:00:00.000Z')
    expect(body.meta).toEqual({ total: 1, page: 1, limit: 20 })
    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'ACTIVE' }, skip: 0, take: 20 }),
    )
  })

  it('filters by niche and platform from query params', async () => {
    findManyMock.mockResolvedValue([])
    countMock.mockResolvedValue(0)

    await GET(ctx('https://example.com/api/v1/campaigns?niche=beauty&platform=tiktok') as never)

    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'ACTIVE', niche: 'beauty', platforms: { has: 'tiktok' } },
      }),
    )
  })

  it('rejects a limit above the max with 400', async () => {
    const res = await GET(ctx('https://example.com/api/v1/campaigns?limit=500') as never)

    expect(res.status).toBe(400)
    expect(findManyMock).not.toHaveBeenCalled()
  })

  it('applies page/limit to skip/take correctly', async () => {
    findManyMock.mockResolvedValue([])
    countMock.mockResolvedValue(0)

    await GET(ctx('https://example.com/api/v1/campaigns?page=3&limit=10') as never)

    expect(findManyMock).toHaveBeenCalledWith(expect.objectContaining({ skip: 20, take: 10 }))
  })
})
