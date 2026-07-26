import { describe, expect, it } from 'vitest'
import { stripeOnboardResponseSchema, stripeStatusResponseSchema } from './stripe-connect'

describe('stripeOnboardResponseSchema', () => {
  it('accepts a valid onboarding URL', () => {
    expect(stripeOnboardResponseSchema.safeParse({ url: 'https://connect.stripe.com/setup/abc' }).success).toBe(true)
  })

  it('rejects a non-URL string', () => {
    expect(stripeOnboardResponseSchema.safeParse({ url: 'not-a-url' }).success).toBe(false)
  })
})

describe('stripeStatusResponseSchema', () => {
  it('accepts a boolean onboarded flag', () => {
    expect(stripeStatusResponseSchema.safeParse({ onboarded: true }).success).toBe(true)
  })

  it('rejects a missing onboarded flag', () => {
    expect(stripeStatusResponseSchema.safeParse({}).success).toBe(false)
  })
})
