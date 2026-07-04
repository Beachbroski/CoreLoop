import {
  INTERNAL_ADMIN_PATH,
  isAllowedAdminUser,
  isTesterEmailAllowed,
  type AdminUserLike,
} from '@/lib/admin-config'

// Single source of truth for where a signed-in user belongs.
export function resolvePostLoginPath(
  user: AdminUserLike | null | undefined,
  email: string | null | undefined,
) {
  if (isAllowedAdminUser(user)) return INTERNAL_ADMIN_PATH
  if (!isTesterEmailAllowed(email)) return '/waitlist'
  if (!user || (user.role !== 'BRAND' && user.role !== 'CREATOR')) return '/onboarding'

  return user.role === 'BRAND' ? '/brand' : '/creator'
}
