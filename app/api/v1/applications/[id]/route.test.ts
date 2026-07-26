import { beforeEach, describe, expect, it, vi } from 'vitest'

const { findUniqueMock, deleteMock } = vi.hoisted(() => ({
  findUniqueMock: vi.fn(),
  deleteMock: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  default: { application: { findUnique: findUniqueMock, delete: deleteMock } },
}))

vi.mock('@/lib/mobile-api-guard', () => ({
  withMobileApi: (_opts: unknown, handler: (ctx: unknown) => Promise<Response>) => handler,
}))

const { GET, DELETE } = await import('./route')

const creatorA = { id: 'user_a', email: 'a@example.com', name: null, role: 'CREATOR' as const }

function ctx(id: string, user = creatorA) {
  return {
    req: new Request(`https://example.com/api/v1/applications/${id}`),
    user,
    context: { params: Promise.resolve({ id }) },
  }
}

const applicationOwnedByA = {
  id: 'app_1',
  campaignId: 'camp_1',
  creatorId: 'user_a',
  pitch: 'a'.repeat(30),
  proposedRate: 500,
  status: 'PENDING',
  createdAt: new Date('2026-07-01T00:00:00.000Z'),
  campaign: { id: 'camp_1', title: 'Summer glow-up', budget: 5000, niche: 'beauty' },
}

describe('GET /api/v1/applications/:id', () => {
  beforeEach(() => {
    findUniqueMock.mockReset()
  })

  it("returns the application when it belongs to the caller", async () => {
    findUniqueMock.mockResolvedValue(applicationOwnedByA)

    const res = await GET(ctx('app_1') as never)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.id).toBe('app_1')
  })

  it("returns 404 — not 403 — for another creator's application", async () => {
    findUniqueMock.mockResolvedValue(applicationOwnedByA)
    const creatorB = { ...creatorA, id: 'user_b' }

    const res = await GET(ctx('app_1', creatorB) as never)
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body.error).not.toMatch(/forbidden/i)
  })

  it('returns 404 for a nonexistent application', async () => {
    findUniqueMock.mockResolvedValue(null)

    const res = await GET(ctx('does_not_exist') as never)

    expect(res.status).toBe(404)
  })
})

describe('DELETE /api/v1/applications/:id', () => {
  beforeEach(() => {
    findUniqueMock.mockReset()
    deleteMock.mockReset()
  })

  it('withdraws a PENDING application owned by the caller', async () => {
    findUniqueMock.mockResolvedValue(applicationOwnedByA)

    const res = await DELETE(ctx('app_1') as never)

    expect(res.status).toBe(200)
    expect(deleteMock).toHaveBeenCalledWith({ where: { id: 'app_1' } })
  })

  it("refuses to withdraw another creator's application (404, and never calls delete)", async () => {
    findUniqueMock.mockResolvedValue(applicationOwnedByA)
    const creatorB = { ...creatorA, id: 'user_b' }

    const res = await DELETE(ctx('app_1', creatorB) as never)

    expect(res.status).toBe(404)
    expect(deleteMock).not.toHaveBeenCalled()
  })

  it('refuses to withdraw a non-PENDING application', async () => {
    findUniqueMock.mockResolvedValue({ ...applicationOwnedByA, status: 'ACCEPTED' })

    const res = await DELETE(ctx('app_1') as never)

    expect(res.status).toBe(409)
    expect(deleteMock).not.toHaveBeenCalled()
  })
})
