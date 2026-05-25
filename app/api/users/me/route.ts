import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return Response.json(null, { status: 401 })

    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { role: true },
    })

    return Response.json(user)
  } catch (err) {
    console.error('[GET /api/users/me]', err)
    return Response.json(null, { status: 500 })
  }
}
