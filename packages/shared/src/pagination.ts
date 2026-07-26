import { z } from 'zod'

// Shared by every /api/v1 list endpoint. Page-based rather than cursor-based:
// simpler to implement correctly and sufficient at this app's data volume —
// revisit only if a feed's insert rate makes page drift a real UX problem.
export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})
export type ListQuery = z.infer<typeof listQuerySchema>
