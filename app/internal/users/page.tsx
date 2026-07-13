import Link from 'next/link'
import { redirect } from 'next/navigation'
import { INTERNAL_ADMIN_PATH, isAllowedAdminUser } from '@/lib/admin-config'
import { getCurrentAppUser } from '@/lib/current-app-user'
import { resolvePostLoginPath } from '@/lib/post-login'
import prisma from '@/lib/prisma'

export default async function InternalUsersPage() {
  const { userId, user, email } = await getCurrentAppUser()
  if (!userId) redirect('/sign-in')
  if (!user || !isAllowedAdminUser(user)) redirect(resolvePostLoginPath(user, email))

  const users = await prisma.user.findMany({
    where: { role: { in: ['BRAND', 'CREATOR'] } },
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { campaigns: true, applications: true } },
    },
  })

  const brands = users.filter(u => u.role === 'BRAND')
  const creators = users.filter(u => u.role === 'CREATOR')

  return (
    <div>
      <nav className="apple-nav">
        <Link href={INTERNAL_ADMIN_PATH} className="brand-lockup">
          <span className="brand-mark" />
          <span className="brand-wordmark">CreatorDocks</span>
        </Link>
        <div className="nav-links">
          <Link href={INTERNAL_ADMIN_PATH} className="nav-link">Waitlist ops</Link>
        </div>
      </nav>

      <main className="apple-shell" style={{ paddingTop: 28, paddingBottom: 60 }}>
        <section className="subtle-grid spacing-xl">
          <header className="page-header">
            <div className="page-header-copy">
              <span className="eyebrow">Admin</span>
              <h1 className="page-title" style={{ marginTop: 18, marginBottom: 12 }}>
                View any brand or creator dashboard, read-only.
              </h1>
              <p className="page-copy" style={{ margin: 0 }}>
                Picking an account opens their dashboard exactly as they see it. No changes can be saved from this view.
              </p>
            </div>
          </header>

          <section className="dashboard-panel">
            <h2 style={{ margin: '0 0 8px' }}>Brands ({brands.length})</h2>
            {brands.length === 0 ? (
              <p className="page-copy" style={{ margin: 0 }}>No brand accounts yet.</p>
            ) : (
              <div className="subtle-grid">
                {brands.map(brand => (
                  <div key={brand.id} className="list-row">
                    <div style={{ minWidth: 0 }}>
                      <p style={{ margin: '0 0 4px', fontWeight: 600 }}>{brand.name ?? brand.email}</p>
                      <p style={{ margin: 0, color: 'var(--text-soft)', fontSize: '.9rem' }}>
                        {brand.email} · {brand._count.campaigns} campaign{brand._count.campaigns === 1 ? '' : 's'}
                      </p>
                    </div>
                    <Link href={`/brand?viewAs=${brand.id}`} className="apple-link">View as →</Link>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="dashboard-panel">
            <h2 style={{ margin: '0 0 8px' }}>Creators ({creators.length})</h2>
            {creators.length === 0 ? (
              <p className="page-copy" style={{ margin: 0 }}>No creator accounts yet.</p>
            ) : (
              <div className="subtle-grid">
                {creators.map(creator => (
                  <div key={creator.id} className="list-row">
                    <div style={{ minWidth: 0 }}>
                      <p style={{ margin: '0 0 4px', fontWeight: 600 }}>{creator.name ?? creator.email}</p>
                      <p style={{ margin: 0, color: 'var(--text-soft)', fontSize: '.9rem' }}>
                        {creator.email} · {creator._count.applications} application{creator._count.applications === 1 ? '' : 's'}
                      </p>
                    </div>
                    <Link href={`/creator?viewAs=${creator.id}`} className="apple-link">View as →</Link>
                  </div>
                ))}
              </div>
            )}
          </section>
        </section>
      </main>
    </div>
  )
}
