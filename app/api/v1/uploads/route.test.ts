import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { getCurrentAppUserMock, isTesterEmailAllowedMock, uploadthingPostMock, uploadthingGetMock } = vi.hoisted(
  () => ({
    getCurrentAppUserMock: vi.fn(),
    isTesterEmailAllowedMock: vi.fn(() => true),
    uploadthingPostMock: vi.fn(async () => Response.json({ ok: true })),
    uploadthingGetMock: vi.fn(async () => Response.json({ ok: true })),
  }),
)

vi.mock('@/lib/current-app-user', () => ({ getCurrentAppUser: getCurrentAppUserMock }))
vi.mock('@/lib/admin-config', () => ({ isTesterEmailAllowed: isTesterEmailAllowedMock }))

// Stand in for uploadthing's Effect-based runtime: `createRouteHandler` is
// mocked so tests never have to stand up its internal pipeline (which needs
// UPLOADTHING_TOKEN and Effect's HTTP layer). We only need it to prove (a)
// the router built from `.middleware()`/`.onUploadComplete()` doesn't throw
// at module load, and (b) our own POST wrapper delegates to it correctly.
vi.mock('uploadthing/next', () => ({
  createUploadthing: () => () => ({
    middleware: (middlewareFn: unknown) => ({
      onUploadComplete: (onUploadCompleteFn: unknown) => ({ middlewareFn, onUploadCompleteFn }),
    }),
  }),
  createRouteHandler: () => ({ GET: uploadthingGetMock, POST: uploadthingPostMock }),
}))

// Real checkRateLimit (in-memory fallback, no Upstash creds in tests) and
// rateLimitBucket, exactly like lib/mobile-api-guard.test.ts — the rate limit
// behavior is only meaningful if exercised for real.
const { POST, GET, resolveMobileUploadContext, mobileFileRouter } = await import('./route')

function uploadRequest(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest('https://example.com/api/v1/uploads', { method: 'POST', headers })
}

const creator = { id: 'user_1', email: 'creator@example.com', name: null, role: 'CREATOR' as const }

function resetMocks() {
  getCurrentAppUserMock.mockReset()
  isTesterEmailAllowedMock.mockReset().mockReturnValue(true)
  uploadthingPostMock.mockClear()
  uploadthingGetMock.mockClear()
}

describe('resolveMobileUploadContext (mobileContentUploader .middleware())', () => {
  beforeEach(resetMocks)

  it('rejects a request with no Authorization header', async () => {
    await expect(resolveMobileUploadContext({ req: uploadRequest() })).rejects.toThrow('Unauthorized')
    expect(getCurrentAppUserMock).not.toHaveBeenCalled()
  })

  it('rejects a cookie-only request even with a valid session', async () => {
    getCurrentAppUserMock.mockResolvedValue({ user: creator })

    await expect(
      resolveMobileUploadContext({ req: uploadRequest({ cookie: '__session=abc123' }) }),
    ).rejects.toThrow('Unauthorized')
  })

  it('rejects a non-CREATOR role', async () => {
    getCurrentAppUserMock.mockResolvedValue({ user: { ...creator, role: 'BRAND' } })

    await expect(
      resolveMobileUploadContext({ req: uploadRequest({ authorization: 'Bearer token' }) }),
    ).rejects.toThrow('allowlisted creator accounts')
  })

  it('rejects a non-allowlisted email', async () => {
    getCurrentAppUserMock.mockResolvedValue({ user: creator })
    isTesterEmailAllowedMock.mockReturnValue(false)

    await expect(
      resolveMobileUploadContext({ req: uploadRequest({ authorization: 'Bearer token' }) }),
    ).rejects.toThrow('allowlisted creator accounts')
  })

  it('resolves with the uploader id as metadata for an allowlisted creator', async () => {
    getCurrentAppUserMock.mockResolvedValue({ user: creator })
    isTesterEmailAllowedMock.mockReturnValue(true)

    const metadata = await resolveMobileUploadContext({ req: uploadRequest({ authorization: 'Bearer token' }) })

    expect(metadata).toEqual({ userId: 'user_1' })
  })
})

describe('mobileFileRouter.onUploadComplete', () => {
  it('records the uploader id from middleware metadata on the returned payload', async () => {
    const router = mobileFileRouter.mobileContentUploader as unknown as {
      onUploadCompleteFn: (args: {
        metadata: { userId: string }
        file: { ufsUrl: string; key: string }
      }) => Promise<{ uploadedBy: string; url: string; key: string }>
    }

    const result = await router.onUploadCompleteFn({
      metadata: { userId: 'user_1' },
      file: { ufsUrl: 'https://app.ufs.sh/f/abc', key: 'abc' },
    })

    expect(result).toEqual({ uploadedBy: 'user_1', url: 'https://app.ufs.sh/f/abc', key: 'abc' })
  })
})

describe('POST /api/v1/uploads', () => {
  beforeEach(resetMocks)

  it('lets an UploadThing completion callback through untouched, without ever resolving a user', async () => {
    const res = await POST(uploadRequest({ 'uploadthing-hook': 'callback' }))

    expect(res.status).toBe(200)
    expect(uploadthingPostMock).toHaveBeenCalledOnce()
    expect(getCurrentAppUserMock).not.toHaveBeenCalled()
  })

  it('lets an UploadThing error callback through untouched too', async () => {
    const res = await POST(uploadRequest({ 'uploadthing-hook': 'error' }))

    expect(res.status).toBe(200)
    expect(uploadthingPostMock).toHaveBeenCalledOnce()
    expect(getCurrentAppUserMock).not.toHaveBeenCalled()
  })

  it('delegates a request with no Authorization header straight to the real handler (unrate-limited, unauthenticated)', async () => {
    const res = await POST(uploadRequest())

    expect(res.status).toBe(200)
    expect(uploadthingPostMock).toHaveBeenCalledOnce()
    expect(getCurrentAppUserMock).not.toHaveBeenCalled()
  })

  it('delegates a Bearer request that resolves no app user, without rate limiting it', async () => {
    getCurrentAppUserMock.mockResolvedValue({ user: null })

    const res = await POST(uploadRequest({ authorization: 'Bearer token' }))

    expect(res.status).toBe(200)
    expect(uploadthingPostMock).toHaveBeenCalledOnce()
  })

  it('returns 429 once an authenticated creator exceeds the upload rate limit', async () => {
    // Distinct user id: the rate-limit store is a module-level singleton
    // shared across every test in this file, keyed by user id + IP — reusing
    // `creator.id` here would inherit call counts from earlier tests.
    getCurrentAppUserMock.mockResolvedValue({ user: { ...creator, id: 'user_upload_rate_limit_test' } })
    const req = () => uploadRequest({ authorization: 'Bearer token' })

    const responses: Response[] = []
    for (let i = 0; i < 16; i++) {
      responses.push(await POST(req()))
    }

    const statuses = responses.map(res => res.status)
    expect(statuses.slice(0, 15)).toEqual(Array(15).fill(200))
    expect(statuses[15]).toBe(429)
    expect(responses[15]?.headers.get('Retry-After')).toBeTruthy()
    expect(uploadthingPostMock).toHaveBeenCalledTimes(15)
  })
})

describe('GET /api/v1/uploads', () => {
  it('is exported untouched from createRouteHandler', () => {
    expect(GET).toBe(uploadthingGetMock)
  })
})
