import {
  INTERNAL_ADMIN_PATH,
  isAllowedAdminUser,
  type AdminUserLike,
} from '@/lib/admin-config'

// Single source of truth for where a signed-in user belongs.
export function resolvePostLoginPath(user: AdminUserLike | null | undefined) {
  if (isAllowedAdminUser(user)) return INTERNAL_ADMIN_PATH
  if (!user || (user.role !== 'BRAND' && user.role !== 'CREATOR')) return '/onboarding'

  return user.role === 'BRAND' ? '/brand' : '/creator'
}
