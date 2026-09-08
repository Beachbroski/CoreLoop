import { clerkClient } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'
import { withMobileApi } from '@/lib/mobile-api-guard'
import { meResponseSchema, updateMeRequestSchema } from '@creatordocks/shared'
import { anonymizeAccount } from '@/app/api/_lib/account-deletion'

const profileSelect = {
  id: true,
  name: true,
  email: true,
  avatarUrl: true,
  bio: true,
  role: true,
  stripeOnboarded: true,
} as const

export const GET = withMobileApi({ rateLimit: { limit: 60, windowMs: 60_000 } }, async ({ user }) => {
  const profile = await prisma.user.findUnique({ where: { id: user.id }, select: profileSelect })
  if (!profile) return Response.json({ success: false, error: 'Not found' }, { status: 404 })

  return Response.json({ success: true, data: meResponseSchema.parse(profile) })
})

export const PATCH = withMobileApi({ rateLimit: { limit: 20, windowMs: 60_000 } }, async ({ user, req }) => {
  const body = await req.json().catch(() => null)
  const parsed = updateMeRequestSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json(
      { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid request' },
      { status: 400 },
    )
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: parsed.data,
    select: profileSelect,
  })

  return Response.json({ success: true, data: meResponseSchema.parse(updated) })
})

/**
 * Deletion policy while a payout is still moving (W2-10, open question Q-P4).
 *
 * `true` refuses the deletion and tells the creator to wait; the alternative
 * Jackson may choose is to accept the request and defer the scrub until the
 * payout reaches PAID/FAILED. That is a product decision, so it is one flag
 * here rather than a rewrite: flip this to `false` to allow deletion during a
 * transfer (the financial rows survive either way, since they are never
 * deleted -- only the User row they point at is anonymized).
 */
const BLOCK_DELETION_WITH_IN_FLIGHT_PAYOUTS = true

/** Payout states where Stripe still owes the creator money for this account. */
const IN_FLIGHT_PAYOUT_STATUSES = ['PENDING', 'PROCESSING'] as const

/**
 * Client-facing messages. Deliberately actionable but free of internals: the
 * creator learns what to do, not which vendor failed (W5 error-handling rule).
 */
const IN_FLIGHT_PAYOUT_MESSAGE =
  'A payout is still on its way to your bank. You can delete your account once it lands, usually within a few business days.'
const CLERK_UNAVAILABLE_MESSAGE =
  "We couldn't close your account just now. Nothing was changed -- please try again in a few minutes."
const SCRUB_INCOMPLETE_MESSAGE =
  'Your sign-in has been removed, but we could not finish clearing your profile. Contact support@creatordocks.com and we will complete it.'

/**
 * A 404 from Clerk means the identity is already gone -- someone deleted it in
 * the Clerk dashboard, or an earlier attempt died after the Clerk call and
 * before the database half. Either way the goal state is reached, so we finish
 * the scrub instead of reporting an error the creator cannot act on.
 */
function isClerkUserAlreadyGone(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'status' in err && (err as { status?: number }).status === 404
}

// Apple guideline 5.1.1(v) requires in-app account deletion. This anonymizes
// rather than hard-deletes: Application/Submission/Payout rows stay intact
// (financial audit trail), while the User row's identifying fields are scrubbed,
// its Device rows (push tokens) are deleted, its Stripe pointers are cleared and
// the underlying Clerk identity is removed, revoking every session.
// See docs/platform-split/02-mobile-api.md (W2-10).
//
// ORDER: Clerk first, database second. The two stores cannot be committed
// together, so one of the two crash windows has to be chosen:
//   - DB first  → a live login pointing at an anonymized row. The person can
//     still sign in, and `getCurrentAppUser`'s email-based row adoption (API-16)
//     can then rebind that identity onto another row. Unrecoverable and unsafe.
//   - Clerk first → for the width of one HTTP call, an identified row whose
//     login is already gone. Nobody can reach it through the API (every /api/v1
//     request needs a Clerk identity), and the Clerk `user.deleted` webhook
//     re-runs exactly the same anonymization, so the window self-heals.
// Clerk first is therefore the only ordering where a mid-flight process death
// fails safe. If the Clerk call itself fails we return 502 and write NOTHING:
// the account is exactly as it was and the client can retry.
export const DELETE = withMobileApi({ rateLimit: { limit: 5, windowMs: 60_000 } }, async ({ user }) => {
  const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { clerkId: true } })
  if (!dbUser) return Response.json({ success: false, error: 'Not found' }, { status: 404 })

  if (BLOCK_DELETION_WITH_IN_FLIGHT_PAYOUTS) {
    const inFlightPayouts = await prisma.payout.count({
      where: { creatorId: user.id, status: { in: [...IN_FLIGHT_PAYOUT_STATUSES] } },
    })
    if (inFlightPayouts > 0) {
      return Response.json({ success: false, error: IN_FLIGHT_PAYOUT_MESSAGE }, { status: 409 })
    }
  }

  try {
    const clerk = await clerkClient()
    await clerk.users.deleteUser(dbUser.clerkId)
  } catch (err) {
    if (!isClerkUserAlreadyGone(err)) {
      console.error('[DELETE /api/v1/me] Clerk deleteUser failed; account left untouched', {
        userId: user.id,
        err,
      })
      return Response.json({ success: false, error: CLERK_UNAVAILABLE_MESSAGE }, { status: 502 })
    }
    console.warn('[DELETE /api/v1/me] Clerk identity was already gone; finishing the DB half', {
      userId: user.id,
    })
  }

  try {
    await anonymizeAccount(user.id)
  } catch (err) {
    // The login is already gone, so the account IS closed from the creator's
    // side; only the scrub is outstanding. Say so rather than reporting a
    // success we did not achieve — the `user.deleted` webhook will retry it.
    console.error('[DELETE /api/v1/me] anonymization failed after the Clerk identity was deleted', {
      userId: user.id,
      err,
    })
    return Response.json({ success: false, error: SCRUB_INCOMPLETE_MESSAGE }, { status: 500 })
  }

  return Response.json({ success: true, data: null })
})
