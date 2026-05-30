import { getCurrentAppUser } from '@/lib/current-app-user'
import { getAdminSecretPath, isAllowedAdminUser } from '@/lib/admin-config'

export async function GET() {
  try {
    const { userId, user } = await getCurrentAppUser()
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

    if (!user) {
      return Response.json({
        authenticated: true,
        hasProfile: false,
        role: null,
        onboardingRequired: false,
        redirectTo: '/waitlist',
      })
    }

    const isAdmin = isAllowedAdminUser(user)
    const redirectTo = isAdmin ? (getAdminSecretPath() ?? '/waitlist') : '/waitlist'

    return Response.json({
      authenticated: true,
      hasProfile: true,
      role: isAdmin ? user.role : null,
      onboardingRequired: false,
      redirectTo,
    })
  } catch (err) {
    console.error('[GET /api/users/me]', err)
    return Response.json(null, { status: 500 })
  }
}
