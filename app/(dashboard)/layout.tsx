import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import prisma from '@/lib/prisma'
import { DashboardNavShell } from '@/app/DashboardNavShell'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const user = await prisma.user.findUnique({ where: { clerkId: userId } })
  if (!user) redirect('/onboarding')

  const isBrand = user.role === 'BRAND'
  const navItems = isBrand
    ? [
        { label: 'Dashboard', href: '/brand' },
        { label: 'New Campaign', href: '/brand/campaigns/new' },
      ]
    : [
        { label: 'Dashboard', href: '/creator' },
        { label: 'Browse Campaigns', href: '/creator/campaigns' },
        { label: 'My Applications', href: '/creator/applications' },
        { label: 'Settings', href: '/creator/settings' },
      ]

  return (
    <div className="dashboard-layout">
      <DashboardNavShell
        homeHref={isBrand ? '/brand' : '/creator'}
        homeLabel={isBrand ? 'Brand workspace' : 'Creator workspace'}
        userName={user.name ?? user.email}
        userLabel={isBrand ? 'Brand account' : 'Creator account'}
        navItems={navItems}
      />

      <main className="main-shell">
        <div className="apple-shell" style={{ width: 'min(1100px, 100%)' }}>
          {children}
        </div>
      </main>
    </div>
  )
}
