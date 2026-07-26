import { clerkClient } from '@clerk/nextjs/server'
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

// Apple guideline 5.1.1(v) requires in-app account deletion. Anonymizes
// rather than hard-deletes: Application/Submission/Payout rows stay intact
// (financial audit trail) but the User row's own identifying fields are
// scrubbed and the underlying Clerk identity is removed, revoking all
// sessions. See docs/platform-split/02-mobile-api.md (W2-10).
export const DELETE = withMobileApi({ rateLimit: { limit: 5, windowMs: 60_000 } }, async ({ user }) => {
  const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { clerkId: true } })
  if (!dbUser) return Response.json({ success: false, error: 'Not found' }, { status: 404 })

  await prisma.user.update({
    where: { id: user.id },
    data: {
      name: null,
      avatarUrl: null,
      bio: null,
      email: `deleted-${user.id}@deleted.creatordocks.invalid`,
      clerkId: `deleted-${user.id}`,
    },
  })

  try {
    const clerk = await clerkClient()
    await clerk.users.deleteUser(dbUser.clerkId)
  } catch (err) {
    console.error('[DELETE /api/v1/me] failed to delete Clerk user', err)
  }

  return Response.json({ success: true, data: null })
})
