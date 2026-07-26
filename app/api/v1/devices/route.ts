import prisma from '@/lib/prisma'
import { withMobileApi } from '@/lib/mobile-api-guard'
import { registerDeviceRequestSchema } from '@creatordocks/shared'

export const POST = withMobileApi({ rateLimit: { limit: 20, windowMs: 60_000 } }, async ({ req, user }) => {
  const body = await req.json().catch(() => null)
  const parsed = registerDeviceRequestSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json(
      { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid request' },
      { status: 400 },
    )
  }

  // Upsert by token, not by (user, token): a device that previously
  // notified a different account (e.g. shared device, account switch)
  // must be re-pointed at the current user, not duplicated.
  await prisma.device.upsert({
    where: { expoPushToken: parsed.data.expoPushToken },
    create: {
      userId: user.id,
      expoPushToken: parsed.data.expoPushToken,
      platform: parsed.data.platform,
    },
    update: {
      userId: user.id,
      platform: parsed.data.platform,
      lastSeenAt: new Date(),
    },
  })

  return Response.json({ success: true, data: null })
})
