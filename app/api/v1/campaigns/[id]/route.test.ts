import { beforeEach, describe, expect, it, vi } from 'vitest'

const { findFirstMock } = vi.hoisted(() => ({ findFirstMock: vi.fn() }))

vi.mock('@/lib/prisma', () => ({
  default: { campaign: { findFirst: findFirstMock } },
}))

vi.mock('@/lib/mobile-api-guard', () => ({
  withMobileApi: (_opts: unknown, handler: (ctx: unknown) => Promise<Response>) => handler,
}))

const { GET } = await import('./route')

const dbCampaign = {
  id: 'camp_1',
  title: 'Summer glow-up',
  description: 'Full brief here.',
  objective: null,
  deliverables: null,
  targetAudience: null,
  creatorRequirements: null,
  callToAction: null,
  usageRights: null,
  creatorsNeeded: 3,
  budget: 5000,
  deadline: new Date('2026-08-01T00:00:00.000Z'),
  niche: 'beauty',
  platforms: ['instagram'],
  createdAt: new Date('2026-07-01T00:00:00.000Z'),
  brand: { name: 'Acme Co', avatarUrl: null },
}

function ctx(id: string) {
  return {
    req: new Request(`https://example.com/api/v1/campaigns/${id}`),
    user: { id: 'user_1', email: 'a@b.com', name: null, role: 'CREATOR' },
    context: { params: Promise.resolve({ id }) },
  }
}

describe('GET /api/v1/campaigns/:id', () => {
  beforeEach(() => {
    findFirstMock.mockReset()
  })

  it('returns the campaign detail when active', async () => {
    findFirstMock.mockResolvedValue(dbCampaign)

    const res = await GET(ctx('camp_1') as never)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.id).toBe('camp_1')
    expect(findFirstMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'camp_1', status: 'ACTIVE' } }),
    )
  })

  it('returns 404 when the campaign does not exist or is not active', async () => {
    findFirstMock.mockResolvedValue(null)

    const res = await GET(ctx('camp_missing') as never)

    expect(res.status).toBe(404)
  })
})
