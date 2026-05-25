'use client'

import { useState } from 'react'
import { UploadButton } from '@/lib/uploadthing'

interface SubmitContentModalProps {
  applicationId: string
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
  resize: 'none',
}

export function SubmitContentModal({ applicationId }: SubmitContentModalProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!uploadedUrl) { setError('Please upload your content first'); return }
    setLoading(true)
    setError(null)

    const form = e.currentTarget
    const data = new FormData(form)

    try {
      const res = await fetch('/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicationId,
          contentUrl: uploadedUrl,
          caption: (data.get('caption') as string) || undefined,
          notes: (data.get('notes') as string) || undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to submit content')
      setOpen(false)
      setUploadedUrl(null)
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
        Submit Content
      </button>

      {open && (
        <div className="overlay-panel-shell">
          <div className="overlay-panel-scrim" onClick={() => !loading && setOpen(false)} />
          <div className="overlay-panel">
            <div className="overlay-panel-header" style={{ alignItems: 'center' }}>
              <p style={{ fontSize: 21, fontWeight: 600, color: '#1d1d1f', margin: 0 }}>Submit Content</p>
              <button
                onClick={() => !loading && setOpen(false)}
                className="overlay-panel-close"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="overlay-panel-form">
              {error && (
                <div style={{ background: '#fff2f2', border: '1px solid #ff3b30', borderRadius: 10, padding: '12px 16px', fontSize: 15, color: '#ff3b30' }}>
                  {error}
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#1d1d1f', marginBottom: 8 }}>
                  Upload Content
                </label>
                {uploadedUrl ? (
                  <div
                    style={{
                      background: '#e8f9ef',
                      border: '1px solid #1d9148',
                      borderRadius: 10,
                      padding: '12px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span style={{ fontSize: 15, color: '#1d9148' }}>✓ File uploaded</span>
                    <button
                      type="button"
                      onClick={() => setUploadedUrl(null)}
                      style={{ background: 'none', border: 'none', fontSize: 13, color: '#6e6e73', cursor: 'pointer' }}
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <UploadButton
                    endpoint="contentUploader"
                    onClientUploadComplete={res => { if (res[0]) setUploadedUrl(res[0].ufsUrl) }}
                    onUploadError={err => setError(err.message)}
                    appearance={{
                      button: 'bg-[#f5f5f7] border border-[#d2d2d7] text-[#1d1d1f] hover:bg-[#ebebeb] rounded-full text-base font-normal',
                      container: 'w-full',
                    }}
                  />
                )}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#1d1d1f', marginBottom: 6 }}>
                  Caption <span style={{ color: '#6e6e73', fontWeight: 400 }}>(optional)</span>
                </label>
                <textarea
                  name="caption"
                  rows={3}
                  placeholder="Add a caption for the content..."
                  style={inputStyle}
                  onFocus={e => { e.target.style.background = 'white'; e.target.style.borderColor = '#0071e3'; e.target.style.boxShadow = '0 0 0 3px rgba(0,113,227,0.15)' }}
                  onBlur={e => { e.target.style.background = '#f5f5f7'; e.target.style.borderColor = 'transparent'; e.target.style.boxShadow = 'none' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#1d1d1f', marginBottom: 6 }}>
                  Notes <span style={{ color: '#6e6e73', fontWeight: 400 }}>(optional)</span>
                </label>
                <textarea
                  name="notes"
                  rows={2}
                  placeholder="Any notes for the brand..."
                  style={inputStyle}
                  onFocus={e => { e.target.style.background = 'white'; e.target.style.borderColor = '#0071e3'; e.target.style.boxShadow = '0 0 0 3px rgba(0,113,227,0.15)' }}
                  onBlur={e => { e.target.style.background = '#f5f5f7'; e.target.style.borderColor = 'transparent'; e.target.style.boxShadow = 'none' }}
                />
              </div>

              <div className="overlay-panel-actions">
                <button
                  type="submit"
                  disabled={loading || !uploadedUrl}
                  className="apple-btn"
                  style={{ background: loading || !uploadedUrl ? '#b0d0f5' : '#0071e3', width: '100%' }}
                >
                  {loading ? 'Submitting…' : 'Submit'}
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
