import { z } from 'zod'
import { PayoutStatusSchema } from './enums'
import { listQuerySchema } from './pagination'

// Mirrors campaignBrandSchema's nullable `name` (User.name is optional), but
// not its avatarUrl — an earnings row reads "Glow Co · Summer Skincare Launch"
// in text, and the campaign feed is the only place that renders a brand mark.
const payoutCampaignBrandSchema = z.object({
  name: z.string().nullable(),
})

// Reached via Payout -> Submission -> Application -> Campaign. Just enough to
// name the work a payment came from; the money facts already live on the
// payout itself, and campaign budget/niche would only invite confusion next
// to an amount the creator actually earned.
const payoutCampaignSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  // Optional for the same reason as `campaign` below, and not hypothetically:
  // the campaign-only shape shipped first, so a deployment that sends a
  // campaign with no brand is a real intermediate state of this very branch.
  brand: payoutCampaignBrandSchema.optional(),
})

// GET /api/v1/payouts — stripeTransferId deliberately excluded (internal
// Stripe identifier, no use to the app beyond what status/amount convey).
export const payoutSchema = z.object({
  id: z.string(),
  amount: z.number().int(),
  platformFee: z.number().int(),
  status: PayoutStatusSchema,
  createdAt: z.string(),
  // Optional on the contract, always sent by the API — every hop of the
  // relation is non-nullable, so a payout without a campaign cannot exist.
  // It stays optional because api-client.ts treats a parse failure as fatal
  // for the whole response: an app build that reaches a deployment predating
  // this field (a rollback, a pinned EXPO_PUBLIC_API_URL) would lose the
  // entire Earnings screen rather than one caption.
  campaign: payoutCampaignSummarySchema.optional(),
})
export type Payout = z.infer<typeof payoutSchema>

export const listPayoutsQuerySchema = listQuerySchema
export type ListPayoutsQuery = z.infer<typeof listPayoutsQuerySchema>
