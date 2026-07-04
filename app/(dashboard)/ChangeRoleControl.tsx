'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export function ChangeRoleControl({ currentRole }: { currentRole: 'BRAND' | 'CREATOR' }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const targetRole = currentRole === 'CREATOR' ? 'BRAND' : 'CREATOR'

  async function switchRole() {
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/users/role', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: targetRole }),
      })
      const data = await res.json() as { error?: string; redirectTo?: string }

      if (!res.ok) {
        setError(data.error ?? 'Unable to change role.')
        setLoading(false)
        return
      }

      router.push(data.redirectTo ?? '/')
    } catch {
      setError('Unable to change role.')
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
      <button type="button" className="apple-btn-ghost" onClick={switchRole} disabled={loading}>
        {loading ? 'Switching...' : `Switch to ${targetRole === 'BRAND' ? 'Brand' : 'Creator'}`}
      </button>
      {error && <p style={{ margin: 0, fontSize: '.85rem', color: 'var(--danger)' }}>{error}</p>}
    </div>
  )
}
