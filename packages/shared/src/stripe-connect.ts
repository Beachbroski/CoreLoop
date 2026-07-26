import { z } from 'zod'

// POST /api/v1/stripe/onboard
export const stripeOnboardResponseSchema = z.object({ url: z.string().url() })
export type StripeOnboardResponse = z.infer<typeof stripeOnboardResponseSchema>

// GET /api/v1/stripe/status. requirementsDue (per docs/platform-split/04-payments-payouts.md)
// is deferred — it needs a live stripe.accounts.retrieve call this codebase
// doesn't make anywhere yet; `onboarded` alone is already tracked via the
// existing account.updated webhook (app/api/webhooks/stripe/route.ts).
export const stripeStatusResponseSchema = z.object({ onboarded: z.boolean() })
export type StripeStatusResponse = z.infer<typeof stripeStatusResponseSchema>
