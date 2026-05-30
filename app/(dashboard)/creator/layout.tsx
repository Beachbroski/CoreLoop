import { redirect } from 'next/navigation'
import { getCurrentAppUser } from '@/lib/current-app-user'

export default async function CreatorLayout({ children }: { children: React.ReactNode }) {
  const { userId, user } = await getCurrentAppUser()
  if (!userId) redirect('/sign-in')

  if (!user) redirect('/waitlist')
  if (user.role !== 'ADMIN') redirect('/waitlist')

  return <>{children}</>
}
