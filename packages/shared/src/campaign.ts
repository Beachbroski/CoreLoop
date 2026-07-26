import { z } from 'zod'
import { listQuerySchema } from './pagination'

const campaignBrandSchema = z.object({
  name: z.string().nullable(),
  avatarUrl: z.string().nullable(),
})

// GET /api/v1/campaigns list items — deliberately lighter than the detail
// view (data minimization: a feed shouldn't over-fetch full campaign text).
export const campaignListItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  budget: z.number().int().positive(),
  deadline: z.string(),
  niche: z.string(),
  platforms: z.array(z.string()),
  creatorsNeeded: z.number().int().nullable(),
  createdAt: z.string(),
  brand: campaignBrandSchema,
})
export type CampaignListItem = z.infer<typeof campaignListItemSchema>

// GET /api/v1/campaigns/:id
export const campaignDetailSchema = campaignListItemSchema.extend({
  description: z.string(),
  objective: z.string().nullable(),
  deliverables: z.string().nullable(),
  targetAudience: z.string().nullable(),
  creatorRequirements: z.string().nullable(),
  callToAction: z.string().nullable(),
  usageRights: z.string().nullable(),
})
export type CampaignDetail = z.infer<typeof campaignDetailSchema>

export const listCampaignsQuerySchema = listQuerySchema.extend({
  niche: z.string().min(1).max(60).optional(),
  platform: z.string().min(1).max(40).optional(),
})
export type ListCampaignsQuery = z.infer<typeof listCampaignsQuerySchema>
