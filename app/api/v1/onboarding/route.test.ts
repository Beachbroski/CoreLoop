import { beforeEach, describe, expect, it, vi } from 'vitest'

const { findUniqueMock, createMock, getCurrentAppUserMock, currentUserMock, isTesterEmailAllowedMock } =
  vi.hoisted(() => ({
    findUniqueMock: vi.fn(),
    createMock: vi.fn(),
    getCurrentAppUserMock: vi.fn(),
    currentUserMock: vi.fn(),
    isTesterEmailAllowedMock: vi.fn(),
  }))

vi.mock('@/lib/prisma', () => ({
  default: { user: { findUnique: findUniqueMock, create: createMock } },
}))

vi.mock('@clerk/nextjs/server', () => ({ currentUser: currentUserMock }))
vi.mock('@/lib/current-app-user', () => ({ getCurrentAppUser: getCurrentAppUserMock }))
vi.mock('@/lib/admin-config', () => ({ isTesterEmailAllowed: isTesterEmailAllowedMock }))

// The guard has its own coverage in lib/mobile-api-guard.test.ts; bypass it
// here so these tests exercise only this route's logic.
vi.mock('@/lib/mobile-api-guard', () => ({
  withMobileAuthOnly: (_opts: unknown, handler: (ctx: unknown) => Promise<Response>) => handler,
}))

const { POST, NOT_INVITED_ERROR } = await import('./route')

const profile = {
  id: 'user_1',
  name: 'Ada Creator',
  email: 'ada@example.com',
  avatarUrl: null,
  bio: null,
  role: 'CREATOR' as const,
  stripeOnboarded: false,
}

function ctx() {
  return {
    req: new Request('https://example.com/api/v1/onboarding', { method: 'POST' }),
    clerkUserId: 'clerk_1',
  }
}

function clerkUser(overrides: Record<string, unknown> = {}) {
  return {
    firstName: 'Ada',
    lastName: 'Creator',
    imageUrl: 'https://img.example/a.png',
    primaryEmailAddressId: 'email_primary',
    emailAddresses: [
      { id: 'email_other', emailAddress: 'secondary@example.com' },
      { id: 'email_primary', emailAddress: 'ada@example.com' },
    ],
    ...overrides,
  }
}

describe('POST /api/v1/onboarding', () => {
  beforeEach(() => {
    findUniqueMock.mockReset()
    createMock.mockReset()
    getCurrentAppUserMock.mockReset()
    currentUserMock.mockReset()
    isTesterEmailAllowedMock.mockReset()
    isTesterEmailAllowedMock.mockReturnValue(true)
  })

  it('is idempotent — returns the existing account without creating another', async () => {
    getCurrentAppUserMock.mockResolvedValue({ user: { id: 'user_1' } })
    findUniqueMock.mockResolvedValue(profile)

    const res = await POST(ctx() as never)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.id).toBe('user_1')
    expect(createMock).not.toHaveBeenCalled()
  })

  it('creates a CREATOR account for a first-time mobile signup', async () => {
    getCurrentAppUserMock.mockResolvedValue({ user: null })
    currentUserMock.mockResolvedValue(clerkUser())
    createMock.mockResolvedValue(profile)

    const res = await POST(ctx() as never)
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.data.role).toBe('CREATOR')
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          clerkId: 'clerk_1',
          // The PRIMARY address, not emailAddresses[0].
          email: 'ada@example.com',
          role: 'CREATOR',
        }),
      }),
    )
  })

  it('refuses to create an account for an email that is not invited', async () => {
    getCurrentAppUserMock.mockResolvedValue({ user: null })
    currentUserMock.mockResolvedValue(clerkUser())
    isTesterEmailAllowedMock.mockReturnValue(false)

    const res = await POST(ctx() as never)
    const body = await res.json()

    expect(res.status).toBe(403)
    // Machine-readable so the app can show the waitlist screen specifically.
    expect(body.error).toBe(NOT_INVITED_ERROR)
    expect(createMock).not.toHaveBeenCalled()
  })

  it('400s when Clerk has no email for the identity', async () => {
    getCurrentAppUserMock.mockResolvedValue({ user: null })
    currentUserMock.mockResolvedValue(clerkUser({ emailAddresses: [], primaryEmailAddressId: null }))

    const res = await POST(ctx() as never)

    expect(res.status).toBe(400)
    expect(createMock).not.toHaveBeenCalled()
  })

  it('never rewrites the role of an existing brand account', async () => {
    getCurrentAppUserMock.mockResolvedValue({ user: { id: 'user_brand' } })
    findUniqueMock.mockResolvedValue({ ...profile, id: 'user_brand', role: 'BRAND' })

    const res = await POST(ctx() as never)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.role).toBe('BRAND')
    expect(createMock).not.toHaveBeenCalled()
  })
})
