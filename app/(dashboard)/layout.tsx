import { redirect } from 'next/navigation'
import { isTesterEmailAllowed } from '@/lib/admin-config'
import { getCurrentAppUser } from '@/lib/current-app-user'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { userId, user, email } = await getCurrentAppUser()
  if (!userId) redirect('/sign-in')

  if (!isTesterEmailAllowed(email)) redirect('/waitlist')
  if (!user) redirect('/onboarding')

  return <>{children}</>
}
