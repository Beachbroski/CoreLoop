import prisma from '@/lib/prisma'

/**
 * Account closure, shared by the two paths that can trigger it:
 * `DELETE /api/v1/me` (creator taps "Delete account" in the app) and the Clerk
 * `user.deleted` webhook (deletion started at Clerk, or a crash left the route
 * half-finished — see the ordering note in app/api/v1/me/route.ts).
 *
 * It lives here rather than in lib/ because both callers are API routes and
 * `_lib` is excluded from routing by Next's private-folder convention.
 *
 * We anonymize rather than hard-delete: Application/Submission/Payout rows are
 * a financial and contractual audit trail the brand side still needs, so they
 * stay, pointing at a User row with no identifying content left in it.
 */

/** Owned by us and reserved by RFC 2606, so a stray email can never be delivered. */
export const DELETED_ACCOUNT_EMAIL_DOMAIN = 'deleted.creatordocks.invalid'

/**
 * `clerkId` and `email` are both unique + NOT NULL, so they cannot be nulled;
 * they get a per-row placeholder derived from the (non-identifying) cuid.
 *
 * `stripeAccountId` is cleared so nothing in this codebase can reach the
 * creator's Connect account again. The account itself is NOT deauthorized —
 * that is Q-P4, open. Consequence to know before flipping that: once this
 * column is null the only way back to the Connect account is the Stripe
 * dashboard (via `Payout.stripeTransferId`).
 */
export function anonymizedUserFields(userId: string) {
  return {
    name: null,
    avatarUrl: null,
    bio: null,
    email: `deleted-${userId}@${DELETED_ACCOUNT_EMAIL_DOMAIN}`,
    clerkId: `deleted-${userId}`,
    stripeAccountId: null,
    stripeOnboarded: false,
  } as const
}

/**
 * Scrubs the User row and removes every Device row in ONE transaction: a push
 * token that outlives the account keeps delivering notifications to a phone
 * whose owner was told the account is gone (PUSH-11), so the two writes must
 * not be able to land apart.
 *
 * Idempotent by construction — re-running it on an already-anonymized row
 * writes the same placeholders and deletes zero devices.
 */
export async function anonymizeAccount(userId: string): Promise<void> {
  await prisma.$transaction([
    prisma.device.deleteMany({ where: { userId } }),
    prisma.user.update({ where: { id: userId }, data: anonymizedUserFields(userId) }),
  ])
}

/**
 * Webhook entry point. Returns `'not-found'` (not an error) when no row matches:
 * the row was already anonymized by the route, or the Clerk identity never had
 * one. Both are success — the caller must ack, or Clerk redelivers forever.
 */
export async function anonymizeAccountByClerkId(
  clerkId: string,
): Promise<'anonymized' | 'not-found'> {
  const existing = await prisma.user.findUnique({ where: { clerkId }, select: { id: true } })
  if (!existing) return 'not-found'

  await anonymizeAccount(existing.id)
  return 'anonymized'
}
