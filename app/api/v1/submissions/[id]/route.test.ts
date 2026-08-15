import { beforeEach, describe, expect, it, vi } from 'vitest'

const { findUniqueMock, updateMock } = vi.hoisted(() => ({
  findUniqueMock: vi.fn(),
  updateMock: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  default: { submission: { findUnique: findUniqueMock, update: updateMock } },
}))

vi.mock('@/lib/mobile-api-guard', () => ({
  withMobileApi: (_opts: unknown, handler: (ctx: unknown) => Promise<Response>) => handler,
}))

const { GET, PATCH } = await import('./route')

const creatorA = { id: 'user_a', email: 'a@example.com', name: null, role: 'CREATOR' as const }

function getCtx(id: string, user = creatorA) {
  return {
    req: new Request(`https://example.com/api/v1/submissions/${id}`),
    user,
    context: { params: Promise.resolve({ id }) },
  }
}

function patchCtx(id: string, body: unknown, user = creatorA) {
  return {
    req: new Request(`https://example.com/api/v1/submissions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
    }),
    user,
    context: { params: Promise.resolve({ id }) },
  }
}

const dbSubmission = {
  id: 'sub_1',
  creatorId: 'user_a',
  applicationId: 'app_1',
  contentUrl: 'https://tiktok.com/@creator/video/123',
  caption: null,
  notes: null,
  status: 'REJECTED',
  reviewNote: 'Not on brand',
  createdAt: new Date('2026-07-01T00:00:00.000Z'),
  application: { id: 'app_1', campaign: { id: 'camp_1', title: 'Summer glow-up' } },
}

describe('GET /api/v1/submissions/:id', () => {
  beforeEach(() => {
    findUniqueMock.mockReset()
  })

  it('returns the submission when owned by the caller', async () => {
    findUniqueMock.mockResolvedValue(dbSubmission)

    const res = await GET(getCtx('sub_1') as never)

    expect(res.status).toBe(200)
  })

  it("returns 404 for another creator's submission", async () => {
    findUniqueMock.mockResolvedValue(dbSubmission)
    const creatorB = { ...creatorA, id: 'user_b' }

    const res = await GET(getCtx('sub_1', creatorB) as never)

    expect(res.status).toBe(404)
  })
})

describe('PATCH /api/v1/submissions/:id (resubmit)', () => {
  beforeEach(() => {
    findUniqueMock.mockReset()
    updateMock.mockReset()
  })

  const newBody = { contentUrl: 'https://app123.ufs.sh/f/updated-key' }

  it('resubmits a REJECTED submission and resets it to PENDING', async () => {
    findUniqueMock.mockResolvedValue(dbSubmission)
    updateMock.mockResolvedValue({ ...dbSubmission, ...newBody, status: 'PENDING', reviewNote: null })

    const res = await PATCH(patchCtx('sub_1', newBody) as never)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.status).toBe('PENDING')
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'sub_1' },
        data: expect.objectContaining({ status: 'PENDING', reviewNote: null }),
      }),
    )
  })

  it('resubmits a REVISION_REQUESTED submission', async () => {
    findUniqueMock.mockResolvedValue({ ...dbSubmission, status: 'REVISION_REQUESTED' })
    updateMock.mockResolvedValue({ ...dbSubmission, ...newBody, status: 'PENDING', reviewNote: null })

    const res = await PATCH(patchCtx('sub_1', newBody) as never)

    expect(res.status).toBe(200)
  })

  it('refuses to resubmit a PENDING submission', async () => {
    findUniqueMock.mockResolvedValue({ ...dbSubmission, status: 'PENDING' })

    const res = await PATCH(patchCtx('sub_1', newBody) as never)

    expect(res.status).toBe(409)
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('refuses to resubmit an APPROVED submission', async () => {
    findUniqueMock.mockResolvedValue({ ...dbSubmission, status: 'APPROVED' })

    const res = await PATCH(patchCtx('sub_1', newBody) as never)

    expect(res.status).toBe(409)
    expect(updateMock).not.toHaveBeenCalled()
  })

  it("refuses to resubmit another creator's submission (404, never calls update)", async () => {
    findUniqueMock.mockResolvedValue(dbSubmission)
    const creatorB = { ...creatorA, id: 'user_b' }

    const res = await PATCH(patchCtx('sub_1', newBody, creatorB) as never)

    expect(res.status).toBe(404)
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('rejects an invalid contentUrl', async () => {
    findUniqueMock.mockResolvedValue(dbSubmission)

    const res = await PATCH(patchCtx('sub_1', { contentUrl: 'not-a-url' }) as never)

    expect(res.status).toBe(400)
    expect(updateMock).not.toHaveBeenCalled()
  })
})
