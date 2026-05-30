import { auth, currentUser } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'

export async function getCurrentAppUser() {
  const { userId } = await auth()
  if (!userId) return { userId: null, user: null }

  const userByClerkId = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: { id: true, email: true, role: true },
  })

  if (userByClerkId) return { userId, user: userByClerkId }

  const clerkUser = await currentUser()
  const primaryEmail =
    clerkUser?.emailAddresses.find(email => email.id === clerkUser.primaryEmailAddressId)?.emailAddress ??
    clerkUser?.emailAddresses[0]?.emailAddress

  if (!primaryEmail) return { userId, user: null }

  const userByEmail = await prisma.user.findUnique({
    where: { email: primaryEmail },
    select: { id: true, email: true, role: true },
  })

  if (!userByEmail) return { userId, user: null }

  const repairedUser = await prisma.user.update({
    where: { id: userByEmail.id },
    data: {
      clerkId: userId,
      name: `${clerkUser?.firstName ?? ''} ${clerkUser?.lastName ?? ''}`.trim() || null,
      avatarUrl: clerkUser?.imageUrl ?? null,
    },
    select: { id: true, email: true, role: true },
  })

  return { userId, user: repairedUser }
}
