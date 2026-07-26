import { z } from 'zod'
import { ApplicationStatusSchema } from './enums'
import { listQuerySchema } from './pagination'

// POST /api/v1/applications
export const createApplicationRequestSchema = z.object({
  campaignId: z.string().min(1),
  pitch: z.string().trim().min(20).max(2000),
  proposedRate: z.number().int().min(100).max(10_000_000),
})
export type CreateApplicationRequest = z.infer<typeof createApplicationRequestSchema>

const applicationCampaignSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  budget: z.number().int(),
  niche: z.string(),
})

export const applicationSchema = z.object({
  id: z.string(),
  campaignId: z.string(),
  pitch: z.string(),
  proposedRate: z.number().int(),
  status: ApplicationStatusSchema,
  createdAt: z.string(),
  campaign: applicationCampaignSummarySchema,
})
export type Application = z.infer<typeof applicationSchema>

export const listApplicationsQuerySchema = listQuerySchema
export type ListApplicationsQuery = z.infer<typeof listApplicationsQuerySchema>
