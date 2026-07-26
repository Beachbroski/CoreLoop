import prisma from '@/lib/prisma'
import { withMobileApi } from '@/lib/mobile-api-guard'
import { meResponseSchema, updateMeRequestSchema } from '@creatordocks/shared'

const profileSelect = {
  id: true,
  name: true,
  email: true,
  avatarUrl: true,
  bio: true,
  role: true,
  stripeOnboarded: true,
} as const

export const GET = withMobileApi({ rateLimit: { limit: 60, windowMs: 60_000 } }, async ({ user }) => {
  const profile = await prisma.user.findUnique({ where: { id: user.id }, select: profileSelect })
  if (!profile) return Response.json({ success: false, error: 'Not found' }, { status: 404 })

  return Response.json({ success: true, data: meResponseSchema.parse(profile) })
})

export const PATCH = withMobileApi({ rateLimit: { limit: 20, windowMs: 60_000 } }, async ({ user, req }) => {
  const body = await req.json().catch(() => null)
  const parsed = updateMeRequestSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json(
      { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid request' },
      { status: 400 },
    )
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: parsed.data,
    select: profileSelect,
  })

  return Response.json({ success: true, data: meResponseSchema.parse(updated) })
})
