export const INTERNAL_ADMIN_PATH = '/internal/waitlist'
export const INTERNAL_ADMIN_EXPORT_PATH = '/internal/waitlist/export'

export type AdminUserLike = {
  email: string
  role: string
}

export function isProductionDeployment() {
  return process.env.VERCEL_ENV === 'production'
}

export function getAllowedAdminEmails() {
  return (process.env.ADMIN_ALLOWED_EMAILS ?? '')
    .split(',')
    .map(email => email.trim().toLowerCase())
    .filter(Boolean)
}

export function isAdminEmailAllowed(email: string | null | undefined) {
  const allowedEmails = getAllowedAdminEmails()
  // An empty allowlist only opens up local development, never preview or production.
  if (allowedEmails.length === 0) return process.env.NODE_ENV === 'development'
  if (!email) return false

  return allowedEmails.includes(email.toLowerCase())
}

export function isAllowedAdminUser(user: AdminUserLike | null | undefined) {
  return Boolean(user && user.role === 'ADMIN' && isAdminEmailAllowed(user.email))
}

/**
 * Who may use the marketplace (campaigns, applications, submissions, payments).
 *
 *  - `invite`  the TESTER/ADMIN email allowlist decides. Today's behavior.
 *  - `open`    any signed-in user with a role may use it (self-serve).
 *
 * Unset resolves to `invite`, deliberately: an unrecognised or missing value
 * must never be the one that throws the marketplace open. Same fail-closed
 * reasoning as CREATOR_WEB_MODE (lib/creator-web-mode.ts), and the same
 * operational consequence -- opening up is an explicit act, in one place.
 *
 * Sequencing note: `open` is only safe once payments actually work end to end.
 * A brand who can sign up and create a campaign but cannot be charged is a
 * worse experience than one who was never let in, so this stays `invite` until
 * the Stripe keys are live and one real payment has been verified.
 * See docs/BLOCKED-ON-JACKSON.md items 1 and 5.
 */
export type MarketplaceAccess = 'invite' | 'open'

export function getMarketplaceAccess(): MarketplaceAccess {
  return process.env.MARKETPLACE_ACCESS?.trim().toLowerCase() === 'open' ? 'open' : 'invite'
}

export function isMarketplaceOpen(): boolean {
  return getMarketplaceAccess() === 'open'
}

export function getAllowedTesterEmails() {
  const raw = process.env.TESTER_ALLOWED_EMAILS ?? process.env.ADMIN_ALLOWED_EMAILS ?? ''
  return raw
    .split(',')
    .map(email => email.trim().toLowerCase())
    .filter(Boolean)
}

// Admin emails are implicitly testers; TESTER_ALLOWED_EMAILS adds non-admin testers.
export function isTesterEmailAllowed(email: string | null | undefined) {
  // Self-serve: the allowlist stops being the gate. Authentication, role checks
  // and object-level authorization are all untouched -- this only decides
  // whether an authenticated user is *permitted on the platform at all*.
  if (isMarketplaceOpen()) return true

  const allowed = new Set([...getAllowedTesterEmails(), ...getAllowedAdminEmails()])
  if (allowed.size === 0) return process.env.NODE_ENV === 'development'
  if (!email) return false

  return allowed.has(email.toLowerCase())
}
