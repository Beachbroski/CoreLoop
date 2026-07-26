import { beforeEach, describe, expect, it, vi } from 'vitest'

const { upsertMock } = vi.hoisted(() => ({ upsertMock: vi.fn() }))

vi.mock('@/lib/prisma', () => ({ default: { device: { upsert: upsertMock } } }))

vi.mock('@/lib/mobile-api-guard', () => ({
  withMobileApi: (_opts: unknown, handler: (ctx: unknown) => Promise<Response>) => handler,
}))

const { POST } = await import('./route')

const creator = { id: 'user_1', email: 'creator@example.com', name: null, role: 'CREATOR' as const }

function ctx(body: unknown) {
  return {
    req: new Request('https://example.com/api/v1/devices', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
    }),
    user: creator,
  }
}

describe('POST /api/v1/devices', () => {
  beforeEach(() => {
    upsertMock.mockReset()
  })

  it('upserts by token, re-pointing an existing device at the current user', async () => {
    upsertMock.mockResolvedValue({})

    const res = await POST(ctx({ expoPushToken: 'ExponentPushToken[abc]', platform: 'ios' }) as never)

    expect(res.status).toBe(200)
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { expoPushToken: 'ExponentPushToken[abc]' },
        create: expect.objectContaining({ userId: 'user_1' }),
        update: expect.objectContaining({ userId: 'user_1' }),
      }),
    )
  })

  it('rejects an invalid platform', async () => {
    const res = await POST(ctx({ expoPushToken: 'ExponentPushToken[abc]', platform: 'web' }) as never)

    expect(res.status).toBe(400)
    expect(upsertMock).not.toHaveBeenCalled()
  })
})
