# CreatorDocks

A creator ↔ local-brand marketplace. **Since the 2026-07-25 platform split, the
product is brand-first on web and creator-first on iOS:**

- **Web (this app)** is for brands: post a campaign, review applicants, approve
  content, release payment. Creator web dashboards still exist but are in
  run-out — see `docs/platform-split/creator-web-freeze.md` — and are gated by
  `CREATOR_WEB_MODE` (below).
- **iOS app** (`mobile/`, Expo/React Native) is where creators discover
  campaigns, apply, submit content, and get paid. See `mobile/README.md`.
- Both surfaces are served by **this one Next.js backend**. The web app uses
  Clerk session cookies; the iOS app authenticates against a separate
  versioned, Bearer-token API namespace, `/api/v1/*` (`lib/mobile-api-guard.ts`).
  Legacy `/api/*` routes remain session-only and are not part of the mobile
  contract.

The public site is currently invite-led for brands (a "Request access" form,
not a general waitlist) — access to the marketplace dashboards/APIs is gated
by the tester allowlist below in every environment except local dev.

Full context on the split, and everything left to do before this can go live
for real users, lives in:

- `docs/platform-split/00-MASTER-PLAN.md` and the numbered workstream docs in
  that directory (shared foundation, mobile API, iOS app, payments, security,
  notifications/media, brand web refocus, release/sunset).
- `docs/production-readiness-2026-09-06.md` — the current launch-readiness
  audit and work order. Read this before touching production config or
  deploying `main`.
- `docs/runbooks/` — operational runbooks (deploy, migrate, rollback, secret
  rotation). **Read `docs/runbooks/deploy.md` before ever running
  `git push` on `main` or touching Vercel env** — the production environment
  and the creator-web sunset flag are both currently misconfigured for a safe
  deploy.

## Monorepo layout

npm workspaces, three packages:

| Path | What |
| --- | --- |
| `/` (this directory, package `marketplace`) | The Next.js 16 (App Router) app: web UI, legacy `/api/*` session routes, and the `/api/v1/*` mobile API, all on one backend. |
| `packages/shared` (`@creatordocks/shared`) | Zod contracts and enums shared by web and mobile — the mobile API's request/response schemas live here so both sides can't drift apart. Banned from importing server-only packages (`@prisma/client`, `stripe`, `@clerk/nextjs`, etc.) since it ships inside the mobile bundle. |
| `mobile` (Expo app) | The creator iOS app. See `mobile/README.md` for setup — it has its own dependencies, env vars, and a real device/simulator workflow that this README doesn't cover. |

## Getting started (web)

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). `npm install` at the repo
root also installs `packages/shared` and `mobile` (npm workspaces) and runs
`prisma generate` via `postinstall`.

### Database — read this before running any Prisma command

**There is exactly one Neon Postgres database, and local dev, previews, and
production all point at it.** There is no separate local database.

- **Do NOT run `npx prisma migrate dev`.** It can generate a new migration
  interactively and, on drift, offers to reset the database — against the
  *shared production database*, not a throwaway local one. There is no
  environment where this command is safe to run in this repo.
- To apply the checked-in migrations (e.g. after pulling new schema changes),
  use the non-interactive, no-reset command instead:
  ```bash
  npx prisma migrate deploy
  ```
- To check whether the database matches `schema.prisma` without changing
  anything:
  ```bash
  npx prisma migrate status
  npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma
  ```
- Never run `prisma migrate reset` or `prisma db push` here for the same
  reason. If you need a new migration, write it and get it reviewed before it
  touches the shared database — see `docs/runbooks/migrate.md`.

## Roles and access

There is a single sign-in page (`/sign-in`, Clerk). After login everyone lands
on `/post-login`, which routes by account state:

| Account | Lands on |
| --- | --- |
| Admin (`role=ADMIN` + email in `ADMIN_ALLOWED_EMAILS`) | `/internal/waitlist` |
| Tester without a role yet | `/onboarding` (pick Brand or Creator) |
| Tester with `role=BRAND` | `/brand` |
| Tester with `role=CREATOR` | `/creator`, subject to `CREATOR_WEB_MODE` |
| Everyone else | `/waitlist` |

- **Testers** are emails listed in `TESTER_ALLOWED_EMAILS` (or
  `ADMIN_ALLOWED_EMAILS`, which implies tester access). Only testers can use
  the marketplace dashboards and legacy web APIs while access stays
  invite-led. This does not gate `/api/v1/*` — that's Bearer-token only, see
  `lib/mobile-api-guard.ts`.
- **Admins** use the same sign-in page. The internal ops dashboard lives at
  `/internal/waitlist` (leads/admin tooling) and `/internal/users` (view-as),
  and returns a 404/redirect for anyone who is not an allowlisted admin, in
  every environment.
- With no allowlists configured, tester/admin access is open **only** when
  `NODE_ENV=development` (local dev). Preview and production deployments stay
  locked down.
- **`CREATOR_WEB_MODE`** independently governs the `/creator/*` dashboards on
  web (`full` / `readonly` / `sunset`) as the product moves creators to the
  iOS app. **Unset resolves to `sunset`** — creator web routes redirect to
  `/get-the-app` and creator writes are refused server-side. See
  `lib/creator-web-mode.ts` and `docs/platform-split/creator-web-freeze.md`.
  Every environment that still needs working creator web (production today)
  must set this explicitly; it does not default to the old behavior.

### Creating an admin

1. Add the email to `ADMIN_ALLOWED_EMAILS`.
2. Sign in once and pick either role on `/onboarding` so the user row exists.
3. Run `npm run promote:admin -- you@example.com` (refuses emails not in the
   allowlist).
4. Sign in again — you'll be routed to `/internal/waitlist`.

## Environment variables

"Unset behavior" describes what happens with the variable absent, not what to
set it to. `dev` / `preview` / `prod` say which environments need a real
value; `-` means the app runs fine without it there (a feature no-ops or a
default applies).

| Variable | Purpose | dev | preview | prod | Unset behavior |
| --- | --- | --- | --- | --- | --- |
| `DATABASE_URL` | Postgres connection string (Prisma), the one shared Neon database. | ✅ | ✅ | ✅ | App cannot start. |
| `DATABASE_POOL_MAX` | Max connections in the `pg` pool (`lib/prisma.ts`). | - | - | recommended | Defaults to `5`. |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` | Clerk auth (web, session cookies). | ✅ | ✅ | ✅ | App cannot authenticate. |
| `CLERK_WEBHOOK_SECRET` | Verifies Clerk webhooks (svix). | - | ✅ | ✅ | Webhook verification fails closed. |
| `ADMIN_ALLOWED_EMAILS` | Comma-separated admin emails. Gate for `/internal/*` and the promote script. Admin emails are testers automatically. | - | ✅ | ✅ | No admins (open in dev only, per NODE_ENV rule above). |
| `TESTER_ALLOWED_EMAILS` | Comma-separated tester emails allowed into the marketplace dashboards and legacy `/api/*` writes. | - | ✅ | ✅ | No testers (open in dev only). |
| `CREATOR_WEB_MODE` | `full` / `readonly` / `sunset` — gates the `/creator/*` web dashboards. | ✅ (`full`, to develop against it) | set per intent | ✅ | **`sunset`** — creator web redirects to `/get-the-app`, creator writes blocked. |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | Stripe Connect payments and webhooks. | test keys | test keys | ✅ live | Payment/payout routes fail. |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe.js on the client. | test key | test key | ✅ live | Client-side Stripe.js can't init. |
| `UPLOADTHING_TOKEN` | Creator content uploads. **uploadthing v7 reads only this variable** — the legacy v6 names `UPLOADTHING_SECRET`/`UPLOADTHING_APP_ID` are silently ignored by the installed SDK. If Vercel still has those old names set instead of `UPLOADTHING_TOKEN`, uploads are broken in that environment even though the dashboard looks configured; delete the old names and set this one. | ✅ | ✅ | ✅ | Uploads fail. |
| `RESEND_API_KEY` | Transactional email (application decisions, submission/payout events, waitlist confirmation, referral milestones, invites, admin payment-dispute alerts). | - | - | ✅ | `lib/email.ts` logs a warning and skips sending instead of failing. |
| `EMAIL_FROM_ADDRESS` | Optional override for the email "from" address (defaults to `CreatorDocks <notifications@creatordocks.com>`). | - | - | - | Uses the default above. |
| `TURNSTILE_SECRET_KEY` / `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Cloudflare Turnstile bot check on the "Request access" form. | - | recommended | ✅ | Form's bot check no-ops/fails per `lib/turnstile.ts`. |
| `NEXT_PUBLIC_URL` | Canonical site URL (falls back to `VERCEL_URL`). Production should be `https://www.creatordocks.com` — see `docs/vercel-domain-launch.md`. | - | - | ✅ | Falls back to `VERCEL_URL`, wrong host in links/metadata. |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` (or `KV_REST_API_URL` / `KV_REST_API_TOKEN`) | Durable, cross-instance rate limiting (`lib/rate-limit.ts`, Upstash Redis via Vercel Marketplace). Either naming works — both are checked. | - | recommended | ✅ | Falls back to a per-instance in-memory limiter — resets on cold start, effectively decorative on Vercel serverless. Fails open on a store error either way. |
| `MOBILE_MIN_SUPPORTED_VERSION` | Oldest app version the API still serves, returned from `GET /api/v1/meta`. | - | - | ✅ | Defaults to `1.0.0`. |
| `MOBILE_LATEST_VERSION` | Latest app version, returned from `GET /api/v1/meta` (drives the app's update prompt). | - | - | ✅ | Defaults to `1.0.0`. |
| `MOBILE_MAINTENANCE_MODE` | `"true"` to have the app show a maintenance screen. | - | - | - | Treated as `false` (not maintenance). |
| `NEXT_PUBLIC_IOS_APP_URL` | App Store URL for the CreatorDocks app; flips `/get-the-app` from a waitlist form to a real App Store link/button. | - | - | once app is live | Page shows the waitlist form instead of a store link. |
| `NEXT_PUBLIC_IOS_APP_ID` | Numeric App Store id, used for the `apple-itunes-app` meta tag on `/get-the-app`. | - | - | once app is live | Meta tag omitted. |

The iOS app has its own env vars (`EXPO_PUBLIC_API_URL`,
`EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`) — see `mobile/README.md`.

## Scripts

**Root (web, from repo root):**
- `npm run dev` / `npm run build` / `npm start`
- `npm run lint` — ESLint
- `npm run test` — `vitest run`
- `npx tsc --noEmit` — typecheck
- `npm run promote:admin -- <email>` — promote an existing user to ADMIN
  (validated against `ADMIN_ALLOWED_EMAILS`).

**`packages/shared`** (`npm run <script> --workspace=packages/shared`):
- `test` — `vitest run` (schema/enum contract tests, including a guard against
  the shared enums drifting from Prisma's).
- `typecheck` — `tsc --noEmit`

**`mobile/`** — see `mobile/README.md`; it has its own `dev`/`test`/`lint`/
`typecheck` scripts and a native build step that root scripts don't cover.

## Before you deploy

Nothing in this repo is deployed past the July code currently live in
production — see `docs/production-readiness-2026-09-06.md` for the full
picture, and `docs/runbooks/deploy.md` for the actual deploy procedure once
the production environment fixes it describes are in place. Pushing `main`
today would flip `CREATOR_WEB_MODE` to `sunset` in production (unset ⇒
sunset) and go out with a broken payments/upload/bot-check environment.
