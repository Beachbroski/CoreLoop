'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { track } from '@vercel/analytics'

const platformOptions = ['TikTok', 'Instagram', 'YouTube', 'X', 'Twitch', 'Other']
const nicheOptions = ['Lifestyle', 'Beauty', 'Fashion', 'Fitness', 'Food', 'Home services', 'Local reviews', 'Comedy', 'Other']
const followerRanges = ['Under 1k', '1k-5k', '5k-10k', '10k-25k', '25k-50k', '50k-100k', '100k+']
const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? ''

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string
          theme?: 'light' | 'dark' | 'auto'
          callback?: (token: string) => void
          'expired-callback'?: () => void
          'error-callback'?: () => void
        },
      ) => string
      reset: (widgetId?: string) => void
      remove: (widgetId: string) => void
    }
  }
}

type WaitlistResponse = {
  success: boolean
  existing: boolean
  profileComplete: boolean
  data: {
    id: string
    name: string | null
    email: string
    primaryPlatform: string | null
    handle: string | null
    niche: string | null
    followerRange: string | null
    profileCompletedAt: string | null
    referralCode: string
    referralLink: string
    status: 'NEW' | 'CONTACTED' | 'APPROVED' | 'INVITED'
    referralCount: number
    referredBy: { id: string; name: string | null; referralCode: string } | null
  }
}

interface WaitlistFormProps {
  compact?: boolean
}

export function WaitlistForm({ compact = false }: WaitlistFormProps) {
  const searchParams = useSearchParams()
  const turnstileContainerRef = useRef<HTMLDivElement | null>(null)
  const turnstileWidgetIdRef = useRef<string | null>(null)
  const [step, setStep] = useState<'email' | 'profile'>('email')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [turnstileToken, setTurnstileToken] = useState('')
  const [leadState, setLeadState] = useState<WaitlistResponse['data'] | null>(null)
  const [successState, setSuccessState] = useState<WaitlistResponse['data'] | null>(null)
  const [existingSubmission, setExistingSubmission] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    primaryPlatform: 'TikTok',
    handle: '',
    niche: 'Lifestyle',
    followerRange: '1k-5k',
    referralCode: '',
  })

  const referralFromUrl = useMemo(() => {
    const value = searchParams.get('ref')
    return value ? value.trim().toUpperCase() : ''
  }, [searchParams])

  const effectiveReferralCode = formData.referralCode || referralFromUrl
  const turnstileEnabled = Boolean(turnstileSiteKey)
  const currentEmail = leadState?.email || formData.email

  function resetTurnstile() {
    if (turnstileWidgetIdRef.current && window.turnstile) {
      window.turnstile.reset(turnstileWidgetIdRef.current)
    }
    setTurnstileToken('')
  }

  useEffect(() => {
    if (!turnstileEnabled || successState) return

    function renderTurnstile() {
      if (!window.turnstile || !turnstileContainerRef.current || turnstileWidgetIdRef.current) return

      turnstileWidgetIdRef.current = window.turnstile.render(turnstileContainerRef.current, {
        sitekey: turnstileSiteKey,
        theme: 'light',
        callback: token => {
          setTurnstileToken(token)
          setError('')
        },
        'expired-callback': () => setTurnstileToken(''),
        'error-callback': () => {
          setTurnstileToken('')
          setError('Verification could not load. Refresh the page and try again.')
        },
      })
    }

    if (window.turnstile) {
      renderTurnstile()
    } else {
      const scriptId = 'cloudflare-turnstile-script'
      let script = document.getElementById(scriptId) as HTMLScriptElement | null

      if (!script) {
        script = document.createElement('script')
        script.id = scriptId
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
        script.async = true
        script.defer = true
        document.head.appendChild(script)
      }

      script.addEventListener('load', renderTurnstile)
      return () => {
        script?.removeEventListener('load', renderTurnstile)
        if (turnstileWidgetIdRef.current && window.turnstile) {
          window.turnstile.remove(turnstileWidgetIdRef.current)
          turnstileWidgetIdRef.current = null
        }
      }
    }

    return () => {
      if (turnstileWidgetIdRef.current && window.turnstile) {
        window.turnstile.remove(turnstileWidgetIdRef.current)
        turnstileWidgetIdRef.current = null
      }
    }
  }, [successState, turnstileEnabled])

  async function submitWaitlist(payload: Record<string, string>) {
    const res = await fetch('/api/waitlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, turnstileToken }),
    })

    const text = await res.text()
    if (!res.ok) {
      let message = 'Unable to join the waitlist.'
      try {
        const parsed = JSON.parse(text) as { error?: string }
        message = parsed.error || message
      } catch {
        // Keep the generic fallback when the server returns non-JSON.
      }
      throw new Error(message)
    }

    return JSON.parse(text) as WaitlistResponse
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)
    setError('')
    setCopied(false)

    try {
      if (turnstileEnabled && !turnstileToken) {
        throw new Error('Complete the verification before joining the waitlist.')
      }

      if (step === 'email') {
        const parsed = await submitWaitlist({
          step: 'email',
          email: formData.email,
          referralCode: effectiveReferralCode,
        })

        resetTurnstile()
        setLeadState(parsed.data)
        setExistingSubmission(parsed.existing)
        setFormData(current => ({ ...current, email: parsed.data.email }))

        if (!parsed.existing) {
          track('waitlist_submitted', {
            has_referral: Boolean(parsed.data.referredBy),
          })
        }

        if (parsed.profileComplete) {
          setSuccessState(parsed.data)
        } else {
          setStep('profile')
        }

        return
      }

      const parsed = await submitWaitlist({
        step: 'profile',
        email: currentEmail,
        name: formData.name,
        primaryPlatform: formData.primaryPlatform,
        handle: formData.handle,
        niche: formData.niche,
        followerRange: formData.followerRange,
      })

      resetTurnstile()
      track('waitlist_profile_completed', {
        primary_platform: formData.primaryPlatform,
        niche: formData.niche,
        follower_range: formData.followerRange,
      })
      setSuccessState(parsed.data)
      setExistingSubmission(parsed.existing)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to join the waitlist.')
      resetTurnstile()
    } finally {
      setIsSubmitting(false)
    }
  }

  async function copyReferralLink() {
    if (!successState?.referralLink) return

    try {
      await navigator.clipboard.writeText(successState.referralLink)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
    }
  }

  if (successState) {
    return (
      <div className="dashboard-panel waitlist-success-panel">
        <div className="subtle-grid" style={{ gap: 10 }}>
          <span className="eyebrow">{existingSubmission ? 'Already joined' : 'You are in'}</span>
          <h2 style={{ margin: 0, fontSize: 'clamp(2rem, 5vw, 3rem)', letterSpacing: '-0.06em', lineHeight: 0.98 }}>
            {existingSubmission ? 'Your CreatorDocks spot is ready.' : 'Your CreatorDocks spot is saved.'}
          </h2>
          <p className="page-copy" style={{ margin: 0 }}>
            We’ll use your creator details to match you with local brand deals that fit. Share your link while the first cohort opens in rolling waves.
          </p>
        </div>

        <div className="waitlist-success-grid">
          <div className="dashboard-panel">
            <p className="sidebar-label" style={{ margin: 0 }}>Your referral code</p>
            <p className="waitlist-referral-code">{successState.referralCode}</p>
            <p className="page-copy" style={{ margin: 0 }}>
              Refer 3 creators and complete 3 campaigns after launch to unlock the $25 reward.
            </p>
          </div>

          <div className="dashboard-panel">
            <p className="sidebar-label" style={{ margin: 0 }}>Your referral link</p>
            <p className="page-copy waitlist-link-preview">{successState.referralLink}</p>
            <div className="cta-row">
              <button type="button" className="apple-btn" onClick={copyReferralLink}>
                {copied ? 'Copied' : 'Copy link'}
              </button>
              <a href={successState.referralLink} className="apple-btn-ghost">
                Open link
              </a>
            </div>
          </div>
        </div>

        <div className="banner-success">
          <p style={{ margin: 0, color: 'var(--success)', fontSize: '.96rem' }}>
            {successState.referredBy
              ? `Joined through ${successState.referredBy.name ?? 'another creator'}'s referral code.`
              : 'No referral attached yet. You can still start referring from here.'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <form className={`dashboard-panel ${compact ? 'waitlist-form-compact' : 'waitlist-form-panel'}`} onSubmit={handleSubmit}>
      <div className="subtle-grid" style={{ gap: 10 }}>
        <span className="eyebrow">Step {step === 'email' ? '1' : '2'} of 2</span>
        <h2 style={{ margin: 0, fontSize: compact ? 'clamp(1.8rem, 5vw, 2.6rem)' : 'clamp(2rem, 5vw, 3rem)', letterSpacing: '-0.06em', lineHeight: 0.98 }}>
          {step === 'email' ? 'Save your creator spot.' : 'Help us match you better.'}
        </h2>
        <p className="page-copy" style={{ margin: 0 }}>
          {step === 'email'
            ? 'Drop your email first. Your lead is saved even if you finish the creator details later.'
            : 'Tell us where you create and what local brands should know before we curate the first match list.'}
        </p>
      </div>

      {error ? (
        <div className="banner-danger">
          <p style={{ margin: 0, color: 'var(--danger)', fontSize: '.96rem' }}>{error}</p>
        </div>
      ) : null}

      {step === 'email' ? (
        <div className="waitlist-field-grid waitlist-email-grid">
          <label>
            <span className="field-label">Email *</span>
            <input
              className="apple-input"
              type="email"
              autoComplete="email"
              value={formData.email}
              onChange={event => setFormData(current => ({ ...current, email: event.target.value }))}
              placeholder="you@example.com"
              required
            />
          </label>

          <label>
            <span className="field-label">Referral code (optional)</span>
            <input
              className="apple-input"
              value={effectiveReferralCode}
              onChange={event => setFormData(current => ({ ...current, referralCode: event.target.value.toUpperCase() }))}
              placeholder="Drop a creator’s code"
            />
          </label>
        </div>
      ) : (
        <div className="waitlist-field-grid">
          <label>
            <span className="field-label">Name (optional)</span>
            <input
              className="apple-input"
              type="text"
              autoComplete="name"
              value={formData.name}
              onChange={event => setFormData(current => ({ ...current, name: event.target.value }))}
              placeholder="Jackson Steele"
            />
          </label>

          <label>
            <span className="field-label">Creator handle *</span>
            <input
              className="apple-input"
              type="text"
              inputMode="text"
              autoCapitalize="none"
              autoCorrect="off"
              value={formData.handle}
              onChange={event => setFormData(current => ({ ...current, handle: event.target.value }))}
              placeholder="@yourhandle"
              required
            />
          </label>

          <label>
            <span className="field-label">Primary platform</span>
            <select
              className="apple-select"
              value={formData.primaryPlatform}
              onChange={event => setFormData(current => ({ ...current, primaryPlatform: event.target.value }))}
            >
              {platformOptions.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>

          <label>
            <span className="field-label">Niche</span>
            <select
              className="apple-select"
              value={formData.niche}
              onChange={event => setFormData(current => ({ ...current, niche: event.target.value }))}
            >
              {nicheOptions.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>

          <label>
            <span className="field-label">Follower range</span>
            <select
              className="apple-select"
              value={formData.followerRange}
              onChange={event => setFormData(current => ({ ...current, followerRange: event.target.value }))}
            >
              {followerRanges.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>

          <div className="waitlist-email-card">
            <span className="field-label">Saved email</span>
            <p className="page-copy" style={{ margin: 0 }}>{currentEmail}</p>
          </div>
        </div>
      )}

      <div className="banner-info">
        <p style={{ margin: 0, color: 'var(--info)', fontSize: '.96rem' }}>
          CreatorDocks is free for creators. Brands pay the platform fee when paid local deals go through the platform.
        </p>
      </div>

      {turnstileEnabled ? (
        <div className="turnstile-panel" aria-label="CreatorDocks waitlist verification">
          <div ref={turnstileContainerRef} />
          <p className="turnstile-copy">Protected by Cloudflare Turnstile so real creators get through first.</p>
        </div>
      ) : null}

      <div className="waitlist-submit-row">
        <button
          type="submit"
          className="apple-btn waitlist-submit-button"
          disabled={isSubmitting || (turnstileEnabled && !turnstileToken)}
        >
          {isSubmitting
            ? 'Saving...'
            : step === 'email'
              ? 'Save my spot'
              : 'Finish creator profile'}
        </button>
      </div>
    </form>
  )
}
