import { redirect } from 'next/navigation'
import { getCurrentAppUser } from '@/lib/current-app-user'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { userId, user } = await getCurrentAppUser()
  if (!userId) redirect('/sign-in')

  if (!user) redirect('/onboarding')

  return <>{children}</>
}
