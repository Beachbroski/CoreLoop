import { beforeEach, describe, expect, it, vi } from 'vitest'

const { findUniqueMock } = vi.hoisted(() => ({ findUniqueMock: vi.fn() }))

vi.mock('@/lib/prisma', () => ({ default: { user: { findUnique: findUniqueMock } } }))

vi.mock('@/lib/mobile-api-guard', () => ({
  withMobileApi: (_opts: unknown, handler: (ctx: unknown) => Promise<Response>) => handler,
}))

const { GET } = await import('./route')

const creator = { id: 'user_1', email: 'creator@example.com', name: null, role: 'CREATOR' as const }

function ctx() {
  return { req: new Request('https://example.com/api/v1/stripe/status'), user: creator }
}

describe('GET /api/v1/stripe/status', () => {
  beforeEach(() => {
    findUniqueMock.mockReset()
  })

  it('reflects the onboarded flag from the database', async () => {
    findUniqueMock.mockResolvedValue({ stripeOnboarded: true })

    const res = await GET(ctx() as never)
    const body = await res.json()

    expect(body.data).toEqual({ onboarded: true })
  })

  it('returns false when the user has not onboarded', async () => {
    findUniqueMock.mockResolvedValue({ stripeOnboarded: false })

    const res = await GET(ctx() as never)
    const body = await res.json()

    expect(body.data).toEqual({ onboarded: false })
  })
})
