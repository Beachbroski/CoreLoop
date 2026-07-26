import { beforeEach, describe, expect, it, vi } from 'vitest'

const { findUniqueMock, updateMock } = vi.hoisted(() => ({
  findUniqueMock: vi.fn(),
  updateMock: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  default: { user: { findUnique: findUniqueMock, update: updateMock } },
}))

// The guard itself is covered by lib/mobile-api-guard.test.ts. Here we bypass
// it with a passthrough so these tests exercise only this route's own logic.
vi.mock('@/lib/mobile-api-guard', () => ({
  withMobileApi: (_opts: unknown, handler: (ctx: unknown) => Promise<Response>) => handler,
}))

const { GET, PATCH } = await import('./route')

const dbUser = {
  id: 'user_1',
  name: 'Jane Creator',
  email: 'jane@example.com',
  avatarUrl: null,
  bio: null,
  role: 'CREATOR' as const,
  stripeOnboarded: false,
}

function patchRequest(body: unknown): Request {
  return new Request('https://example.com/api/v1/me', {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

describe('GET /api/v1/me', () => {
  beforeEach(() => {
    findUniqueMock.mockReset()
    updateMock.mockReset()
  })

  it('returns the caller\'s own profile, shaped by meResponseSchema', async () => {
    findUniqueMock.mockResolvedValue(dbUser)

    const res = await GET({ req: new Request('https://example.com/api/v1/me'), user: dbUser } as never)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ success: true, data: dbUser })
    expect(findUniqueMock).toHaveBeenCalledWith({ where: { id: 'user_1' }, select: expect.any(Object) })
  })

  it('returns 404 if the profile no longer exists', async () => {
    findUniqueMock.mockResolvedValue(null)

    const res = await GET({ req: new Request('https://example.com/api/v1/me'), user: dbUser } as never)

    expect(res.status).toBe(404)
  })
})

describe('PATCH /api/v1/me', () => {
  beforeEach(() => {
    findUniqueMock.mockReset()
    updateMock.mockReset()
  })

  it('updates name and bio and returns the shaped profile', async () => {
    updateMock.mockResolvedValue({ ...dbUser, name: 'New Name', bio: 'New bio' })

    const res = await PATCH({ req: patchRequest({ name: 'New Name', bio: 'New bio' }), user: dbUser } as never)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.name).toBe('New Name')
    expect(updateMock).toHaveBeenCalledWith({
      where: { id: 'user_1' },
      data: { name: 'New Name', bio: 'New bio' },
      select: expect.any(Object),
    })
  })

  it('rejects an invalid body with 400 and does not touch the database', async () => {
    const res = await PATCH({ req: patchRequest({ name: '' }), user: dbUser } as never)

    expect(res.status).toBe(400)
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('rejects a bio over the length limit', async () => {
    const res = await PATCH({ req: patchRequest({ bio: 'a'.repeat(501) }), user: dbUser } as never)

    expect(res.status).toBe(400)
    expect(updateMock).not.toHaveBeenCalled()
  })
})
