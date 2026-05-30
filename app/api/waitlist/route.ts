import { z } from 'zod'
import prisma from '@/lib/prisma'
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

function makeBaseReferralCode(seed: string) {
  const compact = seed.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
  return (compact.slice(0, 6) || 'CREATOR').padEnd(6, 'X')
}

async function generateReferralCode(seed: string) {
  const base = makeBaseReferralCode(seed)

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const suffix = Math.random().toString(36).slice(2, 6).toUpperCase()
    const code = `${base}${suffix}`
    const existing = await prisma.waitlistSubmission.findUnique({ where: { referralCode: code } })
    if (!existing) return code
  }

  return `${base}${crypto.randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase()}`
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

    const rateLimit = checkRateLimit(`waitlist:create:${getRequestIp(req)}`, {
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
      if (existing) {
        return Response.json({
          success: true,
          existing: true,
          profileComplete: Boolean(existing.profileCompletedAt),
          data: waitlistResponseData(existing, req),
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
              referralCode: await generateReferralCode(email),
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

          return Response.json({
            success: true,
            existing: false,
            profileComplete: false,
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
            referralCode: await generateReferralCode(parsed.data.name || email),
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
