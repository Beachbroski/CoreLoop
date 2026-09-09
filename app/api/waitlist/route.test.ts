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

/**
 * The profile step is the one place this endpoint writes to a row it did not
 * just create, and the only thing a caller has to know to reach a row is the
 * email address on it. Every address that submitted step 1 and walked away has
 * a row sitting here holding its referral credential, so "who is sending this?"
 * has to be answered before the write and before the echo.
 */
describe('POST /api/waitlist — completing a row that already exists', () => {
  const incompleteStranger = { ...strangersRow, profileCompletedAt: null }

  const strangersAddress = 'stranger@example.com'

  /** What an attacker posts: a real address, their own details. */
  const takeoverAttempt = {
    step: 'profile',
    email: strangersAddress,
    name: 'Attacker',
    primaryPlatform: 'Instagram',
    handle: '@attacker',
    niche: 'Fitness',
    followerRange: '100k+',
  }

  interface UpdateArgs {
    where: { id: string }
    data: {
      name: string | null
      handle?: string
      niche?: string
      followerRange?: string
      profileCompletedAt: Date
    }
  }

  function postWithCookie(body: unknown, cookie: string): Request {
    return new Request('https://www.creatordocks.com/api/waitlist', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json', cookie },
    })
  }

  /** The Cookie header a browser would send back after storing a Set-Cookie. */
  function cookieFrom(res: Response): string {
    const setCookie = res.headers.get('set-cookie')
    if (!setCookie) throw new Error('the response set no claim cookie')

    return setCookie.split(';')[0]
  }

  beforeEach(() => {
    findUniqueMock.mockReset()
    createMock.mockReset()
    // The row Prisma would really hand back, so that a write which should never
    // have happened surfaces as the disclosure it is rather than as a crash on
    // an undefined row.
    updateMock.mockReset().mockImplementation(async ({ where, data }: UpdateArgs) => ({
      ...incompleteStranger,
      ...data,
      id: where.id,
    }))
    checkRateLimitMock.mockReset().mockResolvedValue({ ok: true, retryAfterSeconds: 0 })
    isTrustedOriginMock.mockReset().mockReturnValue(true)
  })

  afterEach(() => vi.clearAllMocks())

  it('does not fill in a row abandoned after step 1 for whoever guessed the address', async () => {
    findUniqueMock.mockResolvedValue(incompleteStranger)

    const res = await POST(post(takeoverAttempt))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(updateMock).not.toHaveBeenCalled()
    expect(body.data).toBeUndefined()
    // Refusing must not hand out a claim either -- a claim minted here would be
    // replayable on the next request and the guard would be worth nothing.
    expect(res.headers.get('set-cookie')).toBeNull()
  })

  it('hands out no part of that row: not the code, not the link, not the referrer', async () => {
    findUniqueMock.mockResolvedValue(incompleteStranger)

    const body = await (await POST(post(takeoverAttempt))).json()
    const serialized = JSON.stringify(body)

    for (const secret of ['STRANGER01', 'REF00001', 'wl_1', 'wl_0', 'Someone Else', '@stranger']) {
      expect(serialized).not.toContain(secret)
    }

    expect(serialized).not.toMatch(/referral|referredBy|ref=/i)
    expect(body.data).toBeUndefined()
  })

  // A difference between these answers is itself the disclosure.
  it('answers a stranger the same whether the row is finished or not', async () => {
    findUniqueMock.mockResolvedValue(strangersRow)
    const complete = await (await POST(post(takeoverAttempt))).json()

    findUniqueMock.mockResolvedValue(incompleteStranger)
    const incomplete = await (await POST(post(takeoverAttempt))).json()
    const fromEmailStep = await (await POST(post({ step: 'email', email: strangersAddress }))).json()

    // Identical bytes to what the step in front of it already returns for the
    // same address: the profile step must not be the richer oracle of the two.
    expect(JSON.stringify(incomplete)).toBe(JSON.stringify(fromEmailStep))
    expect(Object.keys(incomplete).sort()).toEqual(Object.keys(complete).sort())
    expect(incomplete.data).toBeUndefined()
    expect(complete.data).toBeUndefined()
  })

  it('rejects a claim minted for a different row', async () => {
    findUniqueMock.mockResolvedValue(incompleteStranger)

    const res = await POST(postWithCookie(takeoverAttempt, 'waitlist_claim=wl_9.MYOWNCODE1'))
    const body = await res.json()

    expect(updateMock).not.toHaveBeenCalled()
    expect(body.data).toBeUndefined()
  })

  it('does not echo a row it lost the creation race for', async () => {
    let emailLookups = 0
    findUniqueMock.mockImplementation(async ({ where }: { where: { email?: string; referralCode?: string } }) => {
      if (where.referralCode) return null

      emailLookups += 1
      // Absent when the request starts, present by the time the insert lands.
      return emailLookups === 1 ? null : incompleteStranger
    })
    createMock.mockRejectedValue(Object.assign(new Error('duplicate key'), { code: 'P2002' }))

    const body = await (await POST(post(takeoverAttempt))).json()

    expect(body.data).toBeUndefined()
    expect(JSON.stringify(body)).not.toContain('STRANGER01')
  })

  // The whole reason the guard above cannot simply refuse every write: this is
  // the real funnel, and it has to keep working end to end without a session.
  it('lets the caller that created a row come back and finish it', async () => {
    const created = {
      ...strangersRow,
      id: 'wl_new',
      name: null,
      email: 'newcreator@example.com',
      primaryPlatform: null,
      handle: null,
      niche: null,
      followerRange: null,
      profileCompletedAt: null,
      referralCode: 'NEWCODE001',
      referredBy: null,
      _count: { referrals: 0 },
    }

    findUniqueMock.mockResolvedValue(null)
    createMock.mockResolvedValue(created)

    const emailStep = await POST(post({ step: 'email', email: created.email }))
    const lead = await emailStep.json()

    expect(lead.data.referralLink).toContain('NEWCODE001')

    const setCookie = emailStep.headers.get('set-cookie') ?? ''
    expect(setCookie).toContain('HttpOnly')
    expect(setCookie).toContain('Path=/api/waitlist')
    expect(setCookie).toContain('Secure')
    // 30 days. Half an hour stranded anyone who submitted their address and
    // came back that evening: without the claim, the profile step answers them
    // exactly as it answers a stranger and their signup is lost for good.
    expect(setCookie).toContain('Max-Age=2592000')

    findUniqueMock.mockResolvedValue(created)
    updateMock.mockImplementation(async ({ where, data }: UpdateArgs) => ({
      ...created,
      ...data,
      id: where.id,
    }))

    const profileStep = await POST(
      postWithCookie(
        {
          step: 'profile',
          email: created.email,
          name: 'New Creator',
          primaryPlatform: 'TikTok',
          handle: '@newcreator',
          niche: 'Beauty',
          followerRange: '1k-5k',
        },
        cookieFrom(emailStep),
      ),
    )
    const finished = await profileStep.json()

    expect(updateMock).toHaveBeenCalledTimes(1)

    const updateArgs = updateMock.mock.calls[0]?.[0] as UpdateArgs
    expect(updateArgs.where).toEqual({ id: 'wl_new' })
    expect(updateArgs.data.handle).toBe('@newcreator')
    expect(updateArgs.data.profileCompletedAt).toBeInstanceOf(Date)

    expect(finished.profileComplete).toBe(true)
    expect(finished.data.handle).toBe('@newcreator')
    expect(finished.data.referralCode).toBe('NEWCODE001')
    expect(finished.data.referralLink).toContain('NEWCODE001')
  })
})

/**
 * Referral codes are public by design: the product tells creators to post their
 * link, and everyone who follows one signs up quoting that code. So whatever
 * the response says about the referrer is said to a stranger -- and the claim
 * secret is `${id}.${referralCode}`, which is precisely the pair the referrer
 * object used to carry. Handing it over let a referred signup forge a claim
 * over the referrer's row, overwrite it, and read the referrer's OWN referrer
 * out of the answer to mint the next forgery.
 */
describe('POST /api/waitlist — what a signup learns about whoever referred it', () => {
  const victimId = 'wl_victim'
  const victimCode = 'VICTIM0001'

  /** The victim: signed up, never finished step 2, link out in the world. */
  const victimRow = {
    id: victimId,
    name: 'Victim Creator',
    email: 'victim@example.com',
    primaryPlatform: null,
    handle: null,
    niche: null,
    followerRange: null,
    profileCompletedAt: null,
    referralCode: victimCode,
    status: 'NEW',
    referredBy: null,
    _count: { referrals: 4 },
  }

  /**
   * What Prisma hands back for a referred signup if the referrer projection is
   * ever widened again -- the shape the route must refuse to echo whatever the
   * query happens to return.
   */
  const referredCreatedRow = {
    id: 'wl_attacker',
    name: null,
    email: 'attacker@evil.test',
    primaryPlatform: null,
    handle: null,
    niche: null,
    followerRange: null,
    profileCompletedAt: null,
    referralCode: 'ATTACKER01',
    status: 'NEW',
    referredBy: { id: victimId, name: victimRow.name, referralCode: victimCode },
    _count: { referrals: 0 },
  }

  const profileFields = {
    name: 'Attacker',
    primaryPlatform: 'Instagram',
    handle: '@attacker',
    niche: 'Fitness',
    followerRange: '100k+',
  }

  interface WhereArgs {
    where: { email?: string; referralCode?: string }
  }

  /** Only the victim's code resolves; every other lookup finds nothing. */
  function onlyVictimExists() {
    findUniqueMock.mockImplementation(async ({ where }: WhereArgs) => {
      if (where.referralCode === victimCode) return victimRow
      return null
    })
  }

  function postWithCookie(body: unknown, cookie: string): Request {
    return new Request('https://www.creatordocks.com/api/waitlist', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json', cookie },
    })
  }

  beforeEach(() => {
    findUniqueMock.mockReset()
    createMock.mockReset().mockResolvedValue(referredCreatedRow)
    updateMock.mockReset()
    checkRateLimitMock.mockReset().mockResolvedValue({ ok: true, retryAfterSeconds: 0 })
    isTrustedOriginMock.mockReset().mockReturnValue(true)
  })

  afterEach(() => vi.clearAllMocks())

  // The two-request forgery, end to end: sign up through the victim's public
  // link, assemble a claim out of whatever that answer disclosed, spend it on
  // the victim's row.
  it('refuses the forged claim a referred signup used to be able to assemble', async () => {
    onlyVictimExists()

    const step1 = await POST(
      post({ step: 'email', email: 'attacker@evil.test', referralCode: victimCode }),
    )
    const referredSignup = await step1.json()

    const disclosed = referredSignup.data.referredBy as { id?: string; referralCode?: string } | null
    const forged = `waitlist_claim=${disclosed?.id ?? ''}.${disclosed?.referralCode ?? ''}`

    // Step 2: spend it against the victim's unfinished row.
    findUniqueMock.mockReset().mockResolvedValue(victimRow)
    updateMock.mockResolvedValue({ ...victimRow, ...profileFields, profileCompletedAt: new Date() })

    const step2 = await POST(
      postWithCookie({ step: 'profile', email: victimRow.email, ...profileFields }, forged),
    )
    const hijacked = await step2.json()

    // The victim's row is untouched, and the answer is the three booleans a
    // stranger gets rather than their profile and referral credential.
    expect(updateMock).not.toHaveBeenCalled()
    expect(hijacked).toEqual({ success: true, existing: true, profileComplete: false })
    expect(hijacked.data).toBeUndefined()
    expect(step2.headers.get('set-cookie')).toBeNull()

    // And the reason the claim could not be assembled: neither half of it was
    // in the referral answer to begin with.
    expect(JSON.stringify(referredSignup)).not.toContain(victimId)
    expect(JSON.stringify(referredSignup)).not.toContain(victimCode)
    expect(JSON.stringify(hijacked)).not.toContain(victimCode)
  })

  it('tells a referred signup the referrer name and nothing else', async () => {
    onlyVictimExists()

    const body = await (
      await POST(post({ step: 'email', email: 'attacker@evil.test', referralCode: victimCode }))
    ).json()

    expect(body.data.referredBy).toEqual({ name: 'Victim Creator' })
    expect(body.data.referralCode).toBe('ATTACKER01')
  })

  it('narrows the referrer projection in the query as well as in the response', async () => {
    onlyVictimExists()

    await POST(post({ step: 'email', email: 'attacker@evil.test', referralCode: victimCode }))

    const createArgs = createMock.mock.calls[0]?.[0] as {
      include: { referredBy: { select: Record<string, boolean> } }
    }
    expect(createArgs.include.referredBy.select).toEqual({ name: true })

    const referrerLookup = findUniqueMock.mock.calls
      .map(call => call[0] as { where: { referralCode?: string }; select?: Record<string, boolean> })
      .find(args => args.where.referralCode === victimCode)
    expect(referrerLookup?.select).toEqual({ id: true })
  })

  // The one-request funnel (profile step with ?ref on a fresh address) and the
  // claim-completed update both echo the row, so both are audited too.
  it('carries no third-party id or code on the single-request signup', async () => {
    onlyVictimExists()
    createMock.mockResolvedValue({
      ...referredCreatedRow,
      ...profileFields,
      profileCompletedAt: new Date('2026-09-01'),
    })

    const body = await (
      await POST(post({ step: 'profile', email: 'attacker@evil.test', referralCode: victimCode, ...profileFields }))
    ).json()

    expect(body.data.referredBy).toEqual({ name: 'Victim Creator' })
    expect(JSON.stringify(body)).not.toContain(victimId)
    expect(JSON.stringify(body)).not.toContain(victimCode)
  })

  it('carries no third-party id or code when the claim holder finishes their row', async () => {
    const ownRow = {
      ...referredCreatedRow,
      email: 'referred@example.com',
    }

    findUniqueMock.mockResolvedValue(ownRow)
    updateMock.mockResolvedValue({
      ...ownRow,
      ...profileFields,
      profileCompletedAt: new Date('2026-09-01'),
    })

    const body = await (
      await POST(
        postWithCookie(
          { step: 'profile', email: ownRow.email, ...profileFields },
          `waitlist_claim=${ownRow.id}.${ownRow.referralCode}`,
        ),
      )
    ).json()

    expect(updateMock).toHaveBeenCalledTimes(1)
    expect(body.data.referredBy).toEqual({ name: 'Victim Creator' })
    expect(JSON.stringify(body)).not.toContain(victimId)
    expect(JSON.stringify(body)).not.toContain(victimCode)
    // Their own row is theirs to receive: the claim proved it.
    expect(body.data.referralCode).toBe('ATTACKER01')
  })

  // An unknown code used to be a 400 saying so, which answered "does anyone
  // hold this code?" for free. It now joins the list unreferred instead.
  it('does not tell the caller whether an unknown referral code exists', async () => {
    onlyVictimExists()
    createMock.mockResolvedValue({ ...referredCreatedRow, referredBy: null })

    const unknown = await POST(post({ step: 'email', email: 'typo@example.test', referralCode: 'NOSUCHCODE' }))
    const unknownBody = await unknown.json()

    expect(unknown.status).toBe(200)
    expect(unknownBody.success).toBe(true)
    expect(unknownBody.data.referredBy).toBeNull()
    expect(createMock.mock.calls[0]?.[0]).toMatchObject({ data: { referredById: undefined } })

    createMock.mockClear()
    createMock.mockResolvedValue(referredCreatedRow)
    const known = await POST(post({ step: 'email', email: 'referred@example.test', referralCode: victimCode }))

    expect(known.status).toBe(unknown.status)
    expect(Object.keys(await known.json()).sort()).toEqual(Object.keys(unknownBody).sort())
  })
})
