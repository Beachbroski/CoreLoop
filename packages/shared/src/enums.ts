import { z } from 'zod'

export const RoleSchema = z.enum(['BRAND', 'CREATOR', 'ADMIN'])
export type Role = z.infer<typeof RoleSchema>

export const CampaignStatusSchema = z.enum(['DRAFT', 'ACTIVE', 'IN_PROGRESS', 'COMPLETE', 'CANCELLED'])
export type CampaignStatus = z.infer<typeof CampaignStatusSchema>

export const ApplicationStatusSchema = z.enum(['PENDING', 'ACCEPTED', 'REJECTED'])
export type ApplicationStatus = z.infer<typeof ApplicationStatusSchema>

export const SubmissionStatusSchema = z.enum(['PENDING', 'APPROVED', 'REVISION_REQUESTED', 'REJECTED'])
export type SubmissionStatus = z.infer<typeof SubmissionStatusSchema>

export const PayoutStatusSchema = z.enum(['PENDING', 'PROCESSING', 'PAID', 'FAILED'])
export type PayoutStatus = z.infer<typeof PayoutStatusSchema>
