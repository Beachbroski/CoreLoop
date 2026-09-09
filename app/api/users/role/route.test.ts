import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * PATCH /api/users/role — the endpoint that decides whether an account is a
 * BRAND (holds payment methods) or a CREATOR (receives payouts).
 *
 * Two live defects this file was opened for:
 *
 *  1. Account takeover. The rebind branch read `emailAddresses[0]` instead of
 *     the address Clerk marks primary, and never checked that the address was
 *     verified. Clerk's array is unordered and includes unverified addresses,
 *     so attaching a victim's address to your own Clerk account was enough to
 *     have their User row rebound to your `clerkId` — with a role of your
 *     choosing.
 *  2. Over-return. All three success branches returned the raw User row,
 *     including `clerkId` and `stripeAccountId`. packages/shared/src/user.ts
 *     states the opposite rule for the same data: those never leave the server.
 *
 * Mocking follows app/api/applications/[id]/route.test.ts: Prisma, Clerk, the
 * rate limiter and the origin check are mocked. `getCurrentAppUser` is mocked
 * too — deliberately, because it performs an email-matched rebind of its own
 * (lib/current-app-user.ts:26-37) that this route does not control; leaving it
 * live would make these assertions describe that helper rather than this
 * handler.
 *
 * The Prisma mock honours `select`, exactly as Prisma does. That is what gives
 * the leak assertions teeth: a handler that omits `select` gets the whole
 * seeded row back — `clerkId` and `stripeAccountId` included — and fails.
 */

const {
  currentUserMock,
  getCurrentAppUserMock,
  isTesterEmailAllowedMock,
  checkRateLimitMock,
  isTrustedOriginMock,
  prismaMock,
} = vi.hoisted(() => ({
  currentUserMock: vi.fn(),
  getCurrentAppUserMock: vi.fn(),
  isTesterEmailAllowedMock: vi.fn(),
  checkRateLimitMock: vi.fn(),
  isTrustedOriginMock: vi.fn(),
  prismaMock: {
    user: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn() },
    campaign: { count: vi.fn() },
    application: { count: vi.fn() },
  },
}))

vi.mock('@clerk/nextjs/server', () => ({ auth: vi.fn(), currentUser: currentUserMock }))
vi.mock('@/lib/prisma', () => ({ default: prismaMock }))
vi.mock('@/lib/current-app-user', () => ({ getCurrentAppUser: getCurrentAppUserMock }))
vi.mock('@/lib/request-security', () => ({
  checkRateLimit: checkRateLimitMock,
  getRequestIp: () => '203.0.113.7',
  isTrustedOrigin: isTrustedOriginMock,
}))
vi.mock('@/lib/admin-config', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/admin-config')>()
  return { ...actual, isTesterEmailAllowed: isTesterEmailAllowedMock }
})

const { PATCH } = await import('./route')

/** The columns the /api/v1 contract allows out. Written literally on purpose. */
const ALLOWED_COLUMNS = [
  'id',
  'name',
  'email',
  'avatarUrl',
  'bio',
  'role',
  'stripeOnboarded',
] as const

const ALLOWED_SELECT = {
  id: true,
  name: true,
  email: true,
  avatarUrl: true,
  bio: true,
  role: true,
  stripeOnboarded: true,
} as const

const CALLER_CLERK_ID = 'clerk_caller'

type UserRow = {
  id: string
  clerkId: string
  email: string
  role: 'BRAND' | 'CREATOR' | 'ADMIN'
  name: string | null
  avatarUrl: string | null
  bio: string | null
  stripeAccountId: string | null
  stripeOnboarded: boolean
  createdAt: Date
  updatedAt: Date
}

/** A full User row — every column the pre-fix handler used to hand back. */
function userRow(overrides: Partial<UserRow> = {}): UserRow {
  return {
    id: 'user_caller',
    clerkId: CALLER_CLERK_ID,
    email: 'caller@example.com',
    role: 'CREATOR',
    name: 'Caller Person',
    avatarUrl: null,
    bio: 'Beauty creator in Austin.',
    stripeAccountId: 'acct_caller_1',
    stripeOnboarded: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  }
}

/** Somebody else's account, sitting there under a known email address. */
const VICTIM = userRow({
  id: 'user_victim',
  clerkId: 'clerk_victim_secret',
  email: 'victim@example.com',
  role: 'BRAND',
  name: 'Victim Brand',
  bio: 'Runs the paid campaigns.',
  stripeAccountId: 'acct_victim_9',
})

/** Applies a Prisma `select` the way Prisma itself would. Never mutates. */
function project(row: UserRow | null, select?: Record<string, boolean>) {
  if (!row) return null
  if (!select) return { ...row }

  return Object.fromEntries(Object.entries(row).filter(([column]) => select[column] === true))
}

function clerkEmail(id: string, address: string, status: string | null) {
  return {
    id,
    emailAddress: address,
    verification: status === null ? null : { status },
    linkedTo: [],
  }
}

function clerkAccount(
  emailAddresses: ReturnType<typeof clerkEmail>[],
  primaryEmailAddressId: string | null,
) {
  return {
    id: CALLER_CLERK_ID,
    primaryEmailAddressId,
    emailAddresses,
    firstName: 'Ada',
    lastName: 'Lovelace',
    imageUrl: 'https://images.example.com/ada.png',
  }
}

/** Rows the Prisma mock can find. Replaced per test, never mutated. */
let seededRows: readonly UserRow[] = []

function seedRows(rows: readonly UserRow[]) {
  seededRows = rows
}

function patch(body: unknown): Promise<Response> {
  const req = new Request('https://www.creatordocks.com/api/users/role', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', origin: 'https://www.creatordocks.com' },
    body: JSON.stringify(body),
  })

  return PATCH(req)
}

/** The last arguments the handler passed to a Prisma write. */
function lastCallArgs(fn: { mock: { calls: unknown[][] } }) {
  return fn.mock.calls.at(-1)?.[0] as {
    where?: Record<string, unknown>
    data?: Record<string, unknown>
    select?: Record<string, boolean>
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  seedRows([])

  isTrustedOriginMock.mockReturnValue(true)
  isTesterEmailAllowedMock.mockReturnValue(true)
  checkRateLimitMock.mockResolvedValue({ ok: true, retryAfterSeconds: 0 })
  getCurrentAppUserMock.mockResolvedValue({
    userId: CALLER_CLERK_ID,
    user: null,
    email: 'caller@example.com',
  })
  currentUserMock.mockResolvedValue(null)

  prismaMock.campaign.count.mockResolvedValue(0)
  prismaMock.application.count.mockResolvedValue(0)

  prismaMock.user.findUnique.mockImplementation(
    async ({
      where,
      select,
    }: {
      where: { clerkId?: string; email?: string }
      select?: Record<string, boolean>
    }) => {
      const found =
        seededRows.find(
          row =>
            (where.clerkId !== undefined && row.clerkId === where.clerkId) ||
            (where.email !== undefined && row.email === where.email),
        ) ?? null

      return project(found, select)
    },
  )

  prismaMock.user.update.mockImplementation(
    async ({
      where,
      data,
      select,
    }: {
      where: { id: string }
      data: Partial<UserRow>
      select?: Record<string, boolean>
    }) => {
      const target = seededRows.find(row => row.id === where.id)
      if (!target) throw new Error(`test seeded no row with id ${where.id}`)

      return project({ ...target, ...data }, select)
    },
  )

  prismaMock.user.create.mockImplementation(
    async ({ data, select }: { data: Partial<UserRow>; select?: Record<string, boolean> }) =>
      project(userRow({ id: 'user_new', stripeAccountId: null, stripeOnboarded: false, ...data }), select),
  )
})

describe('PATCH /api/users/role — access control', () => {
  it('rejects an untrusted origin with 403 and touches nothing', async () => {
    isTrustedOriginMock.mockReturnValue(false)

    const res = await patch({ role: 'BRAND' })

    expect(res.status).toBe(403)
    expect((await res.json()).error).toBe('Invalid request origin')
    expect(getCurrentAppUserMock).not.toHaveBeenCalled()
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled()
    expect(prismaMock.user.update).not.toHaveBeenCalled()
    expect(prismaMock.user.create).not.toHaveBeenCalled()
  })

  it('rejects an unauthenticated caller with 401', async () => {
    getCurrentAppUserMock.mockResolvedValue({ userId: null, user: null, email: null })

    const res = await patch({ role: 'CREATOR' })

    expect(res.status).toBe(401)
    expect((await res.json()).error).toBe('Unauthorized')
    expect(prismaMock.user.update).not.toHaveBeenCalled()
    expect(prismaMock.user.create).not.toHaveBeenCalled()
  })

  it('rejects an email outside the tester allowlist with 403', async () => {
    isTesterEmailAllowedMock.mockReturnValue(false)

    const res = await patch({ role: 'BRAND' })

    expect(res.status).toBe(403)
    expect((await res.json()).error).toBe('Forbidden')
    expect(checkRateLimitMock).not.toHaveBeenCalled()
    expect(prismaMock.user.update).not.toHaveBeenCalled()
  })

  it('returns 429 with Retry-After once the rate limit is exceeded', async () => {
    checkRateLimitMock.mockResolvedValue({ ok: false, retryAfterSeconds: 41 })

    const res = await patch({ role: 'BRAND' })

    expect(res.status).toBe(429)
    expect(res.headers.get('retry-after')).toBe('41')
    expect((await res.json()).error).toBe(
      'Too many role update attempts. Please try again shortly.',
    )
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled()
    expect(prismaMock.user.update).not.toHaveBeenCalled()
  })

  it('rate-limits per caller and per IP, ten attempts a minute', async () => {
    await patch({ role: 'BRAND' })

    expect(checkRateLimitMock).toHaveBeenCalledWith(`users:role:${CALLER_CLERK_ID}:203.0.113.7`, {
      limit: 10,
      windowMs: 60_000,
    })
  })
})

describe('PATCH /api/users/role — request validation', () => {
  it.each([
    ['a missing role', {}],
    ['an unknown role', { role: 'SUPERADMIN' }],
    ['ADMIN, which is not self-assignable', { role: 'ADMIN' }],
    ['a lowercase role', { role: 'brand' }],
    ['a non-string role', { role: 7 }],
    ['a null role', { role: null }],
  ])('rejects %s with 400 and writes nothing', async (_label, body) => {
    const res = await patch(body)

    expect(res.status).toBe(400)
    expect(prismaMock.user.update).not.toHaveBeenCalled()
    expect(prismaMock.user.create).not.toHaveBeenCalled()
  })
})

describe('PATCH /api/users/role — an existing account switches role', () => {
  it('promotes a CREATOR to BRAND and sends them to /brand', async () => {
    seedRows([userRow({ role: 'CREATOR' })])

    const res = await patch({ role: 'BRAND' })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data.role).toBe('BRAND')
    expect(body.redirectTo).toBe('/brand')
    expect(lastCallArgs(prismaMock.user.update).where).toEqual({ id: 'user_caller' })
    expect(lastCallArgs(prismaMock.user.update).data).toEqual({ role: 'BRAND' })
  })

  it('switches a BRAND to CREATOR and sends them to /creator', async () => {
    seedRows([userRow({ role: 'BRAND' })])

    const res = await patch({ role: 'CREATOR' })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.role).toBe('CREATOR')
    expect(body.redirectTo).toBe('/creator')
  })

  it('refuses to change an ADMIN account (409)', async () => {
    seedRows([userRow({ role: 'ADMIN' })])

    const res = await patch({ role: 'BRAND' })

    expect(res.status).toBe(409)
    expect((await res.json()).error).toBe('Admin accounts cannot change role here')
    expect(prismaMock.user.update).not.toHaveBeenCalled()
  })

  it('refuses once the account has run a campaign (409)', async () => {
    seedRows([userRow({ role: 'BRAND' })])
    prismaMock.campaign.count.mockResolvedValue(1)

    const res = await patch({ role: 'CREATOR' })

    expect(res.status).toBe(409)
    expect((await res.json()).error).toBe('Role cannot be changed after activity has begun')
    expect(prismaMock.user.update).not.toHaveBeenCalled()
  })

  it('refuses once the account has applied to a campaign (409)', async () => {
    seedRows([userRow({ role: 'CREATOR' })])
    prismaMock.application.count.mockResolvedValue(1)

    const res = await patch({ role: 'BRAND' })

    expect(res.status).toBe(409)
    expect(prismaMock.user.update).not.toHaveBeenCalled()
  })
})

describe('PATCH /api/users/role — a brand-new account', () => {
  it('creates the row against the verified primary address', async () => {
    currentUserMock.mockResolvedValue(
      clerkAccount([clerkEmail('idem_1', 'newcomer@example.com', 'verified')], 'idem_1'),
    )

    const res = await patch({ role: 'CREATOR' })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.role).toBe('CREATOR')
    expect(body.redirectTo).toBe('/creator')
    expect(lastCallArgs(prismaMock.user.create).data).toEqual({
      clerkId: CALLER_CLERK_ID,
      email: 'newcomer@example.com',
      name: 'Ada Lovelace',
      avatarUrl: 'https://images.example.com/ada.png',
      role: 'CREATOR',
    })
  })

  it('returns 400 when Clerk holds no address at all', async () => {
    currentUserMock.mockResolvedValue(clerkAccount([], null))

    const res = await patch({ role: 'BRAND' })

    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('Unable to determine account email')
    expect(prismaMock.user.create).not.toHaveBeenCalled()
  })

  it('returns 401 when Clerk has no user for the session', async () => {
    currentUserMock.mockResolvedValue(null)

    const res = await patch({ role: 'BRAND' })

    expect(res.status).toBe(401)
    expect(prismaMock.user.create).not.toHaveBeenCalled()
  })
})

/**
 * DEFECT 1. Each case below fails against the pre-fix handler, which read
 * `emailAddresses[0]` and never looked at `verification`.
 */
describe('PATCH /api/users/role — rebinding an existing row to this Clerk identity', () => {
  it('rebinds on a verified primary address and applies the requested role', async () => {
    seedRows([VICTIM])
    currentUserMock.mockResolvedValue(
      clerkAccount([clerkEmail('idem_p', VICTIM.email, 'verified')], 'idem_p'),
    )

    const res = await patch({ role: 'CREATOR' })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.id).toBe(VICTIM.id)
    expect(body.data.role).toBe('CREATOR')
    expect(body.redirectTo).toBe('/creator')
    expect(lastCallArgs(prismaMock.user.update).where).toEqual({ id: VICTIM.id })
    expect(lastCallArgs(prismaMock.user.update).data).toEqual({
      clerkId: CALLER_CLERK_ID,
      name: 'Ada Lovelace',
      avatarUrl: 'https://images.example.com/ada.png',
      role: 'CREATOR',
    })
  })

  /**
   * Clerk's array order is not guaranteed, and index 0 is not the primary
   * address. The pre-fix handler looked up `first@example.com` here.
   */
  it('looks the account up by the primary address, not by index 0', async () => {
    seedRows([VICTIM])
    currentUserMock.mockResolvedValue(
      clerkAccount(
        [
          clerkEmail('idem_extra', 'first@example.com', 'verified'),
          clerkEmail('idem_primary', VICTIM.email, 'verified'),
        ],
        'idem_primary',
      ),
    )

    const res = await patch({ role: 'BRAND' })

    expect(res.status).toBe(200)
    const emailLookups = prismaMock.user.findUnique.mock.calls
      .map(call => (call[0] as { where: { email?: string } }).where.email)
      .filter(Boolean)
    expect(emailLookups).toEqual([VICTIM.email])
    expect(lastCallArgs(prismaMock.user.update).where).toEqual({ id: VICTIM.id })
  })

  it.each([
    ['unverified', 'unverified'],
    ['failed', 'failed'],
    ['expired', 'expired'],
    ['transferable', 'transferable'],
    ['absent (verification is null)', null],
  ])(
    'refuses to rebind when the primary address is %s',
    async (_label, status: string | null) => {
      seedRows([VICTIM])
      currentUserMock.mockResolvedValue(
        clerkAccount([clerkEmail('idem_p', VICTIM.email, status)], 'idem_p'),
      )

      const res = await patch({ role: 'BRAND' })
      const serialized = JSON.stringify(await res.json())

      expect(res.status).toBe(403)
      expect(prismaMock.user.update).not.toHaveBeenCalled()
      expect(prismaMock.user.create).not.toHaveBeenCalled()
      // The refusal must not double as a peek at the account it protected.
      expect(serialized).not.toContain(VICTIM.clerkId)
      expect(serialized).not.toContain(VICTIM.stripeAccountId as string)
      expect(serialized).not.toContain(VICTIM.bio as string)
    },
  )

  /**
   * The whole attack in one test: an attacker attaches the victim's address to
   * their own Clerk account, leaves it unverified, and asks to become a BRAND.
   */
  it('leaves the victim account untouched when an unverified address claims it', async () => {
    seedRows([VICTIM])
    currentUserMock.mockResolvedValue(
      clerkAccount(
        [
          clerkEmail('idem_victim', VICTIM.email, 'unverified'),
          clerkEmail('idem_own', 'attacker@example.com', 'verified'),
        ],
        'idem_victim',
      ),
    )

    const res = await patch({ role: 'BRAND' })
    const body = await res.json()

    expect(res.status).toBe(403)
    expect(body).not.toHaveProperty('data')
    expect(body.error).toContain('Verify your email address')
    expect(prismaMock.user.update).not.toHaveBeenCalled()
  })
})

/**
 * DEFECT 2. The Prisma mock honours `select`, so a handler that returns the raw
 * row fails these — which is exactly what shipped.
 */
describe('PATCH /api/users/role — no response carries clerkId or stripeAccountId', () => {
  it('returns only the contract columns when an existing account switches role', async () => {
    seedRows([userRow({ role: 'CREATOR' })])

    const res = await patch({ role: 'BRAND' })
    const body = await res.json()

    expect(Object.keys(body.data).sort()).toEqual([...ALLOWED_COLUMNS].sort())
    expect(body.data).not.toHaveProperty('clerkId')
    expect(body.data).not.toHaveProperty('stripeAccountId')
    expect(lastCallArgs(prismaMock.user.update).select).toEqual(ALLOWED_SELECT)
  })

  it('returns only the contract columns on a rebind', async () => {
    seedRows([VICTIM])
    currentUserMock.mockResolvedValue(
      clerkAccount([clerkEmail('idem_p', VICTIM.email, 'verified')], 'idem_p'),
    )

    const res = await patch({ role: 'CREATOR' })
    const serialized = JSON.stringify(await res.json())
    const body = JSON.parse(serialized)

    expect(Object.keys(body.data).sort()).toEqual([...ALLOWED_COLUMNS].sort())
    expect(serialized).not.toContain(VICTIM.clerkId)
    expect(serialized).not.toContain(CALLER_CLERK_ID)
    expect(serialized).not.toContain(VICTIM.stripeAccountId as string)
    expect(lastCallArgs(prismaMock.user.update).select).toEqual(ALLOWED_SELECT)
  })

  it('returns only the contract columns when the account is created', async () => {
    currentUserMock.mockResolvedValue(
      clerkAccount([clerkEmail('idem_1', 'newcomer@example.com', 'verified')], 'idem_1'),
    )

    const res = await patch({ role: 'BRAND' })
    const serialized = JSON.stringify(await res.json())
    const body = JSON.parse(serialized)

    expect(Object.keys(body.data).sort()).toEqual([...ALLOWED_COLUMNS].sort())
    expect(serialized).not.toContain(CALLER_CLERK_ID)
    expect(lastCallArgs(prismaMock.user.create).select).toEqual(ALLOWED_SELECT)
  })

  it('never asks the database for the columns it must not expose', async () => {
    seedRows([userRow({ role: 'CREATOR' })])

    await patch({ role: 'BRAND' })

    const select = lastCallArgs(prismaMock.user.update).select
    expect(select).not.toHaveProperty('clerkId')
    expect(select).not.toHaveProperty('stripeAccountId')
  })

  it('answers with the same shape from the switch, rebind and create branches', async () => {
    seedRows([userRow({ role: 'CREATOR' })])
    const switched = await (await patch({ role: 'BRAND' })).json()

    seedRows([VICTIM])
    currentUserMock.mockResolvedValue(
      clerkAccount([clerkEmail('idem_p', VICTIM.email, 'verified')], 'idem_p'),
    )
    getCurrentAppUserMock.mockResolvedValue({
      userId: 'clerk_other',
      user: null,
      email: 'caller@example.com',
    })
    const rebound = await (await patch({ role: 'BRAND' })).json()

    seedRows([])
    currentUserMock.mockResolvedValue(
      clerkAccount([clerkEmail('idem_1', 'newcomer@example.com', 'verified')], 'idem_1'),
    )
    const created = await (await patch({ role: 'BRAND' })).json()

    expect(Object.keys(switched.data).sort()).toEqual([...ALLOWED_COLUMNS].sort())
    expect(Object.keys(rebound.data).sort()).toEqual(Object.keys(switched.data).sort())
    expect(Object.keys(created.data).sort()).toEqual(Object.keys(switched.data).sort())
  })
})
