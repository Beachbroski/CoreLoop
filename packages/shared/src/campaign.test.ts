import { describe, expect, it } from 'vitest'
import { campaignDetailSchema, campaignListItemSchema, listCampaignsQuerySchema } from './campaign'

const baseListItem = {
  id: 'camp_1',
  title: 'Summer glow-up',
  budget: 5000,
  deadline: '2026-08-01T00:00:00.000Z',
  niche: 'beauty',
  platforms: ['instagram', 'tiktok'],
  creatorsNeeded: 3,
  createdAt: '2026-07-01T00:00:00.000Z',
  brand: { name: 'Acme Co', avatarUrl: null },
}

describe('campaignListItemSchema', () => {
  it('accepts a valid list item', () => {
    expect(campaignListItemSchema.safeParse(baseListItem).success).toBe(true)
  })

  it('rejects a negative budget', () => {
    const result = campaignListItemSchema.safeParse({ ...baseListItem, budget: -1 })
    expect(result.success).toBe(false)
  })
})

describe('campaignDetailSchema', () => {
  it('accepts a valid detail payload extending the list item', () => {
    const detail = {
      ...baseListItem,
      description: 'A full campaign brief.',
      objective: null,
      deliverables: null,
      targetAudience: null,
      creatorRequirements: null,
      callToAction: null,
      usageRights: null,
    }
    expect(campaignDetailSchema.safeParse(detail).success).toBe(true)
  })
})

describe('listCampaignsQuerySchema', () => {
  it('applies defaults when nothing is provided', () => {
    const result = listCampaignsQuerySchema.parse({})
    expect(result).toEqual({ page: 1, limit: 20 })
  })

  it('coerces string query params to numbers', () => {
    const result = listCampaignsQuerySchema.parse({ page: '2', limit: '10', niche: 'beauty' })
    expect(result).toEqual({ page: 2, limit: 10, niche: 'beauty' })
  })

  it('rejects a limit above the max of 50', () => {
    const result = listCampaignsQuerySchema.safeParse({ limit: '500' })
    expect(result.success).toBe(false)
  })
})
