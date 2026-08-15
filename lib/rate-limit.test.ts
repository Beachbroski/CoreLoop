import { describe, expect, it } from 'vitest'
import { isDurableRateLimitConfigured, rateLimit } from './rate-limit'

// No Upstash/KV env vars in the test environment, so these exercise the
// in-memory fallback path — the same behavior local dev and CI get.

describe('rateLimit (fallback)', () => {
  it('reports the durable store as unconfigured without credentials', () => {
    expect(isDurableRateLimitConfigured()).toBe(false)
  })

  it('allows requests under the limit', async () => {
    const key = `test:under:${Math.random()}`
    const first = await rateLimit(key, { limit: 3, windowMs: 60_000 })
    const second = await rateLimit(key, { limit: 3, windowMs: 60_000 })

    expect(first.ok).toBe(true)
    expect(second.ok).toBe(true)
    expect(first.retryAfterSeconds).toBeGreaterThan(0)
  })

  it('blocks once the limit is exceeded', async () => {
    const key = `test:over:${Math.random()}`
    const opts = { limit: 2, windowMs: 60_000 }

    expect((await rateLimit(key, opts)).ok).toBe(true)
    expect((await rateLimit(key, opts)).ok).toBe(true)

    const blocked = await rateLimit(key, opts)
    expect(blocked.ok).toBe(false)
    expect(blocked.retryAfterSeconds).toBeGreaterThanOrEqual(1)
  })

  it('resets after the window elapses', async () => {
    const key = `test:reset:${Math.random()}`
    const opts = { limit: 1, windowMs: 20 }

    expect((await rateLimit(key, opts)).ok).toBe(true)
    expect((await rateLimit(key, opts)).ok).toBe(false)

    await new Promise((resolve) => setTimeout(resolve, 30))
    expect((await rateLimit(key, opts)).ok).toBe(true)
  })

  it('isolates counters by key', async () => {
    const opts = { limit: 1, windowMs: 60_000 }
    const a = `test:iso:a:${Math.random()}`
    const b = `test:iso:b:${Math.random()}`

    expect((await rateLimit(a, opts)).ok).toBe(true)
    expect((await rateLimit(a, opts)).ok).toBe(false)
    // A separate key has its own budget.
    expect((await rateLimit(b, opts)).ok).toBe(true)
  })
})
