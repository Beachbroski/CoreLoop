import { z } from 'zod'
import { RoleSchema } from './enums'

// GET /api/v1/me. Deliberately excludes clerkId and stripeAccountId — those
// never leave the server (see docs/platform-split/02-mobile-api.md).
export const meResponseSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  email: z.string(),
  avatarUrl: z.string().nullable(),
  bio: z.string().nullable(),
  role: RoleSchema,
  stripeOnboarded: z.boolean(),
})
export type MeResponse = z.infer<typeof meResponseSchema>

// PATCH /api/v1/me
export const updateMeRequestSchema = z.object({
  name: z.string().trim().min(1).max(80).nullable().optional(),
  bio: z.string().trim().max(500).nullable().optional(),
})
export type UpdateMeRequest = z.infer<typeof updateMeRequestSchema>
