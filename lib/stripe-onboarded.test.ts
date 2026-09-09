import { describe, expect, it } from 'vitest'

import { isStripeAccountOnboarded } from './stripe-onboarded'

const ready = {
  details_submitted: true,
  payouts_enabled: true,
  capabilities: { transfers: 'active' },
}

describe('isStripeAccountOnboarded', () => {
  it('accepts an account Stripe will actually pay out on', () => {
    expect(isStripeAccountOnboarded(ready)).toBe(true)
  })

  it('rejects an unfinished Connect form', () => {
    expect(isStripeAccountOnboarded({ ...ready, details_submitted: false })).toBe(false)
  })

  it('rejects an account whose payouts are still held', () => {
    // The case `details_submitted` alone would get wrong: the creator finished
    // the form, but Stripe is still reviewing a document.
    expect(isStripeAccountOnboarded({ ...ready, payouts_enabled: false })).toBe(false)
  })

  it('rejects a transfers capability that is not yet active', () => {
    expect(isStripeAccountOnboarded({ ...ready, capabilities: { transfers: 'pending' } })).toBe(false)
    expect(isStripeAccountOnboarded({ ...ready, capabilities: { transfers: 'inactive' } })).toBe(false)
  })

  it('rejects an account with no capabilities block at all', () => {
    expect(isStripeAccountOnboarded({ ...ready, capabilities: null })).toBe(false)
    expect(isStripeAccountOnboarded({ details_submitted: true, payouts_enabled: true })).toBe(false)
  })

  it('treats missing and null flags as not onboarded', () => {
    expect(isStripeAccountOnboarded({})).toBe(false)
    expect(
      isStripeAccountOnboarded({ details_submitted: null, payouts_enabled: null, capabilities: null }),
    ).toBe(false)
  })
})
