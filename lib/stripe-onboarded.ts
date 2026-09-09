/**
 * The single definition of "this creator can be paid".
 *
 * Two places decide it and they must never disagree: the `account.updated`
 * webhook (app/api/webhooks/stripe/route.ts), and `GET /api/v1/stripe/status`,
 * which retrieves the account directly so the app is not stranded when a
 * webhook is delayed, dropped, or — in local development — never delivered at
 * all. Duplicating the three-part condition in both is how they drift.
 *
 * All three parts are load-bearing:
 *   details_submitted — the creator finished the Connect form.
 *   payouts_enabled   — Stripe is willing to pay out. False while a document
 *                       is under review, so `details_submitted` alone would
 *                       report a creator ready to be paid who is not.
 *   capabilities.transfers === 'active' — the specific capability this platform
 *                       requests at account creation. 'pending' or 'inactive'
 *                       means a transfer would be rejected.
 */
export function isStripeAccountOnboarded(account: {
  details_submitted?: boolean | null
  payouts_enabled?: boolean | null
  capabilities?: { transfers?: string | null } | null
}): boolean {
  return (
    Boolean(account.details_submitted) &&
    Boolean(account.payouts_enabled) &&
    account.capabilities?.transfers === 'active'
  )
}
