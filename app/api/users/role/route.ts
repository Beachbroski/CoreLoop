import { auth, currentUser } from '@clerk/nextjs/server'
import { z } from 'zod'
import prisma from '@/lib/prisma'

const schema = z.object({
  role: z.enum(['BRAND', 'CREATOR']),
})

export async function PATCH(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    const existingUser = await prisma.user.findUnique({
      where: { clerkId: userId },
    })

    if (existingUser) {
      const user = await prisma.user.update({
        where: { id: existingUser.id },
        data: { role: parsed.data.role },
      })

      return Response.json({ success: true, data: user })
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

      return Response.json({ success: true, data: user })
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

    return Response.json({ success: true, data: user })
  } catch (err) {
    console.error('[PATCH /api/users/role]', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
