import { currentUser } from '@clerk/nextjs/server'
import { z } from 'zod'
import prisma from '@/lib/prisma'
import { isTesterEmailAllowed } from '@/lib/admin-config'
import { getCurrentAppUser } from '@/lib/current-app-user'
import { checkRateLimit, getRequestIp, isTrustedOrigin } from '@/lib/request-security'

const schema = z.object({
  role: z.enum(['BRAND', 'CREATOR']),
})

export async function PATCH(req: Request) {
  try {
    if (!isTrustedOrigin(req)) {
      return Response.json({ error: 'Invalid request origin' }, { status: 403 })
    }

    const { userId, email } = await getCurrentAppUser()
    if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    if (!isTesterEmailAllowed(email)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 })
    }

    const rateLimit = checkRateLimit(`users:role:${userId}:${getRequestIp(req)}`, {
      limit: 10,
      windowMs: 60_000,
    })
    if (!rateLimit.ok) {
      return Response.json(
        { error: 'Too many role update attempts. Please try again shortly.' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } },
      )
    }

    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    const existingUser = await prisma.user.findUnique({
      where: { clerkId: userId },
    })

    if (existingUser) {
      if (existingUser.role === 'ADMIN') {
        return Response.json(
          { error: 'Admin accounts cannot change role here' },
          { status: 409 },
        )
      }

      const [campaignCount, applicationCount] = await Promise.all([
        prisma.campaign.count({ where: { brandId: existingUser.id } }),
        prisma.application.count({ where: { creatorId: existingUser.id } }),
      ])

      if (campaignCount > 0 || applicationCount > 0) {
        return Response.json(
          { error: 'Role cannot be changed after activity has begun' },
          { status: 409 },
        )
      }

      const user = await prisma.user.update({
        where: { id: existingUser.id },
        data: { role: parsed.data.role },
      })

      return Response.json({
        success: true,
        data: user,
        redirectTo: user.role === 'BRAND' ? '/brand' : '/creator',
      })
    }

    const clerkUser = await currentUser()
    if (!clerkUser) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const primaryEmail = clerkUser.emailAddresses[0]?.emailAddress
    if (!primaryEmail) {
      return Response.json({ error: 'Unable to determine account email' }, { status: 400 })
    }

    const matchedByEmail = await prisma.user.findUnique({
      where: { email: primaryEmail },
    })

    if (matchedByEmail) {
      const user = await prisma.user.update({
        where: { id: matchedByEmail.id },
        data: {
          clerkId: userId,
          name: `${clerkUser.firstName ?? ''} ${clerkUser.lastName ?? ''}`.trim() || null,
          avatarUrl: clerkUser.imageUrl,
          role: parsed.data.role,
        },
      })

      return Response.json({
        success: true,
        data: user,
        redirectTo: user.role === 'BRAND' ? '/brand' : '/creator',
      })
    }

    const user = await prisma.user.create({
      data: {
        clerkId: userId,
        email: primaryEmail,
        name: `${clerkUser.firstName ?? ''} ${clerkUser.lastName ?? ''}`.trim() || null,
        avatarUrl: clerkUser.imageUrl,
        role: parsed.data.role,
      },
    })

    return Response.json({
      success: true,
      data: user,
      redirectTo: user.role === 'BRAND' ? '/brand' : '/creator',
    })
  } catch (err) {
    console.error('[PATCH /api/users/role]', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
