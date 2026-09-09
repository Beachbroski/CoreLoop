import { z } from 'zod'
import prisma from '@/lib/prisma'
import { sendReferralMilestoneEmail, sendWaitlistConfirmationEmail } from '@/lib/email'
import { checkRateLimit, getRequestIp, isTrustedOrigin } from '@/lib/request-security'
import { getSiteUrl } from '@/lib/site-url'
import {
  isTurnstileFailClosed,
  shouldBypassTurnstile,
  verifyTurnstileToken,
} from '@/lib/turnstile'

const MAX_WAITLIST_BODY_BYTES = 16_384

const waitlistSchema = z.object({
  step: z.enum(['email', 'profile']).default('profile'),
  name: z.string().trim().max(100, 'Name is too long.').optional(),
  email: z.string().trim().email('Enter a valid email address.').transform(value => value.toLowerCase()),
  primaryPlatform: z.string().trim().max(40).optional(),
  handle: z.string().trim().max(80).optional(),
  niche: z.string().trim().max(80).optional(),
  followerRange: z.string().trim().max(80).optional(),
  referralCode: z.string().trim().max(40).optional().transform(value => value ? value.toUpperCase() : undefined),
  turnstileToken: z.string().trim().optional(),
})

type WaitlistSubmissionWithMeta = NonNullable<Awaited<ReturnType<typeof findWaitlistSubmissionByEmail>>>

/**
 * Crockford base32: the digits and letters minus I, L, O and U, so no two
 * characters in the set can be misheard or mistyped for one another. Its
 * length divides 256 exactly, which is what lets a random byte be folded into
 * an index with `%` without skewing the distribution.
 */
const REFERRAL_CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

/**
 * 10 characters of a 32-symbol alphabet is a 50-bit space (~1.1e15 codes).
 * Even at a million signups the chance that any two collide is under 1 in
 * 2,000, and the lookup below plus the unique index absorb the ones that do --
 * while the code stays short enough to read aloud. It also matches the length
 * codes have had until now, so nothing downstream sees a size change.
 */
const REFERRAL_CODE_LENGTH = 10
const REFERRAL_CODE_ATTEMPTS = 8

/**
 * Referral codes are public by design -- creators post their link and the code
 * rides in `?ref=CODE` -- so they carry no personal data at all. They used to
 * open with six characters of the name or email address, which for most people
 * is their real name, and closed with a `Math.random()` suffix that made the
 * rest guessable; guessing a code lets someone attribute a referral to a
 * person. Everything here now comes from the platform CSPRNG.
 */
function randomReferralCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(REFERRAL_CODE_LENGTH))
  return Array.from(bytes, byte => REFERRAL_CODE_ALPHABET[byte % REFERRAL_CODE_ALPHABET.length]).join('')
}

async function generateReferralCode() {
  for (let attempt = 0; attempt < REFERRAL_CODE_ATTEMPTS; attempt += 1) {
    const code = randomReferralCode()
    const existing = await prisma.waitlistSubmission.findUnique({ where: { referralCode: code } })
    if (!existing) return code
  }

  // Eight taken codes in a row means the lookup is lying to us (or the table is
  // implausibly full); hand the last word to the unique index, which the
  // callers' P2002 retry already handles.
  return randomReferralCode()
}

function isUniqueConstraintError(err: unknown) {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: string }).code === 'P2002'
  )
}

function buildReferralLink(referralCode: string, req: Request) {
  const siteUrl = getSiteUrl()

  try {
    const base = siteUrl ? new URL(siteUrl) : new URL(req.url)
    return new URL(`/waitlist?ref=${referralCode}`, base).toString()
  } catch {
    return `/waitlist?ref=${referralCode}`
  }
}

/**
 * What this endpoint may say about the person who referred a signup.
 *
 * It used to be `{ id, name, referralCode }`, and `waitlistResponseData` echoed
 * that object to whoever signed up quoting the code. Referral codes are public
 * by design -- creators post their link -- so anyone could be "referred by"
 * anyone, and the response handed the referrer's internal row id together with
 * their referral credential to a stranger. That pair is exactly the claim
 * secret minted below, so the receiver could forge a claim over the referrer's
 * row, overwrite it, and read the referrer's OWN referrer out of the answer to
 * mint the next forgery: it chained.
 *
 * A third party's row id and referral code have no business leaving the server.
 * The page renders one thing about the referrer -- "Joined through X's referral
 * code" -- so the name is the only field that survives.
 */
const REFERRED_BY_SELECT = { select: { name: true } } as const

/** Every read of a waitlist row this endpoint answers with goes through here. */
const WAITLIST_ROW_INCLUDE = {
  referredBy: REFERRED_BY_SELECT,
  _count: {
    select: { referrals: true },
  },
} as const

async function findWaitlistSubmissionByEmail(email: string) {
  return prisma.waitlistSubmission.findUnique({
    where: { email },
    include: WAITLIST_ROW_INCLUDE,
  })
}

/**
 * How a caller proves, with no session to prove it for them, that a waitlist
 * row is theirs.
 *
 * The funnel is two requests: step='email' creates the row, step='profile'
 * completes it. The second one therefore has to be allowed to write to a row
 * that already exists -- and nothing in it identifies the sender, because the
 * endpoint is public and an email address is something anyone can type. That
 * is what let a stranger finish (and read the referral credential of) any row
 * whose owner left after step 1.
 *
 * So creating a row now hands the browser a claim: that row's id joined to its
 * referral code, in a cookie scoped to this endpoint. Neither half is enough on
 * its own -- the referral code is public by design (creators post their link),
 * and the id is a cuid whose random tail is short -- but the pair is only ever
 * disclosed together to the one caller that created the row.
 *
 * That last sentence is the whole security argument, so every response in this
 * file was walked against it. An id/referralCode pair leaves the server in
 * exactly two places, and both are the row the caller just proved is theirs:
 * `createdSubmissionResponse` (the row this request created, alongside the
 * Set-Cookie that mints the claim for it) and the update branch of step
 * 'profile' (reached only past `hasWaitlistClaim`). Everything else --
 * an address already on the list, a finished profile, a failed claim check, a
 * lost creation race -- answers with `existingSubmissionResponse`, which is
 * three booleans. The one path that used to break the rule was the referrer
 * object echoed by `waitlistResponseData`; see REFERRED_BY_SELECT above.
 *
 * It is a bearer token, not an identity: whoever holds the cookie holds the
 * row. That is the same trust level as the confirmation email already carries,
 * and it is the strongest proof available until creators have accounts.
 */
const WAITLIST_CLAIM_COOKIE = 'waitlist_claim'

/**
 * 30 days, not 30 minutes.
 *
 * Half an hour only covers people who finish step 2 in one sitting; anyone who
 * submitted their address and came back that evening lost the claim, and with
 * it any way to finish their own signup -- the profile step then answers them
 * exactly as it answers a stranger, so the row is stranded and the signup is
 * gone for good. That is a permanent loss traded against a narrow window.
 *
 * The cookie is HttpOnly (script on the page cannot read it), SameSite=Lax (it
 * does not ride cross-site requests) and Path=/api/waitlist (nothing else on
 * the origin ever sees it), and it is a write capability over one unfinished
 * waitlist row -- not a session. The realistic risk of the long lifetime is a
 * shared browser whose next user finishes someone's abandoned signup; the
 * realistic cost of the short one is losing real signups every day. 30 days
 * takes the trade the funnel needs.
 */
const WAITLIST_CLAIM_MAX_AGE_SECONDS = 30 * 24 * 60 * 60

function waitlistClaimValue(submission: { id: string; referralCode: string }) {
  return `${submission.id}.${submission.referralCode}`
}

function decodeCookieValue(raw: string) {
  // Cookie headers are attacker-controlled: a stray '%' is a malformed escape
  // that throws, and a throw here would be a 500 on an otherwise fine request.
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

function readWaitlistClaim(req: Request) {
  const header = req.headers.get('cookie')
  if (!header) return null

  for (const pair of header.split(';')) {
    const separator = pair.indexOf('=')
    if (separator === -1) continue
    if (pair.slice(0, separator).trim() !== WAITLIST_CLAIM_COOKIE) continue

    return decodeCookieValue(pair.slice(separator + 1).trim())
  }

  return null
}

/**
 * Constant time in the length-matched case, so the claim cannot be recovered a
 * character at a time by timing repeated guesses against the same row.
 */
function secretsMatch(a: string, b: string) {
  if (a.length !== b.length) return false

  let difference = 0
  for (let index = 0; index < a.length; index += 1) {
    difference |= a.charCodeAt(index) ^ b.charCodeAt(index)
  }

  return difference === 0
}

/** True only for a caller holding the claim minted for THIS row. */
function hasWaitlistClaim(req: Request, submission: { id: string; referralCode: string }) {
  const claim = readWaitlistClaim(req)
  return claim !== null && secretsMatch(claim, waitlistClaimValue(submission))
}

function isSecureRequest(req: Request) {
  if (req.headers.get('x-forwarded-proto') === 'https') return true

  try {
    return new URL(req.url).protocol === 'https:'
  } catch {
    return false
  }
}

function waitlistClaimCookie(submission: { id: string; referralCode: string }, req: Request) {
  const attributes = [
    `${WAITLIST_CLAIM_COOKIE}=${encodeURIComponent(waitlistClaimValue(submission))}`,
    // Scoped to this endpoint: nothing else needs it, so nothing else gets it.
    'Path=/api/waitlist',
    // The page never reads the claim -- it rides along with the fetch -- so
    // script that gets injected into the page must not be able to lift it.
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${WAITLIST_CLAIM_MAX_AGE_SECONDS}`,
    // Browsers drop a Secure cookie on plain http, which would silently break
    // the funnel on local dev; every deployed origin is https and does get it.
    ...(isSecureRequest(req) ? ['Secure'] : []),
  ]

  return attributes.join('; ')
}

/**
 * What we may tell an unauthenticated caller about an email that is ALREADY on
 * the list: that it is on the list, and nothing else.
 *
 * `POST /api/waitlist` is public and takes an arbitrary email, so before this
 * existed anyone could enumerate the waitlist -- submitting a stranger's
 * address returned their name, social handle, niche, follower range, referral
 * code and link, status, referral count and who referred them. The referral
 * link is the sensitive one: it is the credential that attributes signups.
 *
 * A returning creator therefore no longer sees their link echoed back on the
 * page. That is the intended trade: proving you own an address requires a
 * round trip through it, and their original confirmation email already carries
 * the link. Follow-up worth doing: a "resend my referral link" action that
 * emails it rather than rendering it (deliberately not auto-resending here --
 * that would turn this endpoint into an email-bomb vector).
 */
function existingSubmissionResponse(submission: { profileCompletedAt: Date | null }) {
  return Response.json({
    success: true,
    existing: true,
    profileComplete: Boolean(submission.profileCompletedAt),
  })
}

/**
 * The full row, plus the claim that lets this caller -- and only this caller --
 * come back and finish it. Only ever returned for a row we just created, or to
 * a caller that presented the claim for one.
 */
function createdSubmissionResponse(
  created: WaitlistSubmissionWithMeta,
  req: Request,
  profileComplete: boolean,
) {
  return Response.json(
    {
      success: true,
      existing: false,
      profileComplete,
      data: waitlistResponseData(created, req),
    },
    { headers: { 'Set-Cookie': waitlistClaimCookie(created, req) } },
  )
}

function waitlistResponseData(submission: WaitlistSubmissionWithMeta, req: Request) {
  return {
    id: submission.id,
    name: submission.name,
    email: submission.email,
    primaryPlatform: submission.primaryPlatform,
    handle: submission.handle,
    niche: submission.niche,
    followerRange: submission.followerRange,
    profileCompletedAt: submission.profileCompletedAt?.toISOString() ?? null,
    referralCode: submission.referralCode,
    referralLink: buildReferralLink(submission.referralCode, req),
    status: submission.status,
    referralCount: submission._count.referrals,
    // Re-projected field by field rather than spread: the query select above is
    // the first guard, and this is the one that holds even if a future include
    // widens. A third party's row id and referral code never leave here.
    referredBy: submission.referredBy ? { name: submission.referredBy.name } : null,
  }
}

/**
 * The referrer to attribute this signup to, or undefined for none.
 *
 * An unknown code used to be a 400 saying so, which made this a free existence
 * oracle for arbitrary codes: post any string, learn from the status whether
 * someone holds it. Codes are 50 bits of CSPRNG so the space is not walkable,
 * but the oracle also confirmed codes harvested elsewhere, and it cost a
 * would-be creator their signup over a typo. An unknown code is now simply not
 * a referral: the signup proceeds exactly as an unreferred one, so from the
 * caller's side an unknown code and a valid code that referred nobody are the
 * same request with the same status and the same body shape.
 *
 * What a caller can still observe is whether THEIR OWN completed signup came
 * back with a referrer name attached -- the page renders it -- and that is the
 * floor: the product exists to tell people who referred them. Reaching it costs
 * an unused email address and a real row per probe, under the IP rate limit,
 * versus the previous unlimited free probing of arbitrary codes.
 *
 * There is deliberately no self-referral check. Both callers run only after
 * `findWaitlistSubmissionByEmail` returned null for this address, so no row
 * with this email exists and no referrer found by code can be its owner; the
 * check that used to sit here could not fire. A creator who already has a row
 * cannot reach this code at all, referral code in hand or not.
 */
async function resolveReferrer(referralCode: string | undefined) {
  if (!referralCode) return undefined

  const referrer = await prisma.waitlistSubmission.findUnique({
    where: { referralCode },
    select: { id: true },
  })

  return referrer?.id
}

async function notifyReferralMilestone(referrerId: string | undefined) {
  if (!referrerId) return

  const referrer = await prisma.waitlistSubmission.findUnique({
    where: { id: referrerId },
    select: { email: true, name: true, _count: { select: { referrals: true } } },
  })

  if (referrer && referrer._count.referrals === 3) {
    await sendReferralMilestoneEmail(referrer.email, { name: referrer.name })
  }
}

function validateProfileFields(data: z.infer<typeof waitlistSchema>) {
  if (!data.primaryPlatform || data.primaryPlatform.length < 2) return 'Choose a primary platform.'
  if (!data.handle || data.handle.length < 2) return 'Handle is required.'
  if (!data.niche || data.niche.length < 2) return 'Choose a niche.'
  if (!data.followerRange || data.followerRange.length < 2) return 'Choose a follower range.'
  return null
}

async function ensureTurnstile(req: Request, token: string | undefined) {
  if (isTurnstileFailClosed()) {
    return Response.json(
      { error: 'Verification is not configured. Please try again later.' },
      { status: 503 },
    )
  }

  if (shouldBypassTurnstile()) return null

  if (!token) {
    return Response.json({ error: 'Complete the verification before joining the waitlist.' }, { status: 400 })
  }

  const turnstileOk = await verifyTurnstileToken(token, getRequestIp(req))
  if (!turnstileOk) {
    return Response.json({ error: 'Verification failed. Please refresh and try again.' }, { status: 403 })
  }

  return null
}

export async function POST(req: Request) {
  try {
    if (!isTrustedOrigin(req)) {
      return Response.json({ error: 'Invalid request origin' }, { status: 403 })
    }

    const contentLength = Number(req.headers.get('content-length') ?? 0)
    if (contentLength > MAX_WAITLIST_BODY_BYTES) {
      return Response.json({ error: 'Waitlist form is too large.' }, { status: 413 })
    }

    const rateLimit = await checkRateLimit(`waitlist:create:${getRequestIp(req)}`, {
      limit: 12,
      windowMs: 60_000,
    })

    if (!rateLimit.ok) {
      return Response.json(
        { error: 'Too many waitlist attempts. Please try again shortly.' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } },
      )
    }

    const parsed = waitlistSchema.safeParse(await req.json())
    if (!parsed.success) {
      return Response.json({ error: parsed.error.issues[0]?.message ?? 'Invalid waitlist form.' }, { status: 400 })
    }

    const { email, referralCode, turnstileToken } = parsed.data
    const turnstileError = await ensureTurnstile(req, turnstileToken)
    if (turnstileError) return turnstileError

    if (parsed.data.step === 'email') {
      const existing = await findWaitlistSubmissionByEmail(email)
      if (existing) return existingSubmissionResponse(existing)

      const referredById = await resolveReferrer(referralCode)

      for (let attempt = 0; attempt < 5; attempt += 1) {
        try {
          const created = await prisma.waitlistSubmission.create({
            data: {
              email,
              referralCode: await generateReferralCode(),
              referredById,
            },
            include: WAITLIST_ROW_INCLUDE,
          })

          await sendWaitlistConfirmationEmail(created.email, {
            name: created.name,
            referralLink: buildReferralLink(created.referralCode, req),
          })
          await notifyReferralMilestone(referredById)

          return createdSubmissionResponse(created, req, false)
        } catch (err) {
          if (!isUniqueConstraintError(err)) throw err

          const duplicate = await findWaitlistSubmissionByEmail(email)
          if (duplicate) return existingSubmissionResponse(duplicate)
        }
      }

      return Response.json({ error: 'Unable to create a unique referral code. Please try again.' }, { status: 409 })
    }

    const profileError = validateProfileFields(parsed.data)
    if (profileError) {
      return Response.json({ error: profileError }, { status: 400 })
    }

    const existing = await findWaitlistSubmissionByEmail(email)
    const profileData = {
      name: parsed.data.name || null,
      primaryPlatform: parsed.data.primaryPlatform,
      handle: parsed.data.handle,
      niche: parsed.data.niche,
      followerRange: parsed.data.followerRange,
      profileCompletedAt: new Date(),
    }

    if (existing) {
      // A completed profile is only editable by someone who can prove they own
      // the address, and no proof this endpoint can take is strong enough to
      // justify rewriting a finished row -- so a second write is refused rather
      // than allowed to overwrite a stranger's name, handle and niche. The
      // response is identical to the success case on purpose: it must not
      // become an oracle for which addresses are registered.
      if (existing.profileCompletedAt) return existingSubmissionResponse(existing)

      // An unfinished row is not unowned. Every address that submitted step 1
      // and stopped has a row sitting here with its referral credential in it,
      // and the address is the only thing the caller had to know to reach it.
      // So the write is allowed only for the caller that created the row,
      // proven by the claim cookie minted at creation. Everyone else gets the
      // same body the email step already returns for this address -- failing
      // the claim check discloses nothing that typing the address did not.
      if (!hasWaitlistClaim(req, existing)) return existingSubmissionResponse(existing)

      const updated = await prisma.waitlistSubmission.update({
        where: { id: existing.id },
        data: profileData,
        include: WAITLIST_ROW_INCLUDE,
      })

      // The caller presented the claim this row was created with, so the row --
      // and the referral link this echoes -- is demonstrably theirs. Nobody
      // reaches this line without it.
      return Response.json({
        success: true,
        existing: true,
        profileComplete: true,
        data: waitlistResponseData(updated, req),
      })
    }

    const referredById = await resolveReferrer(referralCode)

    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        const created = await prisma.waitlistSubmission.create({
          data: {
            email,
            referralCode: await generateReferralCode(),
            referredById,
            ...profileData,
          },
          include: WAITLIST_ROW_INCLUDE,
        })

        await sendWaitlistConfirmationEmail(created.email, {
          name: created.name,
          referralLink: buildReferralLink(created.referralCode, req),
        })
        await notifyReferralMilestone(referredById)

        return createdSubmissionResponse(created, req, true)
      } catch (err) {
        if (!isUniqueConstraintError(err)) throw err

        const duplicate = await findWaitlistSubmissionByEmail(email)
        if (duplicate) {
          // The address was taken between the lookup above and this insert, so
          // the row belongs to whoever won that race -- not necessarily to this
          // caller, who holds no claim for it. Echoing it here would hand out a
          // stranger's referral credential by the same route the guard above
          // closes, so answer exactly as the existing-address path does.
          return existingSubmissionResponse(duplicate)
        }
      }
    }

    return Response.json({ error: 'Unable to create a unique referral code. Please try again.' }, { status: 409 })
  } catch (err) {
    console.error('[POST /api/waitlist]', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
