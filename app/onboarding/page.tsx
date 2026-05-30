'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

type AccountStateResponse = {
  authenticated: boolean
  hasProfile: boolean
  role: 'BRAND' | 'CREATOR' | null
  onboardingRequired: boolean
  redirectTo: string
}

export default function OnboardingPage() {
  const router = useRouter()
  const [status, setStatus] = useState<'checking' | 'idle' | 'loading' | 'error'>('checking')
  const [selectedRole, setSelectedRole] = useState<'BRAND' | 'CREATOR' | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    const controller = new AbortController()

    async function loadAccountState() {
      try {
        const res = await fetch('/api/users/me', {
          cache: 'no-store',
          signal: controller.signal,
        })

        const data = await res.json() as AccountStateResponse | null
        if (controller.signal.aborted) return

        if (res.status === 401) {
          router.replace('/sign-in')
          return
        }

        if (!res.ok || !data) {
          throw new Error('Unable to confirm account state.')
        }

        if (!data.authenticated) {
          router.replace('/sign-in')
          return
        }

        if (!data.onboardingRequired && data.redirectTo) {
          router.replace(data.redirectTo)
          return
        }

        setStatus('idle')
      } catch (err) {
        if (controller.signal.aborted) return
        setErrorMsg(err instanceof Error ? err.message : 'Unable to confirm account state.')
        setStatus('error')
      }
    }

    void loadAccountState()

    return () => controller.abort()
  }, [router])

  async function selectRole(role: 'BRAND' | 'CREATOR') {
    setStatus('loading')
    setSelectedRole(role)
    setErrorMsg('')

    try {
      const res = await fetch('/api/users/role', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      })
      const text = await res.text()
      if (res.ok) {
        let redirectTo = role === 'BRAND' ? '/brand' : '/creator'
        try {
          const data = JSON.parse(text) as { redirectTo?: string }
          redirectTo = data.redirectTo ?? redirectTo
        } catch {}
        router.replace(redirectTo)
      } else {
        let msg = `HTTP ${res.status}`
        try { msg = JSON.parse(text).error ?? msg } catch {}
        setErrorMsg(msg)
        setStatus('error')
      }
    } catch (err) {
      setErrorMsg(String(err))
      setStatus('error')
    }
  }

  if (status === 'checking') {
    return (
      <main className="onboarding-shell">
        <div
          style={{
            width: 24,
            height: 24,
            border: '2px solid rgba(15, 23, 42, 0.12)',
            borderTopColor: 'var(--accent)',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }}
        />
      </main>
    )
  }

  const isBusy = status === 'loading'

  return (
    <main className="onboarding-shell">
      <div className="auth-card" style={{ maxWidth: 1080 }}>
        <section className="auth-hero" style={{ display: 'grid', gap: 20 }}>
          <div className="brand-lockup">
            <span className="brand-mark" />
            <span className="brand-wordmark">CreatorDocks</span>
          </div>
          <div>
            <span className="eyebrow" style={{ color: 'white', background: 'rgba(255,255,255,0.12)', borderColor: 'rgba(255,255,255,0.16)' }}>
              One setup, two paths
            </span>
            <h1 style={{ fontSize: 'clamp(2.6rem, 5vw, 4.4rem)', lineHeight: 0.95, letterSpacing: '-0.06em', margin: '20px 0 12px' }}>
              Pick how you’ll use CreatorDocks internally.
            </h1>
            <p style={{ margin: 0, color: 'rgba(255,255,255,0.76)', fontSize: '1.05rem', lineHeight: 1.7 }}>
              Brands get the brief and approval workflow. Creators get campaign discovery, submissions, and payout setup.
            </p>
          </div>
          <div className="subtle-grid">
            {[
              'Launch campaigns without spreadsheets',
              'Review better creator fits faster',
              'Apply, submit, and get paid in one flow',
            ].map(item => (
              <div key={item} className="pill" style={{ width: 'fit-content', background: 'rgba(255,255,255,0.12)', borderColor: 'rgba(255,255,255,0.12)', color: 'white' }}>
                {item}
              </div>
            ))}
          </div>
        </section>

        <section className="auth-panel">
          <div style={{ maxWidth: 560, width: '100%' }}>
            <p style={{ margin: '0 0 10px', color: 'var(--text-faint)', fontSize: '.82rem', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' }}>
              Account setup
            </p>
            <h2 className="page-title" style={{ marginBottom: 10 }}>How will you use CreatorDocks?</h2>
            <p className="page-copy" style={{ margin: '0 0 32px' }}>
              Choose the role that matches how you’ll use the platform today. You can only pick one.
            </p>

            {errorMsg && (
              <div className="banner-danger" style={{ marginBottom: 20 }}>
                <p style={{ margin: 0, color: 'var(--danger)', fontSize: '.95rem' }}>{errorMsg}</p>
              </div>
            )}

            <div className="role-grid">
          {[
            {
              role: 'BRAND' as const,
              icon: 'Brand',
              title: 'Brand',
              description: 'Post campaigns, shortlist creators, and manage payouts in one calm workspace.',
            },
            {
              role: 'CREATOR' as const,
              icon: 'Creator',
              title: 'Creator',
              description: 'Apply to better briefs, submit content, and get paid without chasing invoices.',
            },
          ].map(({ role, icon, title, description }) => (
            <button
              key={role}
              onClick={() => selectRole(role)}
              disabled={isBusy}
              className="role-card"
              style={{
                cursor: isBusy ? 'not-allowed' : 'pointer',
                opacity: isBusy && selectedRole !== role ? 0.5 : 1,
              }}
            >
              <div>
                <span className="eyebrow" style={{ marginBottom: 14 }}>{icon}</span>
                <p style={{ fontSize: 22, fontWeight: 600, color: 'var(--text)', margin: '0 0 8px', letterSpacing: '-0.04em' }}>{title}</p>
                <p style={{ fontSize: 15, color: 'var(--text-soft)', margin: 0, lineHeight: 1.6 }}>{description}</p>
              </div>
              {isBusy && selectedRole === role && (
                <div
                  style={{
                    width: 20,
                    height: 20,
                    border: '2px solid rgba(15, 23, 42, 0.12)',
                    borderTopColor: 'var(--accent)',
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite',
                  }}
                />
              )}
            </button>
          ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
