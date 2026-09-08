import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  authMock,
  requireTesterApiUserMock,
  findUniqueMock,
  updateMock,
  accountsCreateMock,
  accountLinksCreateMock,
  getSiteUrlMock,
  checkRateLimitMock,
  getRequestIpMock,
  isTrustedOriginMock,
} = vi.hoisted(() => ({
  authMock: vi.fn(),
  requireTesterApiUserMock: vi.fn(),
  findUniqueMock: vi.fn(),
  updateMock: vi.fn(),
  accountsCreateMock: vi.fn(),
  accountLinksCreateMock: vi.fn(),
  getSiteUrlMock: vi.fn(),
  checkRateLimitMock: vi.fn(),
  getRequestIpMock: vi.fn(),
  isTrustedOriginMock: vi.fn(),
}))

vi.mock('@clerk/nextjs/server', () => ({ auth: authMock }))

vi.mock('@/lib/admin-api-guard', () => ({ requireTesterApiUser: requireTesterApiUserMock }))

vi.mock('@/lib/prisma', () => ({
  default: { user: { findUnique: findUniqueMock, update: updateMock } },
}))

vi.mock('@/lib/stripe', () => ({
  stripe: { accounts: { create: accountsCreateMock }, accountLinks: { create: accountLinksCreateMock } },
}))

vi.mock('@/lib/site-url', () => ({ getSiteUrl: getSiteUrlMock }))

vi.mock('@/lib/request-security', () => ({
  checkRateLimit: checkRateLimitMock,
  getRequestIp: getRequestIpMock,
  isTrustedOrigin: isTrustedOriginMock,
}))

const { POST } = await import('./route')

function req() {
  return new Request('https://creatordocks.com/api/stripe/onboard', { method: 'POST' })
}

describe('POST /api/stripe/onboard', () => {
  beforeEach(() => {
    authMock.mockReset()
    requireTesterApiUserMock.mockReset()
    findUniqueMock.mockReset()
    updateMock.mockReset()
    accountsCreateMock.mockReset()
    accountLinksCreateMock.mockReset()
    getSiteUrlMock.mockReset()
    checkRateLimitMock.mockReset()
    getRequestIpMock.mockReset()
    isTrustedOriginMock.mockReset()

    isTrustedOriginMock.mockReturnValue(true)
    requireTesterApiUserMock.mockResolvedValue({ response: null })
    authMock.mockResolvedValue({ userId: 'clerk_1' })
    findUniqueMock.mockResolvedValue({
      id: 'user_1',
      email: 'creator@example.com',
      role: 'CREATOR',
      stripeAccountId: null,
    })
    checkRateLimitMock.mockResolvedValue({ ok: true })
    getRequestIpMock.mockReturnValue('127.0.0.1')
    getSiteUrlMock.mockReturnValue('https://creatordocks.com')
  })

  it('never leaks internal error details to the client when Stripe fails (SEC-08)', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const internalDetail = 'No such account: acct_secret_internal_12345; api_key sk_live_should_not_leak'
    accountsCreateMock.mockRejectedValue(new Error(internalDetail))

    const res = await POST(req())
    const body = await res.json()
    const bodyText = JSON.stringify(body)

    expect(res.status).toBe(500)
    expect(bodyText).not.toContain('acct_secret_internal_12345')
    expect(bodyText).not.toContain('sk_live')
    expect(body.error).not.toBe(internalDetail)
    expect(typeof body.error).toBe('string')
    expect(body.error.length).toBeGreaterThan(0)

    // Full detail still goes to server-side logs, with route + user context for debugging.
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[POST /api/stripe/onboard]',
      'user=clerk_1',
      expect.any(Error),
    )

    consoleErrorSpy.mockRestore()
  })

  it('creates a new Stripe account and returns the onboarding url on success', async () => {
    accountsCreateMock.mockResolvedValue({ id: 'acct_new' })
    accountLinksCreateMock.mockResolvedValue({ url: 'https://connect.stripe.com/setup/acct_new' })

    const res = await POST(req())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.url).toBe('https://connect.stripe.com/setup/acct_new')
  })
})
