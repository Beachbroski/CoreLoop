import { redirect } from 'next/navigation'
import { DashboardNavShell } from '@/app/DashboardNavShell'
import { getCurrentAppUser } from '@/lib/current-app-user'
import { resolvePostLoginPath } from '@/lib/post-login'

export default async function CreatorLayout({ children }: { children: React.ReactNode }) {
  const { userId, user } = await getCurrentAppUser()
  if (!userId) redirect('/sign-in')

  if (!user || user.role !== 'CREATOR') redirect(resolvePostLoginPath(user))

  return (
    <div className="dashboard-layout">
      <DashboardNavShell
        homeHref="/creator"
        homeLabel="Creator workspace"
        userName={user.name ?? user.email}
        userLabel="Creator account"
        navItems={[
          { label: 'Dashboard', href: '/creator' },
          { label: 'Browse campaigns', href: '/creator/campaigns' },
          { label: 'Applications', href: '/creator/applications' },
          { label: 'Payouts', href: '/creator/payouts' },
          { label: 'Settings', href: '/creator/settings' },
        ]}
      />
      <main className="main-shell">{children}</main>
    </div>
  )
}
