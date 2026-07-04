'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function SubmissionReview({ submissionId }: { submissionId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmReject, setConfirmReject] = useState(false)
  const [noteMode, setNoteMode] = useState<'REVISION_REQUESTED' | 'REJECTED' | null>(null)
  const [note, setNote] = useState('')

  async function updateStatus(status: 'APPROVED' | 'REVISION_REQUESTED' | 'REJECTED', reviewNote?: string) {
    setLoading(status)
    setError(null)
    try {
      const res = await fetch(`/api/submissions/${submissionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, ...(reviewNote ? { reviewNote } : {}) }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to update submission')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setLoading(null)
    }
  }

  if (noteMode) {
    const isReject = noteMode === 'REJECTED'
    return (
      <div className="subtle-grid" style={{ gap: 10, marginTop: 16 }}>
        {error && <p style={{ margin: 0, color: 'var(--danger)', fontSize: '.85rem' }}>{error}</p>}
        <label>
          <span className="field-label">
            {isReject ? 'Tell the creator why this was rejected' : 'Tell the creator what to revise'}
          </span>
          <textarea
            className="apple-input"
            rows={3}
            value={note}
            onChange={event => setNote(event.target.value)}
            placeholder={isReject ? 'e.g. Content doesn\'t match the agreed deliverables' : 'e.g. Please re-shoot with better lighting and add the required hashtag'}
          />
        </label>
        <div className="chip-row">
          <button
            type="button"
            onClick={() => updateStatus(noteMode, note.trim() || undefined)}
            disabled={loading !== null || note.trim().length === 0}
            className="apple-btn-ghost"
            style={{ padding: '12px 16px', fontSize: '.95rem', color: isReject ? 'var(--danger)' : undefined, borderColor: isReject ? 'rgba(225, 29, 72, 0.28)' : undefined }}
          >
            {loading === noteMode ? 'Sending…' : `Send ${isReject ? 'rejection' : 'revision request'}`}
          </button>
          <button
            type="button"
            onClick={() => { setNoteMode(null); setNote('') }}
            disabled={loading !== null}
            className="apple-btn-ghost"
            style={{ padding: '12px 16px', fontSize: '.95rem' }}
          >
            Cancel
          </button>
        </div>
      </div>
    )
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
          onClick={() => setNoteMode('REVISION_REQUESTED')}
          disabled={loading !== null}
          className="apple-btn-ghost"
          style={{ padding: '12px 16px', fontSize: '.95rem' }}
        >
          Request Revision
        </button>
        {confirmReject ? (
          <>
            <span style={{ fontSize: 14, color: 'var(--danger)', alignSelf: 'center' }}>Are you sure?</span>
            <button
              type="button"
              onClick={() => { setConfirmReject(false); setNoteMode('REJECTED') }}
              disabled={loading !== null}
              className="apple-btn-ghost"
              style={{ padding: '12px 16px', fontSize: '.95rem', color: 'var(--danger)', borderColor: 'rgba(225, 29, 72, 0.28)' }}
            >
              Confirm reject
            </button>
            <button
              type="button"
              onClick={() => setConfirmReject(false)}
              disabled={loading !== null}
              className="apple-btn-ghost"
              style={{ padding: '12px 16px', fontSize: '.95rem' }}
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmReject(true)}
            disabled={loading !== null}
            className="apple-btn-ghost"
            style={{ padding: '12px 16px', fontSize: '.95rem', color: 'var(--danger)', borderColor: 'rgba(225, 29, 72, 0.28)' }}
          >
            Reject
          </button>
        )}
      </div>
    </div>
  )
}
