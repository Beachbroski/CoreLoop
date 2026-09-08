import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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

/** Pinned so the deadline cutoff in `where` is an exact, assertable value — matches route.test.ts for the feed. */
const NOW = new Date('2026-07-15T09:00:00.000Z')

describe('GET /api/v1/campaigns/:id', () => {
  beforeEach(() => {
    findFirstMock.mockReset()
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns the campaign detail when active and not expired', async () => {
    findFirstMock.mockResolvedValue(dbCampaign)

    const res = await GET(ctx('camp_1') as never)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.id).toBe('camp_1')
    expect(body.data.title).toBe('Summer glow-up')
    expect(findFirstMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'camp_1', status: 'ACTIVE', deadline: { gte: NOW } },
      }),
    )
  })

  it('returns 404 when the campaign does not exist or is not active', async () => {
    findFirstMock.mockResolvedValue(null)

    const res = await GET(ctx('camp_missing') as never)

    expect(res.status).toBe(404)
  })

  // Applying past the deadline is a 400 (see app/api/v1/applications/route.ts)
  // and the feed already hides it, so the detail endpoint must agree: it
  // returns the same 404 as a DRAFT/CANCELLED campaign rather than leaking
  // that an expired campaign exists (docs/platform-split/02-mobile-api.md).
  it('returns 404 for an expired-but-ACTIVE campaign (mirrors the feed filter)', async () => {
    findFirstMock.mockResolvedValue(null)

    const res = await GET(ctx('camp_1') as never)
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body).toEqual({ success: false, error: 'Campaign not found' })
    expect(findFirstMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'camp_1', status: 'ACTIVE', deadline: { gte: NOW } },
      }),
    )
  })

  // `gte`, not `gt`: the apply route rejects on `deadline < now`, so a
  // campaign closing exactly now is still applicable and must stay visible —
  // same boundary as the feed (app/api/v1/campaigns/route.ts).
  it('treats a deadline exactly at the boundary as live, same as the feed', async () => {
    findFirstMock.mockResolvedValue({ ...dbCampaign, deadline: NOW })

    const res = await GET(ctx('camp_1') as never)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.id).toBe('camp_1')
    const { where } = findFirstMock.mock.calls[0][0]
    expect(where.deadline.gte.getTime()).toBe(NOW.getTime())
  })
})
