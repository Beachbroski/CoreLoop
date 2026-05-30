export const INTERNAL_ADMIN_PATH = '/internal/waitlist'
export const INTERNAL_ADMIN_EXPORT_PATH = '/internal/waitlist/export'
export const ADMIN_SECRET_HEADER = 'x-creatordocks-admin-secret-route'

export type AdminUserLike = {
  email: string
  role: string
}

export function isProductionDeployment() {
  return process.env.VERCEL_ENV === 'production'
}

export function normalizeAdminSecretPath(value: string | undefined | null) {
  const trimmed = value?.trim()
  if (!trimmed) return null

  const withSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`
  const normalized = withSlash.replace(/\/+$/, '') || '/'
  if (normalized === '/') return null

  return normalized
}

export function getAdminSecretPath() {
  const configuredPath = normalizeAdminSecretPath(process.env.ADMIN_SECRET_PATH)
  if (configuredPath) {
    if (isProductionDeployment() && (
      configuredPath === INTERNAL_ADMIN_PATH ||
      configuredPath.startsWith(`${INTERNAL_ADMIN_PATH}/`)
    )) {
      return null
    }

    return configuredPath
  }

  return isProductionDeployment() ? null : INTERNAL_ADMIN_PATH
}

export function getAdminExportPath() {
  const adminPath = getAdminSecretPath()
  if (!adminPath) return null

  return adminPath === INTERNAL_ADMIN_PATH ? INTERNAL_ADMIN_EXPORT_PATH : `${adminPath}/export`
}

export function getAllowedAdminEmails() {
  return (process.env.ADMIN_ALLOWED_EMAILS ?? '')
    .split(',')
    .map(email => email.trim().toLowerCase())
    .filter(Boolean)
}

export function isAdminEmailAllowed(email: string | null | undefined) {
  const allowedEmails = getAllowedAdminEmails()
  if (allowedEmails.length === 0) return !isProductionDeployment()
  if (!email) return false

  return allowedEmails.includes(email.toLowerCase())
}

export function isAllowedAdminUser(user: AdminUserLike | null | undefined) {
  return Boolean(user && user.role === 'ADMIN' && isAdminEmailAllowed(user.email))
}

export function isInternalAdminPath(pathname: string) {
  return pathname === INTERNAL_ADMIN_PATH || pathname.startsWith(`${INTERNAL_ADMIN_PATH}/`)
}

export function getInternalAdminRewritePath(pathname: string) {
  const adminSecretPath = getAdminSecretPath()
  if (!adminSecretPath) return null
  if (pathname !== adminSecretPath && !pathname.startsWith(`${adminSecretPath}/`)) return null

  const suffix = pathname.slice(adminSecretPath.length)
  if (suffix === '' || suffix === '/') return INTERNAL_ADMIN_PATH
  if (suffix === '/export') return INTERNAL_ADMIN_EXPORT_PATH

  return null
}
