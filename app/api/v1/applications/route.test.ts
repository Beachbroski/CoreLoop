import { beforeEach, describe, expect, it, vi } from 'vitest'

const { userFindUniqueMock, campaignFindUniqueMock, applicationFindUniqueMock, applicationCreateMock, applicationFindManyMock, applicationCountMock } =
  vi.hoisted(() => ({
    userFindUniqueMock: vi.fn(),
    campaignFindUniqueMock: vi.fn(),
    applicationFindUniqueMock: vi.fn(),
    applicationCreateMock: vi.fn(),
    applicationFindManyMock: vi.fn(),
    applicationCountMock: vi.fn(),
  }))

vi.mock('@/lib/prisma', () => ({
  default: {
    user: { findUnique: userFindUniqueMock },
    campaign: { findUnique: campaignFindUniqueMock },
    application: {
      findUnique: applicationFindUniqueMock,
      create: applicationCreateMock,
      findMany: applicationFindManyMock,
      count: applicationCountMock,
    },
  },
}))

vi.mock('@/lib/mobile-api-guard', () => ({
  withMobileApi: (_opts: unknown, handler: (ctx: unknown) => Promise<Response>) => handler,
}))

const { POST, GET } = await import('./route')

const creator = { id: 'user_1', email: 'creator@example.com', name: null, role: 'CREATOR' as const }

function postCtx(body: unknown) {
  return {
    req: new Request('https://example.com/api/v1/applications', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
    }),
    user: creator,
  }
}

function getCtx(url = 'https://example.com/api/v1/applications') {
  return { req: new Request(url), user: creator }
}

const validBody = { campaignId: 'camp_1', pitch: 'a'.repeat(30), proposedRate: 500 }
const activeCampaign = {
  id: 'camp_1',
  brandId: 'brand_1',
  status: 'ACTIVE',
  deadline: new Date('2099-01-01'),
}

describe('POST /api/v1/applications', () => {
  beforeEach(() => {
    userFindUniqueMock.mockReset()
    campaignFindUniqueMock.mockReset()
    applicationFindUniqueMock.mockReset()
    applicationCreateMock.mockReset()
  })

  it('rejects when the creator has not onboarded to Stripe', async () => {
    userFindUniqueMock.mockResolvedValue({ stripeOnboarded: false })

    const res = await POST(postCtx(validBody) as never)

    expect(res.status).toBe(403)
    expect(campaignFindUniqueMock).not.toHaveBeenCalled()
  })

  it('rejects an invalid body before touching the database', async () => {
    const res = await POST(postCtx({ campaignId: 'camp_1', pitch: 'short', proposedRate: 500 }) as never)

    expect(res.status).toBe(400)
    expect(userFindUniqueMock).not.toHaveBeenCalled()
  })

  it('returns 404 for a nonexistent campaign', async () => {
    userFindUniqueMock.mockResolvedValue({ stripeOnboarded: true })
    campaignFindUniqueMock.mockResolvedValue(null)

    const res = await POST(postCtx(validBody) as never)

    expect(res.status).toBe(404)
  })

  it('rejects applying to a non-active campaign', async () => {
    userFindUniqueMock.mockResolvedValue({ stripeOnboarded: true })
    campaignFindUniqueMock.mockResolvedValue({ ...activeCampaign, status: 'DRAFT' })

    const res = await POST(postCtx(validBody) as never)

    expect(res.status).toBe(400)
  })

  it('rejects applying to your own campaign', async () => {
    userFindUniqueMock.mockResolvedValue({ stripeOnboarded: true })
    campaignFindUniqueMock.mockResolvedValue({ ...activeCampaign, brandId: 'user_1' })

    const res = await POST(postCtx(validBody) as never)

    expect(res.status).toBe(403)
  })

  it('rejects a duplicate application with 409', async () => {
    userFindUniqueMock.mockResolvedValue({ stripeOnboarded: true })
    campaignFindUniqueMock.mockResolvedValue(activeCampaign)
    applicationFindUniqueMock.mockResolvedValue({ id: 'existing_app' })

    const res = await POST(postCtx(validBody) as never)

    expect(res.status).toBe(409)
    expect(applicationCreateMock).not.toHaveBeenCalled()
  })

  it('creates the application and returns 201 on success', async () => {
    userFindUniqueMock.mockResolvedValue({ stripeOnboarded: true })
    campaignFindUniqueMock.mockResolvedValue(activeCampaign)
    applicationFindUniqueMock.mockResolvedValue(null)
    applicationCreateMock.mockResolvedValue({
      id: 'app_1',
      campaignId: 'camp_1',
      pitch: validBody.pitch,
      proposedRate: 500,
      status: 'PENDING',
      createdAt: new Date('2026-07-01T00:00:00.000Z'),
      campaign: { id: 'camp_1', title: 'Summer glow-up', budget: 5000, niche: 'beauty' },
    })

    const res = await POST(postCtx(validBody) as never)
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.data.id).toBe('app_1')
    expect(applicationCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ creatorId: 'user_1' }) }),
    )
  })
})

describe('GET /api/v1/applications', () => {
  beforeEach(() => {
    applicationFindManyMock.mockReset()
    applicationCountMock.mockReset()
  })

  it("only ever queries the caller's own applications", async () => {
    applicationFindManyMock.mockResolvedValue([])
    applicationCountMock.mockResolvedValue(0)

    await GET(getCtx() as never)

    expect(applicationFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { creatorId: 'user_1' } }),
    )
    expect(applicationCountMock).toHaveBeenCalledWith({ where: { creatorId: 'user_1' } })
  })
})
