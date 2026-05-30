type TurnstileSiteverifyResponse = {
  success: boolean
  challenge_ts?: string
  hostname?: string
  'error-codes'?: string[]
  action?: string
  cdata?: string
}

const TURNSTILE_SITEVERIFY_TIMEOUT_MS = 8_000

export function isTurnstileConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && process.env.TURNSTILE_SECRET_KEY)
}

// VERCEL_ENV is 'production' only on the real prod deployment.
// Preview ('preview') and local (undefined) never enforce Turnstile,
// since the widget's hostnames are scoped to the production domain.
function isProductionDeployment() {
  return process.env.VERCEL_ENV === 'production'
}

export function shouldBypassTurnstile() {
  return !isProductionDeployment() && !isTurnstileConfigured()
}

export function isTurnstileFailClosed() {
  return isProductionDeployment() && !isTurnstileConfigured()
}

export async function verifyTurnstileToken(token: string, remoteIp?: string) {
  const secret = process.env.TURNSTILE_SECRET_KEY

  if (!secret) {
    return false
  }

  const body = new FormData()
  body.append('secret', secret)
  body.append('response', token)
  if (remoteIp && remoteIp !== 'unknown') body.append('remoteip', remoteIp)

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TURNSTILE_SITEVERIFY_TIMEOUT_MS)

  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body,
      signal: controller.signal,
    })

    if (!res.ok) return false

    const data = await res.json() as TurnstileSiteverifyResponse
    return data.success
  } catch (err) {
    console.warn('[turnstile] siteverify failed closed', err)
    return false
  } finally {
    clearTimeout(timeout)
  }
}
