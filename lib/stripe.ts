import Stripe from 'stripe'

// Instantiate the Stripe client lazily. `next build` evaluates every route
// module while collecting page data, and constructing Stripe eagerly would
// throw ("Neither apiKey nor config.authenticator provided") whenever
// STRIPE_SECRET_KEY is absent at build time (e.g. Vercel preview builds).
// The Proxy defers construction to the first real property access so the
// secret is only required when Stripe is actually used at runtime.
let client: Stripe | null = null

function getStripe(): Stripe {
  if (!client) {
    const apiKey = process.env.STRIPE_SECRET_KEY
    if (!apiKey) {
      throw new Error('STRIPE_SECRET_KEY is not set')
    }
    client = new Stripe(apiKey, {
      apiVersion: '2026-04-22.dahlia',
      typescript: true,
    })
  }
  return client
}

export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    const value = Reflect.get(getStripe(), prop)
    return typeof value === 'function' ? value.bind(client) : value
  },
})
