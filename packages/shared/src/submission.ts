import { z } from 'zod'
import { contentUrlSchema } from './content-url'
import { SubmissionStatusSchema } from './enums'
import { listQuerySchema } from './pagination'

// POST /api/v1/submissions
export const createSubmissionRequestSchema = z.object({
  applicationId: z.string().min(1),
  contentUrl: contentUrlSchema,
  caption: z.string().trim().max(2000).optional(),
  notes: z.string().trim().max(2000).optional(),
})
export type CreateSubmissionRequest = z.infer<typeof createSubmissionRequestSchema>

// PATCH /api/v1/submissions/:id — resubmitting after REVISION_REQUESTED/REJECTED
export const resubmitSubmissionRequestSchema = z.object({
  contentUrl: contentUrlSchema,
  caption: z.string().trim().max(2000).optional(),
  notes: z.string().trim().max(2000).optional(),
})
export type ResubmitSubmissionRequest = z.infer<typeof resubmitSubmissionRequestSchema>

const submissionApplicationSummarySchema = z.object({
  id: z.string(),
  campaign: z.object({ id: z.string(), title: z.string() }),
})

export const submissionSchema = z.object({
  id: z.string(),
  applicationId: z.string(),
  contentUrl: z.string(),
  caption: z.string().nullable(),
  notes: z.string().nullable(),
  status: SubmissionStatusSchema,
  reviewNote: z.string().nullable(),
  createdAt: z.string(),
  application: submissionApplicationSummarySchema,
})
export type Submission = z.infer<typeof submissionSchema>

export const listSubmissionsQuerySchema = listQuerySchema
export type ListSubmissionsQuery = z.infer<typeof listSubmissionsQuerySchema>
