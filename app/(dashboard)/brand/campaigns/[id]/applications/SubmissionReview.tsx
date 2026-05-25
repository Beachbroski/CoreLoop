'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function SubmissionReview({ submissionId }: { submissionId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function updateStatus(status: 'APPROVED' | 'REVISION_REQUESTED' | 'REJECTED') {
    setLoading(status)
    setError(null)
    try {
      const res = await fetch(`/api/submissions/${submissionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to update submission')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setLoading(null)
    }
  }

  return (
    <div className="subtle-grid" style={{ gap: 10, marginTop: 16 }}>
      {error && (
        <p style={{ margin: 0, color: 'var(--danger)', fontSize: '.85rem' }}>{error}</p>
      )}
      <div className="chip-row">
        <button
          type="button"
          onClick={() => updateStatus('APPROVED')}
          disabled={loading !== null}
          className="apple-btn"
          style={{ padding: '12px 16px', fontSize: '.95rem' }}
        >
          {loading === 'APPROVED' ? 'Approving…' : 'Approve & Pay'}
        </button>
        <button
          type="button"
          onClick={() => updateStatus('REVISION_REQUESTED')}
          disabled={loading !== null}
          className="apple-btn-ghost"
          style={{ padding: '12px 16px', fontSize: '.95rem' }}
        >
          {loading === 'REVISION_REQUESTED' ? 'Requesting…' : 'Request Revision'}
        </button>
        <button
          type="button"
          onClick={() => updateStatus('REJECTED')}
          disabled={loading !== null}
          className="apple-btn-ghost"
          style={{
            padding: '12px 16px',
            fontSize: '.95rem',
            color: 'var(--danger)',
            borderColor: 'rgba(225, 29, 72, 0.28)',
          }}
        >
          {loading === 'REJECTED' ? 'Rejecting…' : 'Reject'}
        </button>
      </div>
    </div>
  )
}
