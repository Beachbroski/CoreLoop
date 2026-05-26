import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import prisma from '@/lib/prisma'

export default async function BrandLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const user = await prisma.user.findUnique({ where: { clerkId: userId } })
  if (!user) redirect('/onboarding')
  if (user.role !== 'BRAND') {
    if (user.role === 'CREATOR') redirect('/creator')
    redirect('/onboarding')
  }

  return <>{children}</>
}
