import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { findUniqueMock, createMock, updateMock, checkRateLimitMock, isTrustedOriginMock } = vi.hoisted(() => ({
  findUniqueMock: vi.fn(),
  createMock: vi.fn(),
  updateMock: vi.fn(),
  checkRateLimitMock: vi.fn(),
  isTrustedOriginMock: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  default: {
    waitlistSubmission: { findUnique: findUniqueMock, create: createMock, update: updateMock },
  },
}))
vi.mock('@/lib/email', () => ({
  sendReferralMilestoneEmail: vi.fn(),
  sendWaitlistConfirmationEmail: vi.fn(),
}))
vi.mock('@/lib/request-security', () => ({
  checkRateLimit: checkRateLimitMock,
  getRequestIp: () => '1.2.3.4',
  isTrustedOrigin: isTrustedOriginMock,
}))
vi.mock('@/lib/turnstile', () => ({
  isTurnstileFailClosed: () => false,
  shouldBypassTurnstile: () => true,
  verifyTurnstileToken: vi.fn().mockResolvedValue(true),
}))

const { POST } = await import('./route')

/** A complete row, as the database would return it — the shape we must NOT echo. */
const strangersRow = {
  id: 'wl_1',
  name: 'Someone Else',
  email: 'stranger@example.com',
  primaryPlatform: 'TikTok',
  handle: '@stranger',
  niche: 'Beauty',
  followerRange: '10k-25k',
  profileCompletedAt: new Date('2026-08-01'),
  referralCode: 'STRANGER01',
  status: 'NEW',
  referredBy: { id: 'wl_0', name: 'Referrer', referralCode: 'REF00001' },
  _count: { referrals: 7 },
}

function post(body: unknown): Request {
  return new Request('https://www.creatordocks.com/api/waitlist', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

describe('POST /api/waitlist — enumeration and overwrite', () => {
  beforeEach(() => {
    findUniqueMock.mockReset()
    createMock.mockReset()
    updateMock.mockReset()
    checkRateLimitMock.mockReset().mockResolvedValue({ ok: true, retryAfterSeconds: 0 })
    isTrustedOriginMock.mockReset().mockReturnValue(true)
  })

  afterEach(() => vi.clearAllMocks())

  // The endpoint is public and takes an arbitrary email, so echoing the row
  // let anyone enumerate the waitlist by address. The referral code is the
  // sensitive part: it is the credential that attributes signups.
  it('does not disclose an existing submission to whoever types the address', async () => {
    findUniqueMock.mockResolvedValue(strangersRow)

    const res = await POST(post({ step: 'email', email: 'stranger@example.com' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ success: true, existing: true, profileComplete: true })
    expect(JSON.stringify(body)).not.toContain('STRANGER01')
    expect(JSON.stringify(body)).not.toContain('@stranger')
    expect(JSON.stringify(body)).not.toContain('Someone Else')
  })

  it('refuses to overwrite a profile that is already complete', async () => {
    findUniqueMock.mockResolvedValue(strangersRow)

    const res = await POST(
      post({
        step: 'profile',
        email: 'stranger@example.com',
        name: 'Attacker',
        primaryPlatform: 'Instagram',
        handle: '@attacker',
        niche: 'Fitness',
        followerRange: '100k+',
      }),
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(updateMock).not.toHaveBeenCalled()
    expect(body.data).toBeUndefined()
  })

  // Same response either way — otherwise the difference is itself the oracle.
  it('is indistinguishable between a complete and an incomplete existing row', async () => {
    findUniqueMock.mockResolvedValue({ ...strangersRow, profileCompletedAt: null })
    const incomplete = await (await POST(post({ step: 'email', email: 'stranger@example.com' }))).json()

    findUniqueMock.mockResolvedValue(strangersRow)
    const complete = await (await POST(post({ step: 'email', email: 'stranger@example.com' }))).json()

    expect(Object.keys(incomplete).sort()).toEqual(Object.keys(complete).sort())
    expect(incomplete.data).toBeUndefined()
    expect(complete.data).toBeUndefined()
  })
})

/**
 * Referral codes are meant to be posted publicly and typed in from a link, so
 * they must (a) carry nothing about the person they belong to and (b) come
 * from a cryptographic source. Before this, the first six characters were the
 * name or email address with the punctuation stripped -- every creator who
 * shared their link broadcast the opening of their address.
 */
describe('POST /api/waitlist — referral code generation', () => {
  const CODE_ALPHABET_PATTERN = /^[0-9A-HJKMNP-TV-Z]{10}$/

  interface CreateArgs {
    data: { email: string; referralCode: string; name?: string | null }
  }

  interface FindUniqueArgs {
    where: { email?: string; referralCode?: string }
  }

  function createdCode(): string {
    const lastCall = createMock.mock.calls.at(-1)?.[0] as CreateArgs | undefined
    if (!lastCall) throw new Error('waitlistSubmission.create was never called')
    return lastCall.data.referralCode
  }

  /** Every alphanumeric run of `size` characters in `value`, uppercased. */
  function fragmentsOf(value: string, size: number): string[] {
    const compact = value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
    return Array.from({ length: Math.max(0, compact.length - size + 1) }, (_, index) =>
      compact.slice(index, index + size),
    )
  }

  async function signUp(email: string, name: string): Promise<string> {
    const res = await POST(
      post({
        step: 'profile',
        email,
        name,
        primaryPlatform: 'TikTok',
        handle: '@creator',
        niche: 'Beauty',
        followerRange: '10k-25k',
      }),
    )

    expect(res.status).toBe(200)
    return createdCode()
  }

  beforeEach(() => {
    findUniqueMock.mockReset().mockResolvedValue(null)
    createMock
      .mockReset()
      .mockImplementation(async ({ data }: CreateArgs) => ({
        ...strangersRow,
        email: data.email,
        name: data.name ?? null,
        referralCode: data.referralCode,
      }))
    updateMock.mockReset()
    checkRateLimitMock.mockReset().mockResolvedValue({ ok: true, retryAfterSeconds: 0 })
    isTrustedOriginMock.mockReset().mockReturnValue(true)
  })

  afterEach(() => vi.restoreAllMocks())

  // Pinning the random source makes this deterministic: if the code still
  // depended on the submitted email or name, two unrelated signups drawing the
  // same bytes could not produce the same code.
  it('derives the code from the random source alone, not from the email or name', async () => {
    function fillWithFixedBytes<T extends ArrayBufferView | null>(target: T): T {
      if (target) {
        const bytes = new Uint8Array(target.buffer, target.byteOffset, target.byteLength)
        bytes.forEach((_, index) => {
          bytes[index] = (index * 37 + 11) % 256
        })
      }

      return target
    }

    vi.spyOn(globalThis.crypto, 'getRandomValues').mockImplementation(fillWithFixedBytes)

    const harper = await signUp('harper.m.lane@example.test', 'Harper Lane')
    const zoe = await signUp('zoe@other.test', 'Zoe Okafor')

    expect(harper).toBe(zoe)
    expect(harper).toMatch(CODE_ALPHABET_PATTERN)

    for (const fragment of [
      ...fragmentsOf('harper.m.lane@example.test', 3),
      ...fragmentsOf('Harper Lane', 3),
    ]) {
      expect(harper).not.toContain(fragment)
    }
  })

  it('leaks no fragment of the address or name into the code', async () => {
    const email = 'harper.m.lane@example.test'
    const name = 'Harper Lane'
    const code = await signUp(email, name)

    expect(code.startsWith('HARPER')).toBe(false)
    for (const fragment of [...fragmentsOf(email, 5), ...fragmentsOf(name, 5)]) {
      expect(code).not.toContain(fragment)
    }
  })

  // Crockford base32: no I, L, O or U, so nothing in a shared code can be
  // misheard or mistyped for something else in the alphabet.
  it('uses a 10-character unambiguous alphabet and does not repeat itself', async () => {
    const codes: string[] = []
    for (let index = 0; index < 100; index += 1) {
      codes.push(await signUp(`creator${index}@example.com`, `Creator ${index}`))
    }

    for (const code of codes) {
      expect(code).toMatch(CODE_ALPHABET_PATTERN)
      expect(code).not.toMatch(/[ILOU]/)
    }

    expect(new Set(codes).size).toBe(codes.length)
  })

  it('retries when the generated code is already taken', async () => {
    const probed: string[] = []
    findUniqueMock.mockImplementation(async ({ where }: FindUniqueArgs) => {
      if (!where.referralCode) return null

      probed.push(where.referralCode)
      return probed.length === 1 ? { ...strangersRow, referralCode: where.referralCode } : null
    })

    const code = await signUp('retry@example.com', 'Retry Creator')

    expect(probed.length).toBeGreaterThanOrEqual(2)
    expect(code).toBe(probed[1])
    expect(code).not.toBe(probed[0])
    expect(code).toMatch(CODE_ALPHABET_PATTERN)
  })

  // The lookup above is advisory -- the unique index is the real guard, and a
  // racing insert still has to be survivable.
  it('recovers from a unique-constraint collision with a fresh code', async () => {
    const attempted: string[] = []
    createMock.mockImplementation(async ({ data }: CreateArgs) => {
      attempted.push(data.referralCode)
      if (attempted.length === 1) throw Object.assign(new Error('duplicate key'), { code: 'P2002' })

      return { ...strangersRow, email: data.email, name: data.name ?? null, referralCode: data.referralCode }
    })

    const res = await POST(
      post({
        step: 'profile',
        email: 'race@example.com',
        name: 'Race Creator',
        primaryPlatform: 'TikTok',
        handle: '@creator',
        niche: 'Beauty',
        followerRange: '10k-25k',
      }),
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(attempted).toHaveLength(2)
    expect(attempted[0]).not.toBe(attempted[1])
    expect(body.data.referralCode).toBe(attempted[1])
  })
})
