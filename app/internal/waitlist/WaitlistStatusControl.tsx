'use client'

import { useState } from 'react'

type WaitlistStatus = 'NEW' | 'CONTACTED' | 'APPROVED' | 'INVITED'

const labels: Record<WaitlistStatus, string> = {
  NEW: 'New',
  CONTACTED: 'Contacted',
  APPROVED: 'Approved',
  INVITED: 'Invited',
}

interface WaitlistStatusControlProps {
  submissionId: string
  initialStatus: WaitlistStatus
}

export function WaitlistStatusControl({
  submissionId,
  initialStatus,
}: WaitlistStatusControlProps) {
  const [status, setStatus] = useState<WaitlistStatus>(initialStatus)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  async function saveStatus() {
    setSaving(true)
    setMessage('')

    try {
      const res = await fetch(`/api/waitlist/${submissionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })

      if (!res.ok) {
        const text = await res.text()
        try {
          const parsed = JSON.parse(text) as { error?: string }
          throw new Error(parsed.error ?? 'Unable to update status.')
        } catch {
          throw new Error('Unable to update status.')
        }
      }

      setMessage('Saved')
      window.setTimeout(() => setMessage(''), 1600)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Unable to update status.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="waitlist-status-control">
      <select
        className="apple-select"
        value={status}
        onChange={event => setStatus(event.target.value as WaitlistStatus)}
      >
        {Object.entries(labels).map(([value, label]) => (
          <option key={value} value={value}>{label}</option>
        ))}
      </select>
      <button type="button" className="apple-btn-ghost" onClick={saveStatus} disabled={saving}>
        {saving ? 'Saving...' : 'Save'}
      </button>
      <p className="waitlist-status-message">{message}</p>
    </div>
  )
}
