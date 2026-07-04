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

export function getAllowedTesterEmails() {
  const raw = process.env.TESTER_ALLOWED_EMAILS ?? process.env.ADMIN_ALLOWED_EMAILS ?? ''
  return raw
    .split(',')
    .map(email => email.trim().toLowerCase())
    .filter(Boolean)
}

// Admin emails are implicitly testers; TESTER_ALLOWED_EMAILS adds non-admin testers.
export function isTesterEmailAllowed(email: string | null | undefined) {
  const allowed = new Set([...getAllowedTesterEmails(), ...getAllowedAdminEmails()])
  if (allowed.size === 0) return process.env.NODE_ENV === 'development'
  if (!email) return false

  return allowed.has(email.toLowerCase())
}
