import { beforeEach, describe, expect, it, vi } from 'vitest'

const { authMock, getCurrentAppUserMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  getCurrentAppUserMock: vi.fn(),
}))

vi.mock('@clerk/nextjs/server', () => ({ auth: authMock }))
vi.mock('./current-app-user', () => ({ getCurrentAppUser: getCurrentAppUserMock }))

const { withMobileApi, withPublicMobileApi, withMobileAuthOnly, rateLimitBucket } = await import('./mobile-api-guard')
type MobileAuthedUser = import('./mobile-api-guard').MobileAuthedUser

function makeRequest(headers: Record<string, string> = {}): Request {
  return new Request('https://example.com/api/v1/me', { headers })
}

// `name` is nullable on MobileAuthedUser; typing it explicitly keeps the mock
// assignable to the handler signature.
const creatorUser: { id: string; email: string; name: string | null; role: 'CREATOR' } = {
  id: 'user_1',
  email: 'creator@example.com',
  name: 'Creator',
  role: 'CREATOR',
}

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

  // The header is what makes a 401 a challenge rather than a bare refusal
  // (RFC 9110 / W5-H2), and it is how the app tells "your session expired"
  // apart from "that request was wrong". Asserted on both the no-header and
  // bad-token paths because they exit through different branches.
  it('answers every 401 with a Bearer challenge', async () => {
    const route = withMobileApi({ rateLimit: { limit: 5, windowMs: 60_000 } }, vi.fn())

    const noHeader = await route(makeRequest())
    expect(noHeader.status).toBe(401)
    expect(noHeader.headers.get('www-authenticate')).toBe('Bearer realm="creatordocks"')

    authMock.mockResolvedValue({ userId: null })
    const badToken = await route(makeRequest({ authorization: 'Bearer expired.or.revoked' }))
    expect(badToken.status).toBe(401)
    expect(badToken.headers.get('www-authenticate')).toBe('Bearer realm="creatordocks"')
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
    const handler = vi.fn(async ({ user }: { user: MobileAuthedUser }) =>
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

describe('withMobileAuthOnly', () => {
  beforeEach(() => {
    authMock.mockReset()
    getCurrentAppUserMock.mockReset()
  })

  it('rejects a request with no Bearer token', async () => {
    const route = withMobileAuthOnly({ rateLimit: { limit: 5, windowMs: 60_000 } }, async () =>
      Response.json({ ok: true }),
    )

    const res = await route(makeRequest())

    expect(res.status).toBe(401)
  })

  it('rejects a cookie-only session, like the other v1 guards', async () => {
    authMock.mockResolvedValue({ userId: 'clerk_1' })
    const route = withMobileAuthOnly({ rateLimit: { limit: 5, windowMs: 60_000 } }, async () =>
      Response.json({ ok: true }),
    )

    const res = await route(makeRequest())

    expect(res.status).toBe(401)
  })

  // The whole point of this variant: withMobileApi 401s here, which would make
  // creating that missing row impossible from the app.
  it('runs the handler for an authenticated Clerk user with NO database row', async () => {
    authMock.mockResolvedValue({ userId: 'clerk_new' })
    getCurrentAppUserMock.mockResolvedValue({ userId: 'clerk_new', user: null, email: 'new@example.com' })

    const route = withMobileAuthOnly(
      { rateLimit: { limit: 5, windowMs: 60_000 } },
      async ({ clerkUserId }) => Response.json({ ok: true, clerkUserId }),
    )

    const res = await route(makeRequest({ authorization: 'Bearer token_new' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.clerkUserId).toBe('clerk_new')
  })

  it('rate limits per Clerk user', async () => {
    authMock.mockResolvedValue({ userId: 'clerk_rate_limited' })
    const route = withMobileAuthOnly({ rateLimit: { limit: 1, windowMs: 60_000 } }, async () =>
      Response.json({ ok: true }),
    )
    const req = () => makeRequest({ authorization: 'Bearer t' })

    const first = await route(req())
    const second = await route(req())

    expect(first.status).toBe(200)
    expect(second.status).toBe(429)
  })
})

describe('rateLimitBucket', () => {
  // The bug this guards against: one shared counter meant a handful of reads
  // exhausted the budget for the 5/min routes, so the first tap on "Connect
  // Stripe" or "Delete account" came back 429.
  it('gives each route and method its own bucket', () => {
    const get = rateLimitBucket(new Request('https://x.com/api/v1/me'))
    const del = rateLimitBucket(new Request('https://x.com/api/v1/me', { method: 'DELETE' }))
    const onboard = rateLimitBucket(new Request('https://x.com/api/v1/stripe/onboard', { method: 'POST' }))

    expect(new Set([get, del, onboard]).size).toBe(3)
  })

  // Without this, varying the id mints a fresh bucket per request and the
  // limit stops limiting anything.
  it('collapses resource ids so they cannot be used to mint new buckets', () => {
    const a = rateLimitBucket(new Request('https://x.com/api/v1/applications/clzq1234567890abcdefghij'))
    const b = rateLimitBucket(new Request('https://x.com/api/v1/applications/clzq0987654321zyxwvutsrq'))

    expect(a).toBe(b)
    expect(a).toContain(':id')
  })

  it('collapses Expo push tokens the same way', () => {
    const a = rateLimitBucket(
      new Request('https://x.com/api/v1/devices/ExponentPushToken%5Baaaaaaaaaaaaaaaaaaaaaa%5D', { method: 'DELETE' }),
    )
    const b = rateLimitBucket(
      new Request('https://x.com/api/v1/devices/ExponentPushToken%5Bbbbbbbbbbbbbbbbbbbbbbb%5D', { method: 'DELETE' }),
    )

    expect(a).toBe(b)
  })

  it('keeps sibling collections apart', () => {
    expect(rateLimitBucket(new Request('https://x.com/api/v1/applications'))).not.toBe(
      rateLimitBucket(new Request('https://x.com/api/v1/submissions')),
    )
  })
})
