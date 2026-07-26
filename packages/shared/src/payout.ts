import { z } from 'zod'
import { PayoutStatusSchema } from './enums'
import { listQuerySchema } from './pagination'

// GET /api/v1/payouts — stripeTransferId deliberately excluded (internal
// Stripe identifier, no use to the app beyond what status/amount convey).
export const payoutSchema = z.object({
  id: z.string(),
  amount: z.number().int(),
  platformFee: z.number().int(),
  status: PayoutStatusSchema,
  createdAt: z.string(),
})
export type Payout = z.infer<typeof payoutSchema>

export const listPayoutsQuerySchema = listQuerySchema
export type ListPayoutsQuery = z.infer<typeof listPayoutsQuerySchema>
