import { beforeEach, describe, expect, it, vi } from 'vitest'

const { authMock, getCurrentAppUserMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  getCurrentAppUserMock: vi.fn(),
}))

vi.mock('@clerk/nextjs/server', () => ({ auth: authMock }))
vi.mock('./current-app-user', () => ({ getCurrentAppUser: getCurrentAppUserMock }))

const { withMobileApi, withPublicMobileApi } = await import('./mobile-api-guard')

function makeRequest(headers: Record<string, string> = {}): Request {
  return new Request('https://example.com/api/v1/me', { headers })
}

const creatorUser = { id: 'user_1', email: 'creator@example.com', name: 'Creator', role: 'CREATOR' as const }

describe('withMobileApi', () => {
  beforeEach(() => {
    authMock.mockReset()
    getCurrentAppUserMock.mockReset()
  })

  it('rejects a request with no Authorization header', async () => {
    const handler = vi.fn()
    const route = withMobileApi({ rateLimit: { limit: 5, windowMs: 60_000 } }, handler)

    const res = await route(makeRequest())

    expect(res.status).toBe(401)
    expect(handler).not.toHaveBeenCalled()
  })

  it('rejects a cookie-only request (Authorization header missing) even with a valid Clerk session', async () => {
    authMock.mockResolvedValue({ userId: 'clerk_1' })
    getCurrentAppUserMock.mockResolvedValue({ user: creatorUser })
    const handler = vi.fn()
    const route = withMobileApi({ rateLimit: { limit: 5, windowMs: 60_000 } }, handler)

    const res = await route(makeRequest())

    expect(res.status).toBe(401)
    expect(handler).not.toHaveBeenCalled()
  })

  it('rejects when Clerk auth() resolves no userId despite a Bearer header', async () => {
    authMock.mockResolvedValue({ userId: null })
    const handler = vi.fn()
    const route = withMobileApi({ rateLimit: { limit: 5, windowMs: 60_000 } }, handler)

    const res = await route(makeRequest({ authorization: 'Bearer expired-token' }))

    expect(res.status).toBe(401)
    expect(handler).not.toHaveBeenCalled()
  })

  it('rejects when no DB user resolves for an authenticated Clerk session', async () => {
    authMock.mockResolvedValue({ userId: 'clerk_1' })
    getCurrentAppUserMock.mockResolvedValue({ user: null })
    const handler = vi.fn()
    const route = withMobileApi({ rateLimit: { limit: 5, windowMs: 60_000 } }, handler)

    const res = await route(makeRequest({ authorization: 'Bearer token' }))

    expect(res.status).toBe(401)
    expect(handler).not.toHaveBeenCalled()
  })

  it('rejects a role mismatch with 403', async () => {
    authMock.mockResolvedValue({ userId: 'clerk_1' })
    getCurrentAppUserMock.mockResolvedValue({ user: { ...creatorUser, role: 'BRAND' } })
    const handler = vi.fn()
    const route = withMobileApi({ rateLimit: { limit: 5, windowMs: 60_000 }, role: 'CREATOR' }, handler)

    const res = await route(makeRequest({ authorization: 'Bearer token' }))

    expect(res.status).toBe(403)
    expect(handler).not.toHaveBeenCalled()
  })

  it('calls the handler and returns its response when everything checks out', async () => {
    authMock.mockResolvedValue({ userId: 'clerk_1' })
    getCurrentAppUserMock.mockResolvedValue({ user: creatorUser })
    const handler = vi.fn(async ({ user }: { user: typeof creatorUser }) =>
      Response.json({ success: true, data: { id: user.id } }),
    )
    const route = withMobileApi({ rateLimit: { limit: 5, windowMs: 60_000 }, role: 'CREATOR' }, handler)

    const res = await route(makeRequest({ authorization: 'Bearer token' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ success: true, data: { id: 'user_1' } })
    expect(handler).toHaveBeenCalledOnce()
  })

  it('returns 429 once the rate limit is exceeded', async () => {
    // Distinct user id: rateLimitStore is a module-level singleton shared by
    // every test in this file, keyed by `user.id` + IP — reusing creatorUser
    // here would inherit call counts from earlier tests in this describe block.
    const rateLimitedUser = { ...creatorUser, id: 'user_rate_limit_test' }
    authMock.mockResolvedValue({ userId: 'clerk_rate_limit_test' })
    getCurrentAppUserMock.mockResolvedValue({ user: rateLimitedUser })
    const handler = vi.fn(async () => Response.json({ success: true, data: {} }))
    const route = withMobileApi({ rateLimit: { limit: 1, windowMs: 60_000 } }, handler)
    const req = () => makeRequest({ authorization: 'Bearer token' })

    const first = await route(req())
    const second = await route(req())

    expect(first.status).toBe(200)
    expect(second.status).toBe(429)
    expect(second.headers.get('Retry-After')).toBeTruthy()
    expect(handler).toHaveBeenCalledOnce()
  })

  it('returns a generic 500 and does not leak the underlying error message', async () => {
    authMock.mockResolvedValue({ userId: 'clerk_1' })
    getCurrentAppUserMock.mockResolvedValue({ user: creatorUser })
    const handler = vi.fn(async () => {
      throw new Error('super secret internal detail')
    })
    const route = withMobileApi({ rateLimit: { limit: 5, windowMs: 60_000 } }, handler)

    const res = await route(makeRequest({ authorization: 'Bearer token' }))
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body.error).not.toContain('super secret internal detail')
  })
})

describe('withPublicMobileApi', () => {
  it('calls the handler without requiring auth', async () => {
    const handler = vi.fn(async () => Response.json({ success: true, data: { ok: true } }))
    const route = withPublicMobileApi({ limit: 5, windowMs: 60_000 }, handler)

    const res = await route(makeRequest())

    expect(res.status).toBe(200)
    expect(handler).toHaveBeenCalledOnce()
  })

  it('rate limits by IP once the limit is exceeded', async () => {
    const handler = vi.fn(async () => Response.json({ success: true, data: {} }))
    const route = withPublicMobileApi({ limit: 1, windowMs: 60_000 }, handler)
    const req = () => makeRequest({ 'x-forwarded-for': '203.0.113.9' })

    const first = await route(req())
    const second = await route(req())

    expect(first.status).toBe(200)
    expect(second.status).toBe(429)
  })
})
