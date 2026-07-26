import { describe, expect, it } from 'vitest'
import { applicationSchema, createApplicationRequestSchema } from './application'

describe('createApplicationRequestSchema', () => {
  it('accepts a valid application', () => {
    const result = createApplicationRequestSchema.safeParse({
      campaignId: 'camp_1',
      pitch: 'a'.repeat(30),
      proposedRate: 500,
    })
    expect(result.success).toBe(true)
  })

  it('rejects a pitch under the 20 character minimum', () => {
    const result = createApplicationRequestSchema.safeParse({
      campaignId: 'camp_1',
      pitch: 'too short',
      proposedRate: 500,
    })
    expect(result.success).toBe(false)
  })

  it('rejects a non-positive proposedRate', () => {
    const result = createApplicationRequestSchema.safeParse({
      campaignId: 'camp_1',
      pitch: 'a'.repeat(30),
      proposedRate: 0,
    })
    expect(result.success).toBe(false)
  })
})

describe('applicationSchema', () => {
  it('accepts a valid application response', () => {
    const result = applicationSchema.safeParse({
      id: 'app_1',
      campaignId: 'camp_1',
      pitch: 'a'.repeat(30),
      proposedRate: 500,
      status: 'PENDING',
      createdAt: '2026-07-01T00:00:00.000Z',
      campaign: { id: 'camp_1', title: 'Summer glow-up', budget: 5000, niche: 'beauty' },
    })
    expect(result.success).toBe(true)
  })

  it('rejects an unknown status', () => {
    const result = applicationSchema.safeParse({
      id: 'app_1',
      campaignId: 'camp_1',
      pitch: 'a'.repeat(30),
      proposedRate: 500,
      status: 'WITHDRAWN',
      createdAt: '2026-07-01T00:00:00.000Z',
      campaign: { id: 'camp_1', title: 'Summer glow-up', budget: 5000, niche: 'beauty' },
    })
    expect(result.success).toBe(false)
  })
})
