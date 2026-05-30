import { redirect } from 'next/navigation'
import { isAllowedAdminUser } from '@/lib/admin-config'
import { getCurrentAppUser } from '@/lib/current-app-user'

export default async function BrandLayout({ children }: { children: React.ReactNode }) {
  const { userId, user } = await getCurrentAppUser()
  if (!userId) redirect('/sign-in')

  if (!isAllowedAdminUser(user)) redirect('/waitlist')

  return <>{children}</>
}
