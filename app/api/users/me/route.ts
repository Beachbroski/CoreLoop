import { getCurrentAppUser } from '@/lib/current-app-user'
import { isAllowedAdminUser, isTesterEmailAllowed } from '@/lib/admin-config'
import { resolvePostLoginPath } from '@/lib/post-login'

export async function GET() {
  try {
    const { userId, user, email } = await getCurrentAppUser()
    if (!userId) {
      return Response.json(
        {
          authenticated: false,
          hasProfile: false,
          role: null,
          onboardingRequired: true,
          redirectTo: '/sign-in',
        },
        { status: 401 },
      )
    }

    const isAdmin = isAllowedAdminUser(user)
    const isTester = isTesterEmailAllowed(email)
    const onboardingRequired =
      isTester && !isAdmin && (!user || (user.role !== 'BRAND' && user.role !== 'CREATOR'))

    return Response.json({
      authenticated: true,
      hasProfile: Boolean(user),
      role: user?.role ?? null,
      onboardingRequired,
      redirectTo: resolvePostLoginPath(user),
    })
  } catch (err) {
    console.error('[GET /api/users/me]', err)
    return Response.json(null, { status: 500 })
  }
}
