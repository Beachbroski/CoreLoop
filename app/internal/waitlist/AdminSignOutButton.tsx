'use client'

import { useClerk } from '@clerk/nextjs'

export function AdminSignOutButton() {
  const { signOut } = useClerk()

  return (
    <button
      type="button"
      className="apple-btn-ghost"
      onClick={() => signOut({ redirectUrl: '/waitlist' })}
    >
      Sign out
    </button>
  )
}
