import prisma from '@/lib/prisma'
import { withMobileApi } from '@/lib/mobile-api-guard'

type RouteContext = { params: Promise<{ token: string }> }

export const DELETE = withMobileApi<RouteContext>(
  { rateLimit: { limit: 20, windowMs: 60_000 } },
  async ({ user, context }) => {
    const { token } = await context.params

    const device = await prisma.device.findUnique({ where: { expoPushToken: token } })
    if (!device || device.userId !== user.id) {
      return Response.json({ success: false, error: 'Device not found' }, { status: 404 })
    }

    await prisma.device.delete({ where: { expoPushToken: token } })

    return Response.json({ success: true, data: null })
  },
)
