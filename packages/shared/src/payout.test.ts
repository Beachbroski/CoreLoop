import { describe, expect, it } from 'vitest'
import { payoutSchema } from './payout'

describe('payoutSchema', () => {
  it('accepts a valid payout and strips unknown fields like stripeTransferId', () => {
    const parsed = payoutSchema.parse({
      id: 'payout_1',
      amount: 4500,
      platformFee: 500,
      status: 'PAID',
      createdAt: '2026-07-01T00:00:00.000Z',
      stripeTransferId: 'tr_secret_internal_id',
    })

    expect(parsed).not.toHaveProperty('stripeTransferId')
  })

  it('rejects an unknown status', () => {
    const result = payoutSchema.safeParse({
      id: 'payout_1',
      amount: 4500,
      platformFee: 500,
      status: 'REFUNDED',
      createdAt: '2026-07-01T00:00:00.000Z',
    })
    expect(result.success).toBe(false)
  })
})
