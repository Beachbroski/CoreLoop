'use client'

import { useState } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { formatCents } from '@/lib/utils'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

interface ApplicationActionsProps {
  applicationId: string
  proposedRate: number
  creatorName: string
}

function CheckoutForm({
  acceptApplication,
  onSuccess,
  onCancel,
}: {
  acceptApplication: () => Promise<void>
  onSuccess: () => void
  onCancel: () => void
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!stripe || !elements) return
    setLoading(true)
    setError(null)

    const { error: submitError } = await elements.submit()
    if (submitError) { setError(submitError.message ?? 'Payment failed'); setLoading(false); return }

    const { error: confirmError } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: window.location.href },
      redirect: 'if_required',
    })
    if (confirmError) { setError(confirmError.message ?? 'Payment failed'); setLoading(false); return }

    try {
      await acceptApplication()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept application')
      setLoading(false)
      return
    }
    onSuccess()
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 16 }}>
      {error && (
        <div style={{ background: '#fff2f2', border: '1px solid #ff3b30', borderRadius: 10, padding: '12px 16px', fontSize: 15, color: '#ff3b30' }}>
          {error}
        </div>
      )}
      <PaymentElement />
      <div className="chip-row">
        <button
          type="submit"
          disabled={loading}
          className="apple-btn"
          style={{ background: loading ? '#9abf9a' : '#1d9148', padding: '12px 18px', fontSize: 15 }}
        >
          {loading ? 'Processing…' : 'Confirm & Accept'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="apple-btn-ghost"
          style={{ padding: '12px 18px', fontSize: 15 }}
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

export function ApplicationActions({ applicationId, proposedRate, creatorName }: ApplicationActionsProps) {
  const [state, setState] = useState<'idle' | 'loading-intent' | 'payment' | 'rejecting'>('idle')
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmReject, setConfirmReject] = useState(false)

  async function acceptApplication() {
    const res = await fetch(`/api/applications/${applicationId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'ACCEPTED' }),
    })

    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error ?? 'Failed to accept application')
    }
  }

  async function handleAccept() {
    setState('loading-intent')
    setError(null)
    try {
      const res = await fetch('/api/stripe/create-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to initiate payment')
      if (data.paymentAuthorized) {
        await acceptApplication()
        window.location.reload()
        return
      }
      setClientSecret(data.clientSecret)
      setState('payment')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setState('idle')
    }
  }

  async function handleReject() {
    setState('rejecting')
    setError(null)
    try {
      const res = await fetch(`/api/applications/${applicationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'REJECTED' }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Failed to reject')
      }
      window.location.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setState('idle')
    }
  }

  if (state === 'payment' && clientSecret) {
    return (
      <div style={{ borderTop: '1px solid #f5f5f7', marginTop: 16, paddingTop: 4 }}>
        <p style={{ fontSize: 15, color: '#6e6e73', margin: '0 0 4px' }}>
          Authorize payment of{' '}
          <span style={{ fontWeight: 600, color: '#1d1d1f' }}>{formatCents(proposedRate)}</span>
          {' '}to {creatorName}. You&apos;ll only be charged when you approve their content.
        </p>
        <Elements stripe={stripePromise} options={{ clientSecret }}>
          <CheckoutForm
            acceptApplication={acceptApplication}
            onSuccess={() => window.location.reload()}
            onCancel={() => setState('idle')}
          />
        </Elements>
      </div>
    )
  }

  return (
    <div style={{ marginTop: 18, paddingTop: 18, borderTop: '1px solid #f5f5f7' }}>
      {error && <p style={{ fontSize: 13, color: '#ff3b30', margin: '0 0 10px' }}>{error}</p>}
      <div className="chip-row">
      <button
        onClick={handleAccept}
        disabled={state !== 'idle'}
        className="apple-btn"
        style={{ background: state !== 'idle' ? '#9abf9a' : '#1d9148', padding: '10px 20px', fontSize: 15 }}
      >
        {state === 'loading-intent' ? 'Loading…' : 'Accept'}
      </button>
      {confirmReject ? (
        <>
          <span style={{ fontSize: 14, color: '#ff3b30', alignSelf: 'center' }}>Are you sure?</span>
          <button
            onClick={handleReject}
            disabled={state !== 'idle'}
            className="apple-btn-ghost"
            style={{ color: '#ff3b30', borderColor: '#ff3b30', padding: '10px 20px', fontSize: 15 }}
          >
            {state === 'rejecting' ? 'Rejecting…' : 'Confirm reject'}
          </button>
          <button
            onClick={() => setConfirmReject(false)}
            disabled={state !== 'idle'}
            className="apple-btn-ghost"
            style={{ padding: '10px 20px', fontSize: 15 }}
          >
            Cancel
          </button>
        </>
      ) : (
        <button
          onClick={() => setConfirmReject(true)}
          disabled={state !== 'idle'}
          className="apple-btn-ghost"
          style={{ color: '#ff3b30', borderColor: '#ff3b30', padding: '10px 20px', fontSize: 15 }}
        >
          Reject
        </button>
      )}
      </div>
    </div>
  )
}
