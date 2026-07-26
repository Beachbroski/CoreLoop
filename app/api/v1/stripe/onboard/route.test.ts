import { beforeEach, describe, expect, it, vi } from 'vitest'

const { findUniqueMock, updateMock, accountsCreateMock, accountLinksCreateMock, getSiteUrlMock } = vi.hoisted(() => ({
  findUniqueMock: vi.fn(),
  updateMock: vi.fn(),
  accountsCreateMock: vi.fn(),
  accountLinksCreateMock: vi.fn(),
  getSiteUrlMock: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  default: { user: { findUnique: findUniqueMock, update: updateMock } },
}))

vi.mock('@/lib/stripe', () => ({
  stripe: { accounts: { create: accountsCreateMock }, accountLinks: { create: accountLinksCreateMock } },
}))

vi.mock('@/lib/site-url', () => ({ getSiteUrl: getSiteUrlMock }))

vi.mock('@/lib/mobile-api-guard', () => ({
  withMobileApi: (_opts: unknown, handler: (ctx: unknown) => Promise<Response>) => handler,
}))

const { POST } = await import('./route')

const creator = { id: 'user_1', email: 'creator@example.com', name: null, role: 'CREATOR' as const }

function ctx() {
  return { req: new Request('https://example.com/api/v1/stripe/onboard', { method: 'POST' }), user: creator }
}

describe('POST /api/v1/stripe/onboard', () => {
  beforeEach(() => {
    findUniqueMock.mockReset()
    updateMock.mockReset()
    accountsCreateMock.mockReset()
    accountLinksCreateMock.mockReset()
    getSiteUrlMock.mockReset()
    getSiteUrlMock.mockReturnValue('https://creatordocks.com')
  })

  it('creates a new Stripe account when the user has none yet', async () => {
    findUniqueMock.mockResolvedValue({ stripeAccountId: null, email: 'creator@example.com' })
    accountsCreateMock.mockResolvedValue({ id: 'acct_new' })
    accountLinksCreateMock.mockResolvedValue({ url: 'https://connect.stripe.com/setup/acct_new' })

    const res = await POST(ctx() as never)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.url).toBe('https://connect.stripe.com/setup/acct_new')
    expect(accountsCreateMock).toHaveBeenCalledOnce()
    expect(updateMock).toHaveBeenCalledWith({ where: { id: 'user_1' }, data: { stripeAccountId: 'acct_new' } })
  })

  it('reuses an existing Stripe account instead of creating a new one', async () => {
    findUniqueMock.mockResolvedValue({ stripeAccountId: 'acct_existing', email: 'creator@example.com' })
    accountLinksCreateMock.mockResolvedValue({ url: 'https://connect.stripe.com/setup/acct_existing' })

    const res = await POST(ctx() as never)

    expect(res.status).toBe(200)
    expect(accountsCreateMock).not.toHaveBeenCalled()
    expect(accountLinksCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({ account: 'acct_existing' }),
    )
  })

  it('returns 500 when the site URL is not configured', async () => {
    getSiteUrlMock.mockReturnValue(null)

    const res = await POST(ctx() as never)

    expect(res.status).toBe(500)
    expect(findUniqueMock).not.toHaveBeenCalled()
  })
})
