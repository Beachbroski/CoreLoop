import { currentUser } from '@clerk/nextjs/server'
import type { Role } from '@prisma/client'
import { z } from 'zod'
import prisma from '@/lib/prisma'
import { isTesterEmailAllowed } from '@/lib/admin-config'
import { getCurrentAppUser } from '@/lib/current-app-user'
import { checkRateLimit, getRequestIp, isTrustedOrigin } from '@/lib/request-security'

const schema = z.object({
  role: z.enum(['BRAND', 'CREATOR']),
})

/**
 * The only User columns this endpoint returns. Mirrors `meResponseSchema` in
 * packages/shared/src/user.ts so the legacy route and the /api/v1 contract
 * agree on one rule: `clerkId` and `stripeAccountId` never leave the server.
 */
const PROFILE_SELECT = {
  id: true,
  name: true,
  email: true,
  avatarUrl: true,
  bio: true,
  role: true,
  stripeOnboarded: true,
} as const

type RoleProfile = {
  id: string
  name: string | null
  email: string
  avatarUrl: string | null
  bio: string | null
  role: Role
  stripeOnboarded: boolean
}

type ClerkUser = NonNullable<Awaited<ReturnType<typeof currentUser>>>
type ClerkEmailAddress = ClerkUser['emailAddresses'][number]

/** Clerk considers an address usable only once its verification reaches this. */
const VERIFIED_STATUS = 'verified'

const UNVERIFIED_EMAIL_MESSAGE =
  'Verify your email address before choosing a role. An unverified address cannot be linked to an existing account.'

/**
 * Clerk's `emailAddresses` array is unordered and contains unverified
 * addresses too, so index 0 is not "the account's email". Resolve the address
 * Clerk itself marks primary, and only fall back to the first entry when the
 * account has no primary — the same resolution lib/current-app-user.ts uses.
 */
function resolvePrimaryEmailAddress(clerkUser: ClerkUser): ClerkEmailAddress | null {
  return (
    clerkUser.emailAddresses.find(email => email.id === clerkUser.primaryEmailAddressId) ??
    clerkUser.emailAddresses[0] ??
    null
  )
}

/**
 * An unverified address proves nothing about who owns it: anyone can attach
 * someone else's address to their own Clerk account. Attaching one must never
 * be enough to claim an existing User row.
 */
function isVerified(emailAddress: ClerkEmailAddress | null): boolean {
  return emailAddress?.verification?.status === VERIFIED_STATUS
}

function displayName(clerkUser: ClerkUser): string | null {
  return `${clerkUser.firstName ?? ''} ${clerkUser.lastName ?? ''}`.trim() || null
}

function roleResponse(user: RoleProfile) {
  return Response.json({
    success: true,
    data: user,
    redirectTo: user.role === 'BRAND' ? '/brand' : '/creator',
  })
}

export async function PATCH(req: Request) {
  try {
    if (!isTrustedOrigin(req)) {
      return Response.json({ error: 'Invalid request origin' }, { status: 403 })
    }

    const { userId, email } = await getCurrentAppUser()
    if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    if (!isTesterEmailAllowed(email)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 })
    }

    const rateLimit = await checkRateLimit(`users:role:${userId}:${getRequestIp(req)}`, {
      limit: 10,
      windowMs: 60_000,
    })
    if (!rateLimit.ok) {
      return Response.json(
        { error: 'Too many role update attempts. Please try again shortly.' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } },
      )
    }

    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    const existingUser = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { id: true, role: true },
    })

    if (existingUser) {
      if (existingUser.role === 'ADMIN') {
        return Response.json(
          { error: 'Admin accounts cannot change role here' },
          { status: 409 },
        )
      }

      const [campaignCount, applicationCount] = await Promise.all([
        prisma.campaign.count({ where: { brandId: existingUser.id } }),
        prisma.application.count({ where: { creatorId: existingUser.id } }),
      ])

      if (campaignCount > 0 || applicationCount > 0) {
        return Response.json(
          { error: 'Role cannot be changed after activity has begun' },
          { status: 409 },
        )
      }

      const user = await prisma.user.update({
        where: { id: existingUser.id },
        data: { role: parsed.data.role },
        select: PROFILE_SELECT,
      })

      return roleResponse(user)
    }

    const clerkUser = await currentUser()
    if (!clerkUser) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const primaryEmailAddress = resolvePrimaryEmailAddress(clerkUser)
    const primaryEmail = primaryEmailAddress?.emailAddress
    if (!primaryEmail) {
      return Response.json({ error: 'Unable to determine account email' }, { status: 400 })
    }

    const matchedByEmail = await prisma.user.findUnique({
      where: { email: primaryEmail },
      select: { id: true },
    })

    if (matchedByEmail) {
      // Rebinding hands this Clerk identity an existing account, including its
      // role. Only a verified address may do that.
      if (!isVerified(primaryEmailAddress)) {
        return Response.json({ error: UNVERIFIED_EMAIL_MESSAGE }, { status: 403 })
      }

      const user = await prisma.user.update({
        where: { id: matchedByEmail.id },
        data: {
          clerkId: userId,
          name: displayName(clerkUser),
          avatarUrl: clerkUser.imageUrl,
          role: parsed.data.role,
        },
        select: PROFILE_SELECT,
      })

      return roleResponse(user)
    }

    const user = await prisma.user.create({
      data: {
        clerkId: userId,
        email: primaryEmail,
        name: displayName(clerkUser),
        avatarUrl: clerkUser.imageUrl,
        role: parsed.data.role,
      },
      select: PROFILE_SELECT,
    })

    return roleResponse(user)
  } catch (err) {
    console.error('[PATCH /api/users/role]', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
