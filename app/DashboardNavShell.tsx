'use client'

import Link from 'next/link'
import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { UserButton } from '@clerk/nextjs'

interface NavItem {
  label: string
  href: string
}

interface DashboardNavShellProps {
  homeHref: string
  homeLabel: string
  userName: string
  userLabel: string
  navItems: NavItem[]
}

export function DashboardNavShell({
  homeHref,
  homeLabel,
  userName,
  userLabel,
  navItems,
}: DashboardNavShellProps) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  function linkClass(href: string) {
    const isActive = href === homeHref ? pathname === href : pathname.startsWith(href)
    return `sidebar-link ${isActive ? 'sidebar-link-active' : ''}`
  }

  return (
    <>
      <div className="mobile-dashboard-bar">
        <Link href={homeHref} className="brand-lockup">
          <span className="brand-mark" />
          <span className="brand-wordmark">CoreLoop</span>
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <p className="mobile-workspace-label">{homeLabel}</p>
          <button
            type="button"
            className="mobile-menu-button"
            onClick={() => setOpen(true)}
            aria-label="Open navigation menu"
          >
            Menu
          </button>
        </div>
      </div>

      {open && (
        <div className="mobile-drawer-shell">
          <button
            type="button"
            className="mobile-drawer-scrim"
            onClick={() => setOpen(false)}
            aria-label="Close navigation menu"
          />
          <div className="mobile-drawer">
            <div className="mobile-drawer-header">
              <div>
                <p className="sidebar-label" style={{ margin: '0 0 6px' }}>{homeLabel}</p>
                <div className="brand-lockup">
                  <span className="brand-mark" />
                  <span className="brand-wordmark">CoreLoop</span>
                </div>
              </div>
              <button
                type="button"
                className="mobile-menu-button"
                onClick={() => setOpen(false)}
                aria-label="Close navigation menu"
              >
                Close
              </button>
            </div>

            <nav className="sidebar-block">
              {navItems.map(item => (
                <Link key={item.href} href={item.href} className={linkClass(item.href)} onClick={() => setOpen(false)}>
                  {item.label}
                </Link>
              ))}
            </nav>

            <div className="sidebar-footer" style={{ marginTop: 8 }}>
              <UserButton appearance={{ elements: { avatarBox: 'w-10 h-10' } }} />
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: '0 0 3px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {userName}
                </p>
                <p style={{ margin: 0, color: 'var(--text-soft)', fontSize: '.88rem' }}>
                  {userLabel}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <aside className="sidebar-shell desktop-sidebar">
        <div className="sidebar-block">
          <Link href={homeHref} className="brand-lockup">
            <span className="brand-mark" />
            <span className="brand-wordmark">CoreLoop</span>
          </Link>
          <p className="sidebar-label">{homeLabel}</p>
        </div>

        <div className="dashboard-panel" style={{ gap: 10 }}>
          <p className="sidebar-label" style={{ margin: 0 }}>Navigation</p>
          <nav className="sidebar-block">
            {navItems.map(item => (
              <Link key={item.href} href={item.href} className={linkClass(item.href)}>
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="dashboard-panel" style={{ gap: 12 }}>
          <p className="sidebar-label" style={{ margin: 0 }}>System feel</p>
          <div className="subtle-grid">
            <div>
              <p style={{ margin: '0 0 4px', fontWeight: 600 }}>Faster briefs</p>
              <p style={{ margin: 0, color: 'var(--text-soft)', fontSize: '.92rem' }}>
                Keep campaigns and approvals moving.
              </p>
            </div>
            <div>
              <p style={{ margin: '0 0 4px', fontWeight: 600 }}>Cleaner payouts</p>
              <p style={{ margin: 0, color: 'var(--text-soft)', fontSize: '.92rem' }}>
                Get Stripe-connected and avoid payout friction.
              </p>
            </div>
          </div>
        </div>

        <div className="sidebar-footer">
          <UserButton appearance={{ elements: { avatarBox: 'w-10 h-10' } }} />
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: '0 0 3px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {userName}
            </p>
            <p style={{ margin: 0, color: 'var(--text-soft)', fontSize: '.88rem' }}>
              {userLabel}
            </p>
          </div>
        </div>
      </aside>
    </>
  )
}
