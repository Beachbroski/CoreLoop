import { redirect } from 'next/navigation'
import { DashboardNavShell } from '@/app/DashboardNavShell'
import { getCurrentAppUser } from '@/lib/current-app-user'
import { resolvePostLoginPath } from '@/lib/post-login'

export default async function BrandLayout({ children }: { children: React.ReactNode }) {
  const { userId, user, email } = await getCurrentAppUser()
  if (!userId) redirect('/sign-in')

  if (!user || (user.role !== 'BRAND' && user.role !== 'ADMIN')) redirect(resolvePostLoginPath(user, email))

  return (
    <div className="dashboard-layout">
      <DashboardNavShell
        homeHref="/brand"
        homeLabel="Brand workspace"
        userName={user.name ?? user.email}
        userLabel={user.role === 'ADMIN' ? 'Brand account (admin view)' : 'Brand account'}
        navItems={[
          { label: 'Dashboard', href: '/brand' },
          { label: 'New campaign', href: '/brand/campaigns/new' },
          { label: 'Applications', href: '/brand/applications' },
          { label: 'Settings', href: '/brand/settings' },
        ]}
      />
      <main className="main-shell">{children}</main>
    </div>
  )
}
