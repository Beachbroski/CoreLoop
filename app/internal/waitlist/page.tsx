import Link from 'next/link'
import { UserButton } from '@clerk/nextjs'
import { notFound, redirect } from 'next/navigation'
import {
  INTERNAL_ADMIN_EXPORT_PATH,
  INTERNAL_ADMIN_PATH,
  isAllowedAdminUser,
} from '@/lib/admin-config'
import prisma from '@/lib/prisma'
import { getCurrentAppUser } from '@/lib/current-app-user'
import { getSiteUrl } from '@/lib/site-url'
import { AdminSignOutButton } from './AdminSignOutButton'
import {
  AdminWaitlistDashboard,
  type AdminWaitlistSubmission,
} from './AdminWaitlistDashboard'

function buildReferralLink(referralCode: string) {
  const siteUrl = getSiteUrl()
  if (!siteUrl) return `/waitlist?ref=${referralCode}`

  try {
    return new URL(`/waitlist?ref=${referralCode}`, siteUrl).toString()
  } catch {
    return `/waitlist?ref=${referralCode}`
  }
}

export default async function InternalWaitlistPage() {
  const adminHref = INTERNAL_ADMIN_PATH
  const exportHref = INTERNAL_ADMIN_EXPORT_PATH

  const { userId, user } = await getCurrentAppUser()
  if (!userId) redirect('/sign-in')

  if (!user || !isAllowedAdminUser(user)) {
    notFound()
  }
  const adminUser = user

  const submissions = await prisma.waitlistSubmission.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      referredBy: {
        select: { name: true, referralCode: true },
      },
      _count: {
        select: { referrals: true },
      },
    },
  })

  const dashboardSubmissions: AdminWaitlistSubmission[] = submissions.map(submission => ({
    id: submission.id,
    name: submission.name,
    email: submission.email,
    primaryPlatform: submission.primaryPlatform,
    handle: submission.handle,
    niche: submission.niche,
    followerRange: submission.followerRange,
    referralCode: submission.referralCode,
    referralLink: buildReferralLink(submission.referralCode),
    referralCount: submission._count.referrals,
    status: submission.status,
    referredBy: submission.referredBy,
    profileCompletedAt: submission.profileCompletedAt?.toISOString() ?? null,
    createdAt: submission.createdAt.toISOString(),
  }))

  return (
    <div>
      <nav className="apple-nav">
        <Link href={adminHref} className="brand-lockup">
          <span className="brand-mark" />
          <span className="brand-wordmark">CreatorDocks</span>
        </Link>
        <div className="nav-links">
          <Link href="/?preview=admin" className="nav-link">View home</Link>
          <Link href={exportHref} className="apple-btn-ghost">Export CSV</Link>
        </div>
      </nav>

      <main className="apple-shell" style={{ paddingTop: 28, paddingBottom: 60 }}>
        <section className="subtle-grid spacing-xl">
          <header className="page-header">
            <div className="page-header-copy">
              <span className="eyebrow">Creator ops</span>
              <h1 className="page-title" style={{ marginTop: 18, marginBottom: 12 }}>
                Review CreatorDocks leads, referrals, and invite momentum.
              </h1>
              <p className="page-copy" style={{ margin: 0 }}>
                This dashboard requires an admin account with an allowlisted email; everyone else sees a 404.
              </p>
            </div>
            <div className="page-header-action">
              <div className="admin-user-menu">
                <span className="pill">Admin: {adminUser.email}</span>
                <Link href="/waitlist?preview=admin" className="apple-btn">Preview waitlist</Link>
                <AdminSignOutButton />
                <UserButton appearance={{ elements: { avatarBox: 'w-10 h-10' } }} />
              </div>
            </div>
          </header>

          <AdminWaitlistDashboard submissions={dashboardSubmissions} exportHref={exportHref} />
        </section>
      </main>
    </div>
  )
}
