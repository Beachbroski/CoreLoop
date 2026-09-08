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

async function findWaitlistSubmissionByEmail(email: string) {
  return prisma.waitlistSubmission.findUnique({
    where: { email },
    include: {
      referredBy: {
        select: { id: true, name: true, referralCode: true },
      },
      _count: {
        select: { referrals: true },
      },
    },
  })
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
    referredBy: submission.referredBy,
  }
}

async function resolveReferrer(referralCode: string | undefined, email: string) {
  if (!referralCode) return undefined

  const referrer = await prisma.waitlistSubmission.findUnique({
    where: { referralCode },
    select: { id: true, email: true },
  })

  if (!referrer) {
    throw new Error('Referral code not found. Double-check the code and try again.')
  }

  if (referrer.email === email) {
    throw new Error('You cannot use your own referral code.')
  }

  return referrer.id
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

      let referredById: string | undefined
      try {
        referredById = await resolveReferrer(referralCode, email)
      } catch (err) {
        return Response.json({ error: err instanceof Error ? err.message : 'Invalid referral code.' }, { status: 400 })
      }

      for (let attempt = 0; attempt < 5; attempt += 1) {
        try {
          const created = await prisma.waitlistSubmission.create({
            data: {
              email,
              referralCode: await generateReferralCode(),
              referredById,
            },
            include: {
              referredBy: {
                select: { id: true, name: true, referralCode: true },
              },
              _count: {
                select: { referrals: true },
              },
            },
          })

          await sendWaitlistConfirmationEmail(created.email, {
            name: created.name,
            referralLink: buildReferralLink(created.referralCode, req),
          })
          await notifyReferralMilestone(referredById)

          return Response.json({
            success: true,
            existing: false,
            profileComplete: false,
            data: waitlistResponseData(created, req),
          })
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
      // the address, and this endpoint has no such proof -- so a second write
      // is refused rather than allowed to overwrite a stranger's name, handle
      // and niche. The response is identical to the success case on purpose:
      // it must not become an oracle for which addresses are registered.
      if (existing.profileCompletedAt) return existingSubmissionResponse(existing)

      const updated = await prisma.waitlistSubmission.update({
        where: { id: existing.id },
        data: profileData,
        include: {
          referredBy: {
            select: { id: true, name: true, referralCode: true },
          },
          _count: {
            select: { referrals: true },
          },
        },
      })

      // The caller just completed this row in the same funnel, so returning its
      // referral link is theirs to see -- but only because we got here via the
      // not-yet-completed branch above.
      return Response.json({
        success: true,
        existing: true,
        profileComplete: true,
        data: waitlistResponseData(updated, req),
      })
    }

    let referredById: string | undefined
    try {
      referredById = await resolveReferrer(referralCode, email)
    } catch (err) {
      return Response.json({ error: err instanceof Error ? err.message : 'Invalid referral code.' }, { status: 400 })
    }

    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        const created = await prisma.waitlistSubmission.create({
          data: {
            email,
            referralCode: await generateReferralCode(),
            referredById,
            ...profileData,
          },
          include: {
            referredBy: {
              select: { id: true, name: true, referralCode: true },
            },
            _count: {
              select: { referrals: true },
            },
          },
        })

        await sendWaitlistConfirmationEmail(created.email, {
          name: created.name,
          referralLink: buildReferralLink(created.referralCode, req),
        })
        await notifyReferralMilestone(referredById)

        return Response.json({
          success: true,
          existing: false,
          profileComplete: true,
          data: waitlistResponseData(created, req),
        })
      } catch (err) {
        if (!isUniqueConstraintError(err)) throw err

        const duplicate = await findWaitlistSubmissionByEmail(email)
        if (duplicate) {
          return Response.json({
            success: true,
            existing: true,
            profileComplete: Boolean(duplicate.profileCompletedAt),
            data: waitlistResponseData(duplicate, req),
          })
        }
      }
    }

    return Response.json({ error: 'Unable to create a unique referral code. Please try again.' }, { status: 409 })
  } catch (err) {
    console.error('[POST /api/waitlist]', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
