import { z } from 'zod'

// POST /api/v1/stripe/onboard
export const stripeOnboardResponseSchema = z.object({ url: z.string().url() })
export type StripeOnboardResponse = z.infer<typeof stripeOnboardResponseSchema>

// GET /api/v1/stripe/status. requirementsDue (per docs/platform-split/04-payments-payouts.md)
// is deferred — `onboarded` alone is what gates applying. It is now resolved
// from a live stripe.accounts.retrieve in the route, with the account.updated
// webhook (app/api/webhooks/stripe/route.ts) as the other writer.
export const stripeStatusResponseSchema = z.object({ onboarded: z.boolean() })
export type StripeStatusResponse = z.infer<typeof stripeStatusResponseSchema>

/**
 * Where Stripe Connect onboarding sends a creator when it is done with them.
 *
 * Stripe will only accept an `https://` URL for `return_url`/`refresh_url`, so
 * a Connect account link cannot deep-link into the app directly. The web pages
 * at these paths exist purely to bounce straight back out to the app.
 *
 * Both halves live here because they are one contract: the web page navigates
 * to the deep link, and the app hands the same string to
 * `openAuthSessionAsync`, which closes the in-app browser when it sees that
 * scheme. If the two ever disagreed, onboarding would complete and the sheet
 * would simply never close.
 */
export const STRIPE_RETURN_PATH = '/stripe/return'
export const STRIPE_REFRESH_PATH = '/stripe/refresh'

export const STRIPE_RETURN_DEEP_LINK = 'creatordocks://stripe/return'
export const STRIPE_REFRESH_DEEP_LINK = 'creatordocks://stripe/refresh'
