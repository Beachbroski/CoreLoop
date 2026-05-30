import Link from 'next/link'
import { UserButton } from '@clerk/nextjs'
import { headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import {
  ADMIN_SECRET_HEADER,
  ADMIN_SECRET_REWRITE_PARAM,
  getAdminExportPath,
  getAdminSecretPath,
  isAllowedAdminUser,
  isProductionDeployment,
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

export default async function InternalWaitlistPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const requestHeaders = await headers()
  const resolvedSearchParams = searchParams ? await searchParams : {}
  const rewriteMarker = resolvedSearchParams[ADMIN_SECRET_REWRITE_PARAM]
  if (
    isProductionDeployment() &&
    requestHeaders.get(ADMIN_SECRET_HEADER) !== '1' &&
    rewriteMarker !== '1'
  ) {
    notFound()
  }

  const adminHref = getAdminSecretPath()
  const exportHref = getAdminExportPath()
  if (!adminHref || !exportHref) {
    notFound()
  }

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
          <Link href={adminHref} className="nav-link">Ops</Link>
          <Link href="/?view=public" className="nav-link">View home</Link>
          <Link href="/waitlist?view=public" className="nav-link">View waitlist</Link>
          <Link href={exportHref} className="apple-btn-ghost">Export CSV</Link>
        </div>
      </nav>

      <main className="apple-shell" style={{ paddingTop: 28, paddingBottom: 60 }}>
        <section className="subtle-grid spacing-xl">
          <header className="page-header">
            <div className="page-header-copy">
              <span className="eyebrow">Hidden creator ops</span>
              <h1 className="page-title" style={{ marginTop: 18, marginBottom: 12 }}>
                Review CreatorDocks leads, referrals, and invite momentum.
              </h1>
              <p className="page-copy" style={{ margin: 0 }}>
                This dashboard is hidden behind your secret URL and requires your admin role plus an allowlisted email.
              </p>
            </div>
            <div className="page-header-action">
              <div className="admin-user-menu">
                <span className="pill">Admin: {adminUser.email}</span>
                <Link href="/waitlist?view=public" className="apple-btn">View as user</Link>
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
