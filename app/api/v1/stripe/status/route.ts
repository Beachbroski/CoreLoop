import prisma from '@/lib/prisma'
import { withMobileApi } from '@/lib/mobile-api-guard'
import { stripeStatusResponseSchema } from '@creatordocks/shared'

export const GET = withMobileApi(
  { rateLimit: { limit: 60, windowMs: 60_000 }, role: 'CREATOR' },
  async ({ user }) => {
    const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { stripeOnboarded: true } })
    if (!dbUser) return Response.json({ success: false, error: 'Not found' }, { status: 404 })

    return Response.json({
      success: true,
      data: stripeStatusResponseSchema.parse({ onboarded: dbUser.stripeOnboarded }),
    })
  },
)
