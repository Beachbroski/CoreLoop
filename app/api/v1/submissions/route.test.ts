import { beforeEach, describe, expect, it, vi } from 'vitest'

const { applicationFindUniqueMock, submissionCreateMock, submissionFindManyMock, submissionCountMock } = vi.hoisted(() => ({
  applicationFindUniqueMock: vi.fn(),
  submissionCreateMock: vi.fn(),
  submissionFindManyMock: vi.fn(),
  submissionCountMock: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  default: {
    application: { findUnique: applicationFindUniqueMock },
    submission: { create: submissionCreateMock, findMany: submissionFindManyMock, count: submissionCountMock },
  },
}))

vi.mock('@/lib/mobile-api-guard', () => ({
  withMobileApi: (_opts: unknown, handler: (ctx: unknown) => Promise<Response>) => handler,
}))

const { POST, GET } = await import('./route')

const creator = { id: 'user_1', email: 'creator@example.com', name: null, role: 'CREATOR' as const }
const validBody = { applicationId: 'app_1', contentUrl: 'https://tiktok.com/@creator/video/123' }

function postCtx(body: unknown) {
  return {
    req: new Request('https://example.com/api/v1/submissions', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
    }),
    user: creator,
  }
}

const dbSubmission = {
  id: 'sub_1',
  applicationId: 'app_1',
  contentUrl: validBody.contentUrl,
  caption: null,
  notes: null,
  status: 'PENDING',
  reviewNote: null,
  createdAt: new Date('2026-07-01T00:00:00.000Z'),
  application: { id: 'app_1', campaign: { id: 'camp_1', title: 'Summer glow-up' } },
}

describe('POST /api/v1/submissions', () => {
  beforeEach(() => {
    applicationFindUniqueMock.mockReset()
    submissionCreateMock.mockReset()
  })

  it('returns 404 for an application that does not belong to the caller', async () => {
    applicationFindUniqueMock.mockResolvedValue({ id: 'app_1', creatorId: 'someone_else', status: 'ACCEPTED' })

    const res = await POST(postCtx(validBody) as never)

    expect(res.status).toBe(404)
    expect(submissionCreateMock).not.toHaveBeenCalled()
  })

  it('rejects submitting against a non-ACCEPTED application', async () => {
    applicationFindUniqueMock.mockResolvedValue({ id: 'app_1', creatorId: 'user_1', status: 'PENDING' })

    const res = await POST(postCtx(validBody) as never)

    expect(res.status).toBe(400)
  })

  it('creates the submission on success', async () => {
    applicationFindUniqueMock.mockResolvedValue({ id: 'app_1', creatorId: 'user_1', status: 'ACCEPTED' })
    submissionCreateMock.mockResolvedValue(dbSubmission)

    const res = await POST(postCtx(validBody) as never)
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.data.id).toBe('sub_1')
    expect(submissionCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ creatorId: 'user_1' }) }),
    )
  })
})

describe('GET /api/v1/submissions', () => {
  beforeEach(() => {
    submissionFindManyMock.mockReset()
    submissionCountMock.mockReset()
  })

  it("only queries the caller's own submissions", async () => {
    submissionFindManyMock.mockResolvedValue([])
    submissionCountMock.mockResolvedValue(0)

    await GET({ req: new Request('https://example.com/api/v1/submissions'), user: creator } as never)

    expect(submissionFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { creatorId: 'user_1' } }),
    )
  })
})
