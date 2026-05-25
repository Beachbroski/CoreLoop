'use client'

import { useState } from 'react'

export function ConnectStripeButton() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleConnect() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/stripe/onboard', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to start onboarding')
      window.location.href = data.url
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
      <button
        onClick={handleConnect}
        disabled={loading}
        className="apple-btn"
        style={{ background: loading ? '#b0d0f5' : '#0071e3', padding: '10px 20px', fontSize: 15, whiteSpace: 'nowrap' }}
      >
        {loading ? 'Redirecting…' : 'Connect Stripe'}
      </button>
      {error && <p style={{ fontSize: 13, color: '#ff3b30', margin: 0 }}>{error}</p>}
    </div>
  )
}
