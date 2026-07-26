import { beforeEach, describe, expect, it, vi } from 'vitest'

const { findUniqueMock, deleteMock } = vi.hoisted(() => ({
  findUniqueMock: vi.fn(),
  deleteMock: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  default: { device: { findUnique: findUniqueMock, delete: deleteMock } },
}))

vi.mock('@/lib/mobile-api-guard', () => ({
  withMobileApi: (_opts: unknown, handler: (ctx: unknown) => Promise<Response>) => handler,
}))

const { DELETE } = await import('./route')

const creatorA = { id: 'user_a', email: 'a@example.com', name: null, role: 'CREATOR' as const }

function ctx(token: string, user = creatorA) {
  return {
    req: new Request(`https://example.com/api/v1/devices/${token}`, { method: 'DELETE' }),
    user,
    context: { params: Promise.resolve({ token }) },
  }
}

describe('DELETE /api/v1/devices/:token', () => {
  beforeEach(() => {
    findUniqueMock.mockReset()
    deleteMock.mockReset()
  })

  it('unregisters a device owned by the caller', async () => {
    findUniqueMock.mockResolvedValue({ expoPushToken: 'tok_1', userId: 'user_a' })

    const res = await DELETE(ctx('tok_1') as never)

    expect(res.status).toBe(200)
    expect(deleteMock).toHaveBeenCalledWith({ where: { expoPushToken: 'tok_1' } })
  })

  it("refuses to unregister another user's device", async () => {
    findUniqueMock.mockResolvedValue({ expoPushToken: 'tok_1', userId: 'user_a' })
    const creatorB = { ...creatorA, id: 'user_b' }

    const res = await DELETE(ctx('tok_1', creatorB) as never)

    expect(res.status).toBe(404)
    expect(deleteMock).not.toHaveBeenCalled()
  })

  it('returns 404 for a nonexistent token', async () => {
    findUniqueMock.mockResolvedValue(null)

    const res = await DELETE(ctx('does_not_exist') as never)

    expect(res.status).toBe(404)
  })
})
