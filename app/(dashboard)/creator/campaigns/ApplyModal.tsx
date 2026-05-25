'use client'

import { useState } from 'react'
import { formatCents } from '@/lib/utils'

interface ApplyModalProps {
  campaignId: string
  campaignTitle: string
  budget: number
}

const inputStyle: React.CSSProperties = {
  background: '#f5f5f7',
  border: '1px solid transparent',
  borderRadius: 10,
  padding: '12px 16px',
  fontSize: 17,
  fontFamily: 'inherit',
  color: '#1d1d1f',
  width: '100%',
  transition: 'all 0.2s',
  outline: 'none',
}

export function ApplyModal({ campaignId, campaignTitle, budget }: ApplyModalProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const form = e.currentTarget
    const data = new FormData(form)
    const rateCents = Math.round(parseFloat(data.get('rate') as string) * 100)

    try {
      const res = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId, pitch: data.get('pitch'), proposedRate: rateCents }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to submit application')
      setOpen(false)
      window.location.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="apple-btn"
        style={{ padding: '8px 18px', fontSize: 15 }}
      >
        Apply
      </button>

      {open && (
        <div className="overlay-panel-shell">
          <div className="overlay-panel-scrim" onClick={() => !loading && setOpen(false)} />

          <div className="overlay-panel">
            <div className="overlay-panel-header">
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ fontSize: 21, fontWeight: 600, color: '#1d1d1f', margin: '0 0 4px' }}>
                    Apply to Campaign
                  </p>
                  <p style={{ fontSize: 15, color: '#6e6e73', margin: 0 }}>{campaignTitle}</p>
                </div>
                <button
                  onClick={() => !loading && setOpen(false)}
                  className="overlay-panel-close"
                >
                  ×
                </button>
              </div>
            </div>

            <form
              onSubmit={handleSubmit}
              className="overlay-panel-form"
            >
              {error && (
                <div
                  style={{
                    background: '#fff2f2',
                    border: '1px solid #ff3b30',
                    borderRadius: 10,
                    padding: '12px 16px',
                    fontSize: 15,
                    color: '#ff3b30',
                  }}
                >
                  {error}
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#1d1d1f', marginBottom: 6 }}>
                  Your Pitch
                </label>
                <textarea
                  name="pitch"
                  required
                  minLength={20}
                  rows={5}
                  placeholder="Why are you the right creator for this campaign? What's your approach?"
                  style={{ ...inputStyle, resize: 'none' }}
                  onFocus={e => {
                    e.target.style.background = 'white'
                    e.target.style.borderColor = '#0071e3'
                    e.target.style.boxShadow = '0 0 0 3px rgba(0,113,227,0.15)'
                  }}
                  onBlur={e => {
                    e.target.style.background = '#f5f5f7'
                    e.target.style.borderColor = 'transparent'
                    e.target.style.boxShadow = 'none'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#1d1d1f', marginBottom: 6 }}>
                  Your Rate (USD)
                </label>
                <input
                  name="rate"
                  type="number"
                  required
                  min={1}
                  step={0.01}
                  placeholder={String(budget / 100)}
                  style={inputStyle}
                  onFocus={e => {
                    e.target.style.background = 'white'
                    e.target.style.borderColor = '#0071e3'
                    e.target.style.boxShadow = '0 0 0 3px rgba(0,113,227,0.15)'
                  }}
                  onBlur={e => {
                    e.target.style.background = '#f5f5f7'
                    e.target.style.borderColor = 'transparent'
                    e.target.style.boxShadow = 'none'
                  }}
                />
                <p style={{ fontSize: 13, color: '#6e6e73', marginTop: 6 }}>
                  Campaign budget: {formatCents(budget)}
                </p>
              </div>

              <div className="overlay-panel-actions">
                <button
                  type="submit"
                  disabled={loading}
                  className="apple-btn"
                  style={{ background: loading ? '#b0d0f5' : '#0071e3', width: '100%' }}
                >
                  {loading ? 'Submitting…' : 'Submit Application'}
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={loading}
                  className="apple-btn-ghost"
                  style={{ color: '#0071e3', borderColor: '#0071e3', width: '100%' }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
