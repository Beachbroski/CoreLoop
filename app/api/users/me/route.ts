import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'

export async function GET() {
  try {
    const { userId } = await auth()
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

    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { role: true },
    })

    if (!user) {
      return Response.json({
        authenticated: true,
        hasProfile: false,
        role: null,
        onboardingRequired: true,
        redirectTo: '/onboarding',
      })
    }

    const isSupportedRole = user.role === 'BRAND' || user.role === 'CREATOR'
    const redirectTo = user.role === 'BRAND'
      ? '/brand'
      : user.role === 'CREATOR'
        ? '/creator'
        : '/onboarding'

    return Response.json({
      authenticated: true,
      hasProfile: true,
      role: isSupportedRole ? user.role : null,
      onboardingRequired: !isSupportedRole,
      redirectTo,
    })
  } catch (err) {
    console.error('[GET /api/users/me]', err)
    return Response.json(null, { status: 500 })
  }
}
