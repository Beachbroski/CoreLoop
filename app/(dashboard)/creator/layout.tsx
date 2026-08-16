import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { DashboardNavShell } from '@/app/DashboardNavShell'
import { readRequestPathname, resolveCreatorSunsetRedirect } from '@/lib/creator-web-mode'
import { getCurrentAppUser } from '@/lib/current-app-user'
import { resolvePostLoginPath } from '@/lib/post-login'

export default async function CreatorLayout({ children }: { children: React.ReactNode }) {
  const { userId, user, email } = await getCurrentAppUser()
  if (!userId) redirect('/sign-in')

  if (!user || (user.role !== 'CREATOR' && user.role !== 'ADMIN')) redirect(resolvePostLoginPath(user, email))

  // W7-4 sunset: creator web hands off to the iOS app. Runs after the auth/role
  // checks on purpose, so only real creators (and admins) see the app landing
  // page and everyone else keeps their normal post-login routing.
  //
  // Layouts cannot read the pathname in the App Router, so the path comes from
  // request headers (see lib/creator-web-mode) and is undetermined in some
  // environments. That matters because /creator/settings must stay reachable in
  // every mode: Stripe Connect onboarding points return_url/refresh_url there,
  // and redirecting it would strand a creator mid-payout-setup. When the path is
  // unknown the resolver deliberately does not redirect, which is safe here —
  // writes are already blocked server-side in sunset mode.
  const sunsetRedirect = resolveCreatorSunsetRedirect(readRequestPathname(await headers()))
  if (sunsetRedirect) redirect(sunsetRedirect)

  return (
    <div className="dashboard-layout">
      <DashboardNavShell
        homeHref="/creator"
        homeLabel="Creator workspace"
        userName={user.name ?? user.email}
        userLabel={user.role === 'ADMIN' ? 'Creator account (admin view)' : 'Creator account'}
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
