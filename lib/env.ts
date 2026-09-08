import { z } from 'zod'

/**
 * Server environment validation (M2 / SEC-07).
 *
 * Design constraints that shaped this module:
 *
 *  1. `next build` must keep working with no secrets at all. Vercel preview
 *     builds and CI run without Stripe, Resend, Turnstile or Upstash on
 *     purpose, and the Stripe client is already lazily constructed for exactly
 *     that reason (see lib/stripe.ts). So nothing here runs at import time —
 *     every check is behind a function call.
 *  2. "Required" is relative to the deployment. A variable that is mandatory on
 *     production is deliberately absent locally, so the required set is only
 *     enforced when the deployment says it should be.
 *  3. Validation reports EVERY problem at once and names the variable, so a
 *     misconfiguration is one clear failure instead of a per-request mystery.
 */

export type DeploymentEnvironment = 'development' | 'preview' | 'production'

/** A raw environment bag. Injectable so the parser is pure and testable. */
export type EnvSource = Record<string, string | undefined>

/**
 * Variables the production deployment cannot serve a request without. Anything
 * with a documented graceful fallback (Turnstile fails closed on its own,
 * Upstash falls back to the in-memory limiter, NEXT_PUBLIC_URL falls back to
 * VERCEL_URL) stays optional on purpose.
 */
export const PRODUCTION_REQUIRED_VARS = [
  'DATABASE_URL',
  'CLERK_SECRET_KEY',
  'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
  'CLERK_WEBHOOK_SECRET',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
] as const

/**
 * Upper bound for DATABASE_POOL_MAX. Each serverless instance opens its own
 * pool against Neon's direct (non-pooled) endpoint, so the real ceiling is
 * Neon's connection limit divided by concurrent instances. A value above this
 * is far more likely to be a typo than an intent, and exhausting Neon's
 * connections takes the whole app down rather than one request.
 */
const MAX_DATABASE_POOL = 20

/** Stripe key prefixes, by mode. Restricted keys (`rk_`) follow the same shape. */
const STRIPE_LIVE_PREFIXES = ['sk_live_', 'rk_live_'] as const
const STRIPE_TEST_PREFIXES = ['sk_test_', 'rk_test_'] as const

const nonEmpty = z.string().trim().min(1)
const optionalNonEmpty = nonEmpty.optional()

/**
 * Every server variable this app reads. All optional here — "required" is
 * applied afterwards, per deployment, so the same schema serves local dev.
 */
const serverEnvSchema = z.object({
  DATABASE_URL: optionalNonEmpty,
  // An env var set to an empty string is the platform's way of saying "unset";
  // coercing "" straight to a number would make it a spurious 0.
  DATABASE_POOL_MAX: z.preprocess(
    value => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    z.coerce.number().int().positive().max(MAX_DATABASE_POOL).optional(),
  ),
  CLERK_SECRET_KEY: optionalNonEmpty,
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: optionalNonEmpty,
  CLERK_WEBHOOK_SECRET: optionalNonEmpty,
  STRIPE_SECRET_KEY: optionalNonEmpty,
  STRIPE_WEBHOOK_SECRET: optionalNonEmpty,
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: optionalNonEmpty,
  RESEND_API_KEY: optionalNonEmpty,
  EMAIL_FROM_ADDRESS: optionalNonEmpty,
  TURNSTILE_SECRET_KEY: optionalNonEmpty,
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: optionalNonEmpty,
  UPSTASH_REDIS_REST_URL: optionalNonEmpty,
  UPSTASH_REDIS_REST_TOKEN: optionalNonEmpty,
  KV_REST_API_URL: optionalNonEmpty,
  KV_REST_API_TOKEN: optionalNonEmpty,
  NEXT_PUBLIC_URL: optionalNonEmpty,
  VERCEL_URL: optionalNonEmpty,
})

type ParsedServerEnv = z.infer<typeof serverEnvSchema>

export type ServerEnv = Readonly<{
  deployment: DeploymentEnvironment
  isProduction: boolean
  database: Readonly<{ url?: string; poolMax?: number }>
  clerk: Readonly<{ secretKey?: string; publishableKey?: string; webhookSecret?: string }>
  stripe: Readonly<{ secretKey?: string; webhookSecret?: string; publishableKey?: string }>
  email: Readonly<{ resendApiKey?: string; fromAddress?: string }>
  turnstile: Readonly<{ secretKey?: string; siteKey?: string }>
  rateLimitStore: Readonly<{ url?: string; token?: string }>
  siteUrl?: string
}>

export type ServerEnvResult =
  | { ok: true; env: ServerEnv }
  | { ok: false; problems: readonly string[] }

const DEPLOYMENT_VALUES: readonly DeploymentEnvironment[] = ['development', 'preview', 'production']

/**
 * VERCEL_ENV is authoritative when present (it is the only value that tells
 * preview apart from production). NODE_ENV is the local/CI fallback.
 */
export function resolveDeploymentEnvironment(source: EnvSource): DeploymentEnvironment {
  const vercelEnv = source.VERCEL_ENV?.trim()
  if (vercelEnv && DEPLOYMENT_VALUES.includes(vercelEnv as DeploymentEnvironment)) {
    return vercelEnv as DeploymentEnvironment
  }

  return source.NODE_ENV === 'production' ? 'production' : 'development'
}

function stripeModeProblem(secretKey: string | undefined, deployment: DeploymentEnvironment): string | null {
  if (!secretKey) return null

  const isLive = STRIPE_LIVE_PREFIXES.some(prefix => secretKey.startsWith(prefix))
  const isTest = STRIPE_TEST_PREFIXES.some(prefix => secretKey.startsWith(prefix))

  if (isLive && deployment !== 'production') {
    return `STRIPE_SECRET_KEY is a live-mode key but the deployment is "${deployment}". Live keys move real money — use a test-mode key outside production.`
  }

  if (isTest && deployment === 'production') {
    return 'STRIPE_SECRET_KEY is a test-mode key but the deployment is "production". Production must use a live-mode key.'
  }

  return null
}

function missingRequiredProblems(
  parsed: ParsedServerEnv,
  deployment: DeploymentEnvironment,
): readonly string[] {
  if (deployment !== 'production') return []

  return PRODUCTION_REQUIRED_VARS.filter(name => !parsed[name]).map(
    name => `${name} is required on the production deployment but is missing or empty.`,
  )
}

function toServerEnv(parsed: ParsedServerEnv, deployment: DeploymentEnvironment): ServerEnv {
  return Object.freeze({
    deployment,
    isProduction: deployment === 'production',
    database: Object.freeze({ url: parsed.DATABASE_URL, poolMax: parsed.DATABASE_POOL_MAX }),
    clerk: Object.freeze({
      secretKey: parsed.CLERK_SECRET_KEY,
      publishableKey: parsed.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
      webhookSecret: parsed.CLERK_WEBHOOK_SECRET,
    }),
    stripe: Object.freeze({
      secretKey: parsed.STRIPE_SECRET_KEY,
      webhookSecret: parsed.STRIPE_WEBHOOK_SECRET,
      publishableKey: parsed.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    }),
    email: Object.freeze({
      resendApiKey: parsed.RESEND_API_KEY,
      fromAddress: parsed.EMAIL_FROM_ADDRESS,
    }),
    turnstile: Object.freeze({
      secretKey: parsed.TURNSTILE_SECRET_KEY,
      siteKey: parsed.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
    }),
    rateLimitStore: Object.freeze({
      url: parsed.UPSTASH_REDIS_REST_URL ?? parsed.KV_REST_API_URL,
      token: parsed.UPSTASH_REDIS_REST_TOKEN ?? parsed.KV_REST_API_TOKEN,
    }),
    siteUrl: parsed.NEXT_PUBLIC_URL ?? (parsed.VERCEL_URL ? `https://${parsed.VERCEL_URL}` : undefined),
  })
}

/**
 * Pure validation. Returns every problem it finds rather than throwing, so the
 * caller decides whether a misconfiguration is fatal.
 */
export function parseServerEnv(source: EnvSource): ServerEnvResult {
  const deployment = resolveDeploymentEnvironment(source)
  const result = serverEnvSchema.safeParse(source)

  if (!result.success) {
    const problems = result.error.issues.map(
      issue => `${issue.path.join('.') || '(root)'}: ${issue.message}`,
    )
    return { ok: false, problems }
  }

  const problems = [
    ...missingRequiredProblems(result.data, deployment),
    stripeModeProblem(result.data.STRIPE_SECRET_KEY, deployment),
  ].filter((problem): problem is string => problem !== null)

  if (problems.length > 0) return { ok: false, problems }

  return { ok: true, env: toServerEnv(result.data, deployment) }
}

export function formatEnvProblems(problems: readonly string[]): string {
  return ['Invalid server environment:', ...problems.map(problem => `  - ${problem}`)].join('\n')
}

let cachedEnv: ServerEnv | null = null

/**
 * The validated environment, parsed once per process. Throws with every problem
 * named. Call it from request-time code, never at module scope — a module-scope
 * call would run during `next build` and reintroduce the build break this
 * module exists to avoid.
 */
export function getServerEnv(): ServerEnv {
  if (cachedEnv) return cachedEnv

  const result = parseServerEnv(process.env as EnvSource)
  if (!result.ok) {
    throw new Error(formatEnvProblems(result.problems))
  }

  cachedEnv = result.env
  return cachedEnv
}

/**
 * Durable rate-limit store credentials, read without asserting anything else
 * about the environment: the limiter has a working in-memory fallback, so a
 * missing Stripe key must never be able to take it down.
 */
export function getRateLimitStoreCredentials(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN
  if (!url?.trim() || !token?.trim()) return null

  return { url: url.trim(), token: token.trim() }
}
