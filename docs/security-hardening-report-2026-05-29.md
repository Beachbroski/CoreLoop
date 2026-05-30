# CreatorDocks Security Hardening Report

Date: 2026-05-29

## What Changed

- Locked down `/api/stripe/release-payout` so it now requires a trusted same-site request, an authenticated brand user, campaign ownership, and rate limiting before releasing funds.
- Removed `paymentIntentId` trust from payout release requests. The route now loads the payment intent from the matching submission/application record.
- Made waitlist submissions safer under duplicate clicks and concurrent retries by catching unique-constraint races and returning the existing waitlist record when possible.
- Added a small request-size guard to the public waitlist endpoint.
- Tightened production origin checks so state-changing routes reject requests with no `Origin` or `Referer` header in production.
- Protected CSV exports from spreadsheet formula injection by escaping cells that begin with `=`, `+`, `-`, or `@`.
- Restricted UploadThing content uploads to creator accounts instead of any signed-in user.
- Added max-length validation and trimming for submission `caption` and `notes`.
- Fixed application acceptance counting so campaigns do not move to `IN_PROGRESS` from an off-by-one accepted-creator count.
- Added a connection pool cap for Prisma/Postgres with `DATABASE_POOL_MAX`, defaulting to `5`.
- Updated the dashboard layouts so admin-only dashboard pages can render instead of immediately redirecting.
- Fixed the signed-in non-admin waitlist loop by keeping non-admin users on `/waitlist` instead of redirecting them into blocked creator/brand pages.
- Updated `/api/users/me` to use the shared current-user repair helper for more consistent Clerk/user lookup behavior.
- Added Cloudflare Turnstile verification to production waitlist submissions.
- Updated `/internal/waitlist/export` to use the shared repaired-user admin resolver.
- Added a Clerk user menu/sign-out control to the internal waitlist admin page.

## Verification

- `npm run lint` passes with 0 errors.
- Remaining lint warnings are the known dashboard `<img>` optimization warnings.
- `npm run build` passes.
- Local build still prints the local Clerk development-key warning because this machine's `.env.local` uses a `pk_test_` key. Confirm Vercel production uses the live Clerk production key.

## Still Needs Manual / Platform Work

- Create a Cloudflare Turnstile site for `www.creatordocks.com` before pushing TikTok traffic hard.
- Add `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` in Vercel production.
- Configure `DATABASE_POOL_MAX` in Vercel if you want a value other than the default `5`.
- Confirm Vercel production has live Clerk keys, not development keys.
- Confirm Stripe Connect is fully enabled in Stripe before testing creator onboarding with real accounts.
- Confirm Stripe webhook events are configured for the production endpoint.
- Confirm UploadThing usage/cost limits in the UploadThing dashboard, because app code cannot prevent all storage/cost abuse by itself.
- Consider tightening the CSP later by removing `unsafe-inline`, `unsafe-eval`, and broad `https:` allowances once Clerk/Stripe requirements are fully known.

## Not Fully Solved In Code

- Durable IP-based rate limiting still requires an external service or Vercel platform rule if you want an additional layer beyond Turnstile.
- Uploads are now creator-only, but they are not yet scoped to a specific accepted application before upload. That requires passing application context into the UploadThing middleware.
- Application acceptance is safer, but truly perfect overfill prevention under concurrent requests should use a stronger DB-level reservation/counter strategy.
- Public product APIs still exist for authenticated users because the marketplace is preserved for testing. If you want absolutely every non-waitlist API to be admin-only, that should be a deliberate product decision.
