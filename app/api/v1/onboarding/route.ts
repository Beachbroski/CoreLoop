import { currentUser } from '@clerk/nextjs/server'
import { isTesterEmailAllowed } from '@/lib/admin-config'
import { getCurrentAppUser } from '@/lib/current-app-user'
import { withMobileAuthOnly } from '@/lib/mobile-api-guard'
import prisma from '@/lib/prisma'
import { meResponseSchema } from '@creatordocks/shared'

const profileSelect = {
  id: true,
  name: true,
  email: true,
  avatarUrl: true,
  bio: true,
  role: true,
  stripeOnboarded: true,
} as const

/**
 * Machine-readable so the app can tell "you aren't invited yet" (show the
 * waitlist screen) apart from a generic failure (show a retry).
 */
export const NOT_INVITED_ERROR = 'NOT_INVITED'

/**
 * POST /api/v1/onboarding — idempotently ensures the signed-in Clerk identity
 * has a User row, creating it as a CREATOR if not.
 *
 * Why this exists: rows were only ever created by the web onboarding flow
 * (/api/users/role), so a creator who signs up in the iOS app had a Clerk
 * identity and no row — and every /api/v1 call 401'd forever with no way to
 * recover. That web route can't be reused from the app: it enforces an
 * origin check (Expo sends no Origin header) and doesn't speak the v1
 * envelope.
 *
 * Role is always CREATOR: the iOS app is the creator surface. Brands onboard
 * on web, where they pick a role. An existing BRAND/ADMIN signing in here
 * keeps their role — this never rewrites one.
 */
export const POST = withMobileAuthOnly(
  { rateLimit: { limit: 10, windowMs: 60_000 } },
  async ({ clerkUserId }) => {
    // Resolves an existing row by clerkId, and adopts a row matching the
    // verified email (repairing clerkId) — so a creator who onboarded on web
    // and then installs the app lands here with their existing account.
    const { user: existing } = await getCurrentAppUser()
    if (existing) {
      const profile = await prisma.user.findUnique({ where: { id: existing.id }, select: profileSelect })
      if (!profile) return Response.json({ success: false, error: 'Not found' }, { status: 404 })
      return Response.json({ success: true, data: meResponseSchema.parse(profile) })
    }

    const clerkUser = await currentUser()
    // Prefer the primary address. /api/users/role and the Clerk webhook both
    // read emailAddresses[0] instead, which is not necessarily the primary.
    const primaryEmail =
      clerkUser?.emailAddresses.find(email => email.id === clerkUser.primaryEmailAddressId)?.emailAddress ??
      clerkUser?.emailAddresses[0]?.emailAddress

    if (!primaryEmail) {
      return Response.json(
        { success: false, error: 'Unable to determine account email' },
        { status: 400 },
      )
    }

    // CreatorDocks is invite-only while in waitlist mode, and the same gate
    // guards web account creation. Without it the app would be a backdoor
    // around the waitlist.
    if (!isTesterEmailAllowed(primaryEmail)) {
      return Response.json({ success: false, error: NOT_INVITED_ERROR }, { status: 403 })
    }

    const created = await prisma.user.create({
      data: {
        clerkId: clerkUserId,
        email: primaryEmail,
        name: `${clerkUser?.firstName ?? ''} ${clerkUser?.lastName ?? ''}`.trim() || null,
        avatarUrl: clerkUser?.imageUrl ?? null,
        role: 'CREATOR',
      },
      select: profileSelect,
    })

    return Response.json({ success: true, data: meResponseSchema.parse(created) }, { status: 201 })
  },
)
