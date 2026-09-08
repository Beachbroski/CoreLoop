# CreatorDocks — Production Readiness Plan

**Audit date:** 2026-09-06 · **Scope:** web (brand product + creator-web sunset), `/api/v1`, iOS app, payments, infra/ops, legal, dependencies, process, plus a code-traced run of the W8-3 full loop · **Method:** 15 read-only auditors, one per area, each citing `path:line`; the adversarial verification pass was cut short by usage limits, so the blockers below were re-checked by hand (marked ✔) and everything else carries the auditor's evidence only.

**Nothing was built or changed.** This document is the work order. Item ids in brackets (e.g. `OPS-02`) point at the auditor findings archived with this audit; every item names an owner: **J** = only Jackson can do it (accounts, money, decisions), **A** = an agent can do it from the repo, **J→A** = Jackson decides, then an agent builds.

---

## 0. Update — 2026-09-07: work landed since the audit

Fourteen files changed, all uncommitted on `fix/ios-design-audit`. Gates green throughout: web 175 tests, shared 48, mobile 377, TypeScript clean in all three workspaces.

**Fixed (blocker/high items now closed):**

| Was | Now | Ids |
|---|---|---|
| `/api/v1` answered an unauthenticated call with a 307 redirect or an HTML 404, so the app could never handle a 401 | Real JSON 401 with `WWW-Authenticate: Bearer`, verified against a running server. Every v1 route was individually confirmed Bearer-guarded before the namespace was made public to the middleware. UploadThing callbacks also unblocked | API-01, SEC-03, AUTH-03, API-11, PUSH-02, LOOP-04 |
| Account deletion left push tokens live, kept Stripe pointers, and returned 200 when the Clerk identity deletion failed | Devices deleted in the same transaction, Clerk deleted first, 502 on failure, Stripe pointers cleared, in-flight-payout guard behind a documented flag, plus a new `user.deleted` webhook handler | API-07, API-08, LEGAL-04/05/07, SEC-09/10, PUSH-11 |
| The app promised "permanently deleted" while the server anonymized | Copy matches the server exactly | LEGAL-03, PARITY-04 |
| No privacy/terms/support link in the app (App Review checks for this) | Three links in Profile | PARITY-03, STORE-11 |
| An uncaught render error closed the app | Error boundary wired into the root and tab layouts | QUAL-01 |
| Mutations retried on network failure, risking duplicate applications | Retry is queries-only; 15s request timeout; central 401 handling | AUTH-04/05/06 |
| Discover filtered the first 20 rows in JavaScript | Server-side niche filter with real pagination | QUAL-03 |
| No environment validation | `lib/env.ts`, Zod-validated, with a Stripe key-mode check and no import-time work | SEC-07 |
| No runbooks | Five, in `docs/runbooks/` | PROC-06 |
| README described a dead product and told you to run a command that resets the production database | Both READMEs rewritten | PROC-05 |

### New findings from the 2026-09-07 production session

Found while fixing Turnstile and Resend on the live site. Not part of the original audit.

| # | Finding | Severity | Detail |
|---|---|---|---|
| **N1** | **Referral codes leak the start of a user's email address** | medium (privacy) | `generateReferralCode(email)` (`app/api/waitlist/route.ts:215`) feeds the email into `makeBaseReferralCode`, which takes the first 6 alphanumeric characters, uppercased. `jackson.m.steele@gmail.com` produces `JACKSO842S`. Referral codes are *designed to be shared publicly* — the product tells creators to post their link — so every creator broadcasts the opening of their email address, which for most people is their real name. Line 307 does the same with `name \|\| email`. Fix: generate a fully random code and stop seeding it from personal data. Existing codes should be regenerated, since they cannot be un-shared. |
| **N2** | **Referral suffixes use `Math.random()`** | low | `app/api/waitlist/route.ts:37`. Not cryptographically random, and paired with a predictable name-derived prefix it makes codes guessable. Combine with N1's fix by using `crypto.randomUUID()` or `crypto.getRandomValues` for the whole code. |
| **N3** | **Test data in the production waitlist** | low (cleanup) | Created while proving the fixes on 2026-09-07, in the shared production database: a row for `jackson.m.steele@gmail.com` (referral code `JACKSO842S`), and a row for `jackson.m.steele+wl1@gmail.com` with handle `@testtest`, TikTok, Lifestyle, 1k–5k. Delete both before launch or before any waitlist export, so they don't pollute counts or the referral leaderboard. |
| **N4** | **`NEXT_PUBLIC_*` variables must never be marked Sensitive in Vercel** | high (process) | Root cause of the outage fixed this session. Sensitive variables reach the server at runtime but not the build, and `NEXT_PUBLIC_` values must be inlined at build time to reach the browser. The result was a form that looked configured server-side (400, not 503) while the Turnstile widget could not render at all, leaving the submit button permanently disabled with no error shown to the visitor. Any future `NEXT_PUBLIC_` variable must be created as a normal encrypted variable. Worth adding as an explicit check in `docs/runbooks/deploy.md`. |

**Verified working in production on 2026-09-07:** Turnstile renders and validates end to end; the waitlist form accepts a real submission; Resend delivers the confirmation email from `notifications@creatordocks.com` on the new-submission path. Note the existing-email path returns early and sends no email by design (`app/api/waitlist/route.ts:193-199`), which is worth knowing before treating a missing email as a fault.

**Still open** — see `docs/BLOCKED-ON-JACKSON.md` for what needs Jackson, and §10 of `docs/PROJECT-STATE.md` for the ready-to-pick-up table (per-route rate-limit keys, authorization-matrix test, dependency bumps, App Review dossier, PII inventory, parity checklist, legal drafts, CI, waitlist disclosure, web contentUrl validation).

Everything in sections 1-9 below is the audit as written on 2026-09-06 and is left unedited, including items the table above has since closed.

---

## 1. Where we are

| Surface | State | One line |
|---|---|---|
| Web — brand product | 🟡 Partial | Brand dashboard loop (create → accept+pay → review → payout) and the metrics dashboard are real and owner-scoped. But there is no brand intake, no self-serve sign-up, the marketplace is allowlist-closed, and brands get no notifications. |
| Web — creator sunset machinery | 🟡 Built, misconfigured | `CREATOR_WEB_MODE` is implemented and tested, `/get-the-app` is live in code. The variable is set in **no** environment and unset means `sunset`, so the next deploy retires creator web. |
| `/api/v1` mobile API | 🟡 Built, two defects | All 15 endpoints exist behind the Bearer guard with tests (161 web tests green). The Clerk proxy turns 401s into redirects/404s, and the rate-limit key is shared across routes. No authorization-matrix test. |
| iOS app | 🟡 Feature-complete-ish, not shippable | Four tabs are real, sign-out/deletion/version-gate/push routing are solid. No Sign in with Apple, no Apple App ID, no EAS project, no production config, Stripe onboarding dead-ends, and the last 3 commits have never run on a simulator. |
| Payments | 🟡 Core correct, edges open | Destination charge + manual capture + idempotent release are right. Creator surfaces disagree on net vs gross, auth holds expire un-handled, and production Stripe keys are empty. |
| Infra & ops | ❌ Missing | Production env is broken (see facts). No durable rate limit, no error tracking/alerts, migrations by hand, CI has never run, Vercel on the Hobby plan (unverified), public repo. |
| Legal & privacy | ❌ Missing | Privacy policy is waitlist-era and contradicts the deletion behaviour; terms lack marketplace clauses; no legal entity or effective date; no in-app legal links. |
| Process & docs | 🟡 Partial | Workstream docs are good but 0/50 acceptance boxes are ticked. README is stale and unsafe (`prisma migrate dev` against the shared prod DB). No runbooks. No branch protection. |

### The five things to know first

1. **Production is six weeks stale and a push is a deploy.** Local `main` is 47 commits ahead of `origin/main`; the checked-out branch `fix/ios-design-audit` adds 3 more (clean fast-forward). Vercel auto-deploys `main`. Everything from the mobile API onward exists only on this laptop. ✔
2. **The production environment is broken today.** In Vercel Production: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `TURNSTILE_SECRET_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY` are **empty strings**; `RESEND_API_KEY` is a 14-character placeholder; UploadThing is set under v6 names (`UPLOADTHING_SECRET`/`APP_ID`) while the installed SDK reads only `UPLOADTHING_TOKEN`. ✔ Consequence on the *live* site: the waitlist form fails closed (Turnstile) and no email has ever sent. (`OPS-02..05`, `PUSH-01`)
3. **Deploying as-is sunsets creator web.** `CREATOR_WEB_MODE` unset ⇒ `sunset` by design (`docs/platform-split/creator-web-freeze.md`), and it is set nowhere. ✔ (`SUN-01`)
4. **The iOS app cannot reach TestFlight yet.** No Apple App ID for `com.creatordocks.app`, no EAS project/`eas.json`, production API URL and Clerk key have no delivery mechanism, Google + TikTok sign-in without Sign in with Apple is a Guideline 4.8 rejection ✔, and push is inert. (`STORE-01..04`, `AUTH-01/07`, `LOOP-02`)
5. **Nobody but Jackson can use the product.** Every money route, upload route and app-account creation is behind `TESTER_ALLOWED_EMAILS` (unset in prod) or `ADMIN_ALLOWED_EMAILS` (Jackson only), and the admin role is refused by creator/brand endpoints. There is no brand or creator test identity anywhere. (`BRAND-02`, `PAY-07`, `PUSH-03`, `LOOP-05`)

Quality gates as of today, all green: web vitest 161, shared 48, mobile jest 374, `tsc` and lint clean in all three workspaces. Real mobile statement coverage is ~48% (the default report overstates it); web money core and brand API routes have zero tests.

---

## 2. Blockers

Ordered by dependency. "Blocks" says which launch stops without it.

| # | Blocks | What | Evidence | Action | Effort | Owner | Depends on | Ids |
|---|---|---|---|---|---|---|---|---|
| **B1** | Web | **Do not push `main` until B2 and B3 are done.** Push = production deploy with a broken env and a sunset flip. | GitHub deployments show env=Production per merge sha; `.vercel/project.json` links `creatordocks`. ✔ | Write `docs/runbooks/deploy.md` (env prerequisites, migrate step, smoke checks, rollback). Push the work to a feature branch first so Vercel builds a protected Preview. | S | A | — | PROC-01, OPS-01 |
| **B2** | Web | **Fix the production environment.** | `vercel env pull` value lengths: Stripe ×3 = 0, Turnstile ×2 = 0, Resend = 14, no `CREATOR_WEB_MODE`, no Upstash/KV, no `MOBILE_*`, no `TESTER_ALLOWED_EMAILS`, no `UPLOADTHING_TOKEN`. ✔ | Jackson supplies: live Stripe keys + a webhook endpoint at `https://www.creatordocks.com/api/webhooks/stripe` subscribed to the six handled events, Turnstile widget keys for `www`+apex, a real Resend key with `creatordocks.com` verified (SPF/DKIM/DMARC), a v7 UploadThing token. Agent sets: `CREATOR_WEB_MODE=full` (prod, preview, dev, `.env.local`), Upstash Redis via Vercel Marketplace (prod + preview), `MOBILE_MIN_SUPPORTED_VERSION=1.0.0`, `MOBILE_LATEST_VERSION=1.0.0`, `MOBILE_MAINTENANCE_MODE=false`, `TESTER_ALLOWED_EMAILS`, remove dead `ADMIN_SECRET_PATH`, `UPLOADTHING_SECRET/APP_ID`. Full table in §6. | M | J + A | Q-A1..A6 | OPS-02, OPS-03, OPS-04, OPS-05, OPS-07, OPS-18, SUN-01, PUSH-01, API-03, SEC-01, SEC-04, API-10 |
| **B3** | Web | **Decide and build the brand access model.** Today every brand CTA lands on the *creator* waitlist form; a new brand who signs in is bounced to `/waitlist`; only admin emails reach `/brand`; `/sign-up` redirects to the waitlist and the invite email links back to `/sign-up` (loop). | `app/page.tsx` CTAs → `/waitlist`; `lib/post-login.ts`; `lib/admin-config.ts` tester gate; `app/(auth)/sign-up`. | Jackson picks (a) invite-led with a brand request form + manual allowlisting, (b) invite-led with a contact link, or (c) open self-serve. Agent then builds the intake, a real brand sign-up page (Clerk `<SignUp>` → `/post-login`), fixes the invite email, and either keeps `requireTesterApiUser` with an "invite-only" message or removes it from brand/money routes. | M–L | J→A | B2 | BRAND-01, BRAND-02, BRAND-03, PAY-07, PUSH-03, LOOP-05, API-09, AUTH-09 |
| **B4** | iOS | **Add Sign in with Apple.** Google + TikTok are offered; Apple is absent. | `mobile/src/components/oauth-buttons.tsx` strategies: `oauth_google`, `oauth_tiktok` only. ✔ | `expo-apple-authentication`, `ios.usesAppleSignIn: true`, native Apple button wired to Clerk's Apple provider; Jackson enables the capability on the App ID and configures Apple in Clerk (Services ID + key). | M | J + A | B5 | STORE-04, AUTH-01 |
| **B5** | iOS | **Stand up the Apple + Expo build path.** No Apple App ID, no Push capability, no EAS project, no `eas.json`, no `app.config.ts`, no production `EXPO_PUBLIC_API_URL`/`EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` (only an untracked `mobile/.env` pointing at localhost + `pk_test`). | `mobile/app.json` (no `extra.eas.projectId`), `mobile/RELEASE-CHECKLIST.md`, `mobile/src/lib/api-client.ts:24`. ✔ | Jackson: Apple Developer Program (Individual vs Organization — Organization needs a DUNS number and a legal entity), register `com.creatordocks.app` with Push, Expo account. Agent: install `eas-cli`, `eas init`, `eas.json` with development/preview/production profiles carrying env per profile, `eas credentials` for APNs, `app.config.ts` with a startup assertion that production builds point at `https://www.creatordocks.com` + `pk_live`. | M | J + A | Q-A7..A9 | STORE-01, STORE-02, STORE-03, STORE-07, AUTH-07, PUSH-10, LOOP-02, DEPS-07 |
| **B6** | iOS | **Creators cannot apply from the app until Stripe onboarding round-trips.** `POST /api/v1/applications` requires `stripeOnboarded`; the only writer is the `account.updated` webhook; mobile onboarding returns to the Clerk-protected web `/creator/settings` inside the in-app browser and never comes back. | `app/api/v1/applications/route.ts:34-40`; `app/api/v1/stripe/onboard/route.ts:36-37`; `app/api/webhooks/stripe/route.ts:212-223`. | Implement W4-1: public `/stripe/return` and `/stripe/refresh` pages (add to `proxy.ts` public list, exempt from sunset) that immediately open `creatordocks://stripe/return|refresh`; v1 onboard emits those URLs; app uses `openAuthSessionAsync` and refetches status on return. Make `GET /api/v1/stripe/status` retrieve the account from Stripe and update `stripeOnboarded` so the app is not webhook-dependent. Confirm which Stripe webhook endpoint (platform vs Connect) sends `account.updated` and support both secrets. | M | A (+ J for the Stripe dashboard check) | B2 | LOOP-01, PAY-03, PAY-04, PAY-05, SUN-02, AUTH-02, STORE-15, PARITY-06, QUAL-11 |
| **B7** | Both | **Three middleware/guard defects on `/api/v1`.** (1) `/api/v1/*` except `/meta` is not in the proxy public list, so a missing/expired Bearer gets a 307 (dev) or HTML 404 (prod), never the guard's JSON 401 — the app's 401 handling can never fire. (2) The rate-limit key has no route component, so a burst of reads locks out `POST /stripe/onboard` and `DELETE /me` (limit 5). (3) UploadThing's server-to-server callback to `/api/v1/uploads` and `/api/uploadthing` is blocked by `auth.protect()`, so `onUploadComplete` never runs when deployed. | `proxy.ts:19-21` ✔; `lib/mobile-api-guard.ts:110`; `node_modules/@clerk/nextjs/.../protect.js`; live `curl` on the dev server → 307. | Add `/api/v1(.*)`, `/api/uploadthing(.*)` to `isPublicRoute` (guards already enforce Bearer and reject cookie-only); add `WWW-Authenticate: Bearer` on 401; include method+route in the rate-limit key; add tests that run a real Request through proxy + guard, and two routes with different limits for one user. | S | A | — | API-01, API-02, API-04, API-11, SEC-03, SEC-05, AUTH-03, PUSH-02, LOOP-04 |
| **B8** | iOS | **Account deletion says one thing and does another.** The app alert promises "permanently deleted"; the server anonymizes the `User` row only, keeps `Device` rows (pushes keep arriving), keeps `stripeAccountId`, has no PROCESSING-payout guard, and returns 200 even when Clerk deletion fails. The privacy policy describes neither. | `mobile/src/app/(app)/profile/index.tsx:79,85` ✔; `app/api/v1/me/route.ts:51-67` ✔. | Jackson signs off the deletion/anonymization matrix (Q-P4). Agent: delete Device rows in the same transaction, decide Stripe account handling, 409 with an actionable message on PENDING/PROCESSING payouts, delete Clerk first and return 502 on failure, handle Clerk `user.deleted` webhook, rewrite the alert copy and the privacy-policy paragraph to match exactly. | M | J→A | Q-P4 | API-07, API-08, LEGAL-02, LEGAL-03, LEGAL-04, LEGAL-05, LEGAL-07, PARITY-04, SEC-09, SEC-10, PAY-12, PUSH-11, LOOP-11 |
| **B9** | Both | **Legal pages are not launchable.** Privacy policy is waitlist-era (no mobile, push tokens, photos, Apple/Google/TikTok sign-in, deletion semantics); terms say fees "may vary" while the site promises 15%, and lack content licence, refunds/disputes, liability, indemnity, governing law, contractor/tax, FTC disclosure; no legal entity, effective date, or minimum age anywhere; the app has no links to privacy/terms/support (Guideline 5.1.1(i)). | `app/privacy/page.tsx`, `app/terms/page.tsx`, `mobile/src/app/(app)/profile/index.tsx` (no legal rows). | Agent drafts both pages from the PII inventory (data element → store → retention → deletion) and a clause-to-code map for counsel; Jackson supplies entity name, state, age floor, and gets attorney review; agent adds three settings rows in the app. | M (draft) + attorney | J + A | Q-L1..L4 | LEGAL-01, LEGAL-08, LEGAL-10, LEGAL-11, LEGAL-12, LEGAL-13, PARITY-03, STORE-10, STORE-11 |
| **B10** | iOS | **App Review has no way in and no story.** Login wall + invite-only gate with no seeded reviewer account; no App Review dossier (money flow, IAP exemption rationale, deletion behaviour, demo credentials, screenshots). | `docs/platform-split/` has no dossier; `TESTER_ALLOWED_EMAILS` unset. | Jackson picks the reviewer email and allows seeding demo data in the production DB (or approves a staging env, see H17); agent writes `docs/platform-split/09-app-review-dossier.md`, a read-only-safe seed script, and the App Store Connect notes. | M | J→A | B2, B5 | STORE-12, STORE-13, PAY-06, PROC-07 |
| **B11** | iOS | **The current app has never been run.** The last 3 commits (56 files, +3820/−186) have no simulator or device run; the only runs were Aug 13–15 on one iOS 26.2 simulator under the old bundle id. There is no error boundary or crash reporter, so any uncaught render error closes a release build. `mobile/ios` is stale prebuild output with template camera/mic/Face ID strings. | Metro logs `mobile/.expo/dev/logs/start.log`; simulator container timestamps; `mobile/ios/CreatorDocks/Info.plist:48-53` ✔. | `xattr -cr mobile/ios && npx expo prebuild --clean`, rebuild the dev client, walk every screen on iPhone SE-class and Pro Max simulators; add an `ErrorBoundary` export in `_layout.tsx` files rendering `ErrorState`; then (H7) add Sentry. | M | A (+ J on a physical iPhone for push/upload) | B5 for device | QUAL-01, QUAL-02, STORE-08 |

---

## 3. High

| # | What | Evidence | Action | Effort | Owner | Ids |
|---|---|---|---|---|---|---|
| H1 | Next.js 16.2.6 carries 9 open advisories (proxy bypass, Server Action DoS/SSRF, cache confusion); fix is a non-major bump. `@clerk/clerk-expo` 2.19.31 is inside an authorization-bypass advisory range. | `npm audit`: fix `next@16.3.4`; GHSA-w24r-5266-9c3c. | `npm i next@16.3.4 eslint-config-next@16.3.4`, bump clerk-expo ≥ 2.20, read `node_modules/next/dist/docs/` release notes for proxy/cache changes, run all gates + `next build`. | S | A | DEPS-01, DEPS-02 |
| H2 | Creator surfaces disagree on money: app Earnings + web payouts + `/api/v1/payouts` show **gross**; payout email + push say **net**. Discover tile labels the whole campaign budget as the creator's "payout". | `mobile/src/app/(app)/earnings/index.tsx:73`; `app/api/v1/payouts/route.ts:74`; `campaign-tile.tsx`. | Add server-computed `netAmount` and `lifetimePaidNetAmount`; render net with a "− fee" line; relabel the tile. (Jackson: net everywhere, or gross + fee line? Q-P2) | S | J→A | PAY-01, LOOP-03, PARITY-09, PAY-16, LOOP-07 |
| H3 | Manual-capture authorization holds expire (~7 days); approving after expiry is a bare 500, and a revision cycle can easily exceed a week. | `lib/payout.ts` capture path; no `payment_intent.canceled` handling. | Jackson decides the money model (keep hold + handle expiry/re-auth, or charge at accept and transfer at approval). Agent implements the chosen path + a test. | M | J→A | PAY-02, LOOP-17, PAY-09 |
| H4 | Brands get no notifications (new application, new submission, charge receipt), and "Approve & Pay" captures the card with no confirmation of amount. | `lib/email.ts` has creator templates only; `SubmissionReview.tsx`. | Brand emails via the existing Resend shell; `receipt_email` on the PaymentIntent; a confirmation step stating amount + creator. | M | A | BRAND-05, BRAND-06 |
| H5 | No error tracking, alerting, uptime checks, structured `/api/v1` request logs, or health endpoint on web; no crash reporting in the app. | W5-H5 unmet; no `sentry` in either `package.json`. | `@sentry/nextjs` + `sentry-expo` (PII scrubbing on; release = commit sha), one JSON log line per v1 request in the guard, an uptime check on `/api/v1/meta` and `/`, alerts to Jackson. Sentry must then appear in the privacy manifest and nutrition labels. | M | J (vendor + recipients) + A | OPS-08, STORE-17, QUAL-01 |
| H6 | Vercel team appears to be on the **Hobby** plan (non-commercial use only, 1-hour log retention, no log drains, daily-only crons). *(auditor claim, not re-verified from the CLI)* | Vercel plan matrix vs `vercel teams ls`. | Upgrade to Pro before taking money; then enable Skew Protection and a log drain. | S | J | OPS-06 |
| H7 | Migrations are applied by hand, `prisma migrate deploy` is nowhere in the pipeline, all three local migrations *are* applied to the shared Neon DB today. No runbooks (deploy, migrate, rollback, incident, secret rotation); the existing rollback playbook assumes OTA + Sentry, neither installed. | `package.json` build script; `npx prisma migrate status` clean. | Build script gated on `VERCEL_ENV=production` → `prisma migrate deploy`; a Neon branch or backup before any migration; `docs/runbooks/*.md`. | M | A | OPS-09, PROC-06 |
| H8 | CI has **never executed** (0 runs — nothing was ever pushed), pins Node 22 while Vercel runs 24 and dev runs 25, never builds, never validates the schema, no coverage gate, no audit; `main` has no branch protection; the repo is **public** with secret scanning, push protection and Dependabot off, and no LICENSE. | `gh api .../branches/main/protection` → 404 ✔; `gh repo view` → PUBLIC ✔; `.github/workflows/ci.yml`. | Pin Node 24 (`engines`, `.nvmrc`, ci.yml); add `next build` (dummy `DATABASE_URL`), `prisma validate`, `npm audit --audit-level=high`, coverage threshold; enable a ruleset on `main` requiring both checks; Jackson decides repo visibility (Q-S3) and turns on secret scanning + Dependabot. | M | J + A | PROC-02, PROC-03, PROC-08, OPS-11, DEPS-05, DEPS-06 |
| H9 | The W2-11 authorization-matrix test does not exist (every v1 route test mocks the guard); `/api/v1/uploads` has no test and no rate limit; the money core (intent, capture, webhook) and every brand API route have zero tests. | `grep -L` across `app/api/v1/**/route.test.ts`; `app/api/v1/uploads/route.ts`. | `tests/api-v1-authz-matrix.test.ts` driving every export as creator A against creator B + no/bad/cookie-only token + brand role + 429; uploads tests; money-core and brand-route tests. | L | A | API-05, API-06, PAY-13, BRAND-11, SEC-18 |
| H10 | Content-URL allow-list accepts files from **any** UploadThing app (`*.ufs.sh`/`*.utfs.io`) with no per-file ownership record (W6-7 unmet); the web `POST /api/submissions` still accepts any URL scheme and the brand page renders it as a raw href (the H-3 fix reached v1 only). Two copies of the allow-list can drift. | `packages/shared/src/content-url.ts` vs `lib/content-url.ts`; `app/api/submissions/route.ts`. | Pin the host to our app id; record uploads (`Upload` model: key, userId, createdAt, attached submission) from `onUploadComplete`; verify ownership on submit; use the shared schema on the web route; single allow-list. | M | A | PUSH-04, PUSH-05, SEC-12, API-13, PUSH-19 |
| H11 | Release mechanics missing: no `expo-updates` (the documented OTA rollback path does not exist), no build-number strategy, Google/TikTok OAuth on the Clerk **production** instance unverified (TikTok Login Kit needs TikTok's review; native redirect allow-list needs `creatordocks://sso-callback`). | `mobile/package.json`; `mobile/app.json` (no `buildNumber`, no `updates`). | `expo-updates` with `runtimeVersion: { policy: 'appVersion' }` + channels per profile; `appVersionSource: remote` + `autoIncrement`; Jackson confirms Clerk prod providers or the TikTok button is feature-flagged off. | M | J + A | STORE-05, STORE-06, STORE-07, AUTH-08 |
| H12 | Public waitlist API returns another person's profile by email and lets anyone overwrite it. | `app/api/waitlist/route.ts`. | Return only `{ existing: true }`; gate edits behind a signed emailed link. | S | A | SEC-02 |
| H13 | Mobile resilience gaps: no screen ever fetches page 2 (Discover filters client-side over the first 20, not virtualized); no Earnings/app-switcher privacy overlay (W3 security item); offline unwired and non-idempotent mutations are retried (duplicate-submission risk); no central 401 handling; no request timeout. | `mobile/src/lib/query-client.ts:14-19,47-62`; `discover/index.tsx:93-104`; `api-client.ts`. | `onEndReached` + server-side niche filter; `AppState` overlay in `(app)/_layout.tsx`; NetInfo → `onlineManager`; retry GETs only; 401 → sign-out/re-auth; 15 s timeout. | M | A | QUAL-03, QUAL-04, QUAL-05, AUTH-04, AUTH-05, AUTH-06, LOOP-08, LOOP-09, LOOP-13 |
| H14 | There is nowhere to run the W8-3 staging loop: one shared Neon DB, Preview lacks DB/Stripe/Resend/UploadThing but carries **live** Clerk keys, no device build, no non-local Stripe test plumbing. Beta and App Review would run against production data. | Vercel env matrix; `.env*` all point at one Neon host. | Neon branch + fully configured Preview (or a second Vercel project) with test-mode Stripe and two webhook endpoints, `CREATOR_WEB_MODE=full`, `TESTER_ALLOWED_EMAILS`, `MOBILE_*`; brand/creator test identities; document them in 08-release-qa-sunset.md. | M | J→A | LOOP-15, OPS-13, STORE-18, LOOP-05 |
| H15 | Docs are stale and one is dangerous: README says "waitlist launch mode", instructs `npx prisma migrate dev` (would drift-reset the shared prod DB), env table misses 11 variables and names `UPLOADTHING_TOKEN` correctly while Vercel holds the wrong names; `mobile/README.md` is the Expo template; CHANGELOG stops 2026-07-04; `docs/vercel-domain-launch.md` says apex-canonical while reality is www. Obsolete branch `fix/waitlist-launch-gating` + `stash@{0}` re-add a schema `main` dropped and conflict in 5 files. | `README.md:12`; `git merge-tree`. | Rewrite README (monorepo, env matrix, safe DB commands), mobile README, CHANGELOG catch-up, fix the launch doc; delete the branch/stash after Jackson confirms the business waitlist is abandoned (Q-P1); delete `page 2.tsx`; decide `prisma/set-role.mjs`. | M | J→A | PROC-04, PROC-05, PROC-09, PROC-10, PROC-15, PROC-16, BRAND-14, BRAND-15, OPS-15, OPS-16 |
| H16 | `/api/v1/meta` force-update and maintenance switches are env-driven and unset everywhere, and every change needs a redeploy; no App Store URL for the gate. | `app/api/v1/meta/route.ts:7-9`. | Set the three `MOBILE_*` values in B2; consider Vercel Edge Config for a genuine no-deploy flip (same for `CREATOR_WEB_MODE`); fill `expo.extra.appStoreUrl` once App Store Connect assigns the id. | S | A | API-10, LOOP-10, SUN-07 |

---

## 4. Medium

**Web / API**
- M1 CSP allows `unsafe-inline` + `unsafe-eval` + any `https:` script — near-zero XSS mitigation. Nonce-based CSP post-launch unless Jackson wants it now. (SEC-06)
- M2 No startup env validation (`lib/env.ts`, W5-H3); misconfiguration fails per-request and mostly silently. Should assert Stripe key mode matches `VERCEL_ENV`. (SEC-07, OPS-19, PAY-18)
- M3 Clerk webhook handles only `user.created`; deletions and email changes at Clerk never reach the DB. (SEC-09, LEGAL-07)
- M4 Stripe and Clerk webhooks have no event-id idempotency; redelivery re-sends payout emails and pushes. (SEC-11, PAY-10)
- M5 Refunds and disputes only alert admins; `Payout` rows stay PAID, no transfer reversal. (PAY-11)
- M6 `getCurrentAppUser` email-based row adoption rebinds any existing `User` (brands included) to whichever Clerk identity presents a matching primary email. (API-16)
- M7 `POST /api/v1/devices` re-points any known push token to the caller (hijack by token value). (SEC-20)
- M8 Payout push puts the dollar amount on the lock screen, contrary to the W6 rule unless Jackson opts in (Q-P6). (PUSH-07, API-19)
- M9 No push receipt checking exists (only synchronous ticket errors prune tokens); Expo sender has no access token (fails if "Enhanced push security" is on). (PUSH-06, PUSH-17)
- M10 W6-8 orphan-media cleanup does not exist and cannot yet (uploads are not recorded); "Replace" orphans the previous file; nothing deletes media on account deletion. (OPS-12, PUSH-12, LEGAL-06)
- M11 Neon direct (non-pooled) endpoint with a 5-connection pool per function instance from a Vercel region in a different AWS region; cold-start P1001 observed. (OPS-14)
- M12 Neon backups / PITR window unverifiable from the repo (Q-A10). (OPS-21)
- M13 Preview environment is both unusable and unsafe (no DB but live Clerk keys). Covered by H14. (OPS-13)
- M14 W7 acceptance gaps: no "CreatorDocks for iOS" banner for creator-web users, no sunset email sequence drafted, no parity checklist artifact, no admin adoption widget (the W8-12 gate metric cannot be read). (SUN-03..06, BRAND-12, BRAND-13)
- M15 Sunset redirect also fires for admin "view as"; no test proves the guard is wired into handlers/layout/proxy; `app/api/uploadthing` is not gated by `CREATOR_WEB_MODE`. (SUN-08, SUN-09, SUN-10)
- M16 Accept flow can strand an authorized payment if Stripe serves a redirect-based payment method (Q-A5). (BRAND-07)
- M17 Web onboarding still offers the Creator role with placeholder copy; no brand/company profile or campaign location despite the "local" positioning; campaign taxonomy mismatches. (BRAND-08, BRAND-09, BRAND-10, SUN-11)
- M18 Deadline drifts by one calendar day between brand entry, brand detail and the app (local `T23:59:59` vs UTC). (LOOP-06)
- M19 `/creator/settings` shows "Connected" from `?onboarded=true` alone. (SUN-14, PAY-14)
- M20 Static PaymentIntent idempotency key makes a replacement intent impossible for 24 h once the stored one is unusable. (PAY-09)

**iOS**
- M21 No edit-profile screen (name/bio; `useUpdateMe` is orphaned) and no avatar upload end to end (no route, no `avatarUrl` in PATCH, no UI). (PARITY-01, PARITY-02)
- M22 No notification preferences (server column, API, toggle). (PARITY-05, PUSH-09)
- M23 Push permission prompt fires on first authenticated launch rather than after a first meaningful action; "denied" is discarded. (PUSH-08)
- M24 Campaign detail never shows "Applied" or "Connect payouts first"; creators find out after writing a pitch. (PARITY-08)
- M25 Transactional emails deep-link to creator-web pages that redirect away under sunset; payout email CTA points at the wrong page. (PARITY-11)
- M26 No forgot-password / second-factor flow in the app; points to the web being sunset. (PARITY-12, AUTH-11)
- M27 Mobile upload is a single photo: no video, no compression, no progress %, while the server accepts 5 images + 1 video and the picker allows video (Q-P7). (PUSH-13, PARITY-14, LOOP-12)
- M28 Sign-out is only the full three-step wipe on the Profile screen; WaitlistGate sign-out and deletion skip steps. (AUTH-10)
- M29 Wave-2 shared components (FormField, StaleDataBanner, SkeletonGroup) are tested but never wired into a screen; real coverage 47.9%; 13/18 route files and 15/19 hooks untested; no E2E (Maestro) and one `testID` in the app. (QUAL-06, QUAL-07, QUAL-08)
- M30 Campaign detail drops loaded content on any refetch failure and cannot tell 404 from a network blip. (QUAL-09)
- M31 VoiceOver gaps on three rows/links and the search field; decorative symbols not hidden. (QUAL-10)
- M32 `PrivacyInfo.xcprivacy` declares no collected data types (the app collects email, name, photos, user content, push tokens) and lives in a regenerated, gitignored directory with no `privacyManifests` block in `app.json`. (STORE-09, LEGAL-17)
- M33 App Store Connect record, listing metadata and screenshots do not exist; plan's screenshot sizes are outdated. (STORE-16)

**Legal / compliance**
- M34 No terms/privacy acceptance at sign-up (mobile custom flow has none; web depends on an unverified Clerk setting). (LEGAL-09)
- M35 Vendor/sub-processor lists incomplete in policy and DPA (Expo push, Turnstile, Resend, Neon, Vercel Analytics); no evidence any vendor DPA was accepted; DPA Annex 3 overstates rate limiting. (LEGAL-14, LEGAL-15)
- M36 Emails have no footer (sender identity/postal address), no unsubscribe or `List-Unsubscribe` for waitlist emails. (LEGAL-16)
- M37 No data-access/export path, no user-rights section, no retention schedule; waitlist rows have no deletion path. (LEGAL-19, LEGAL-20)
- M38 Brand-side payment terms undocumented (charge timing, cancellation/refund on rejection, chargebacks). (LEGAL-25)

**Dependencies / process**
- M39 `effect` < 3.20 under uploadthing (AsyncLocalStorage context loss advisory); transitive high/moderate advisories with non-breaking fixes; `node_modules` drifted from the lockfile (5 extraneous). (DEPS-03, DEPS-04, DEPS-10)
- M40 Two React copies (root 19.2.4, mobile 19.2.3) — works only because jest/metro pin paths; EAS build image unpinned. (DEPS-07, DEPS-08)
- M41 `/api/v1` versioning policy is one sentence; no mobile release process doc; no alerting/on-call or support process; `support@creatordocks.com` advertised with no stated owner. (PROC-12, PROC-13, PROC-14)
- M42 `docs/platform-split` acceptance criteria 0/50 checked and several statements contradict the code. (PROC-11)

---

## 5. Low

Web/API: `/api/stripe/onboard` leaks raw error text on 500 (SEC-08) · Turnstile siteverify hostname/action unchecked (SEC-13) · per-IP keys trust first `x-forwarded-for` (SEC-14) · email helper logs recipients when Resend unset (SEC-15) · `set-role.mjs` can flip any account to ADMIN and skips its allowlist when env is empty (SEC-16) · HSTS without `includeSubDomains`/preload, no CAA (SEC-17, OPS-15) · view-as gates on DB role only (SEC-21) · rate limit runs after Clerk + DB work (API-15) · `GET /campaigns/:id` skips the deadline filter (API-17) · check-then-create race on apply → 500 (API-18) · fallback rate limiter fails open silently (API-20) · dead `/api/stripe/release-payout` (PAY-17, LOOP-18) · `stripeTransferId` holds a Charge id; PENDING never produced (PAY-15) · no robots/sitemap/manifest/touch icons (BRAND-16, OPS-21) · waitlist OG image/title mismatch (BRAND-17) · creator-centric copy leftovers (BRAND-18) · always-ACTIVE campaigns, edit can't change budget/deadline (BRAND-19, LOOP-16) · analytics tracks only waitlist events (BRAND-20) · no focus-visible/reduced-motion, raw `<img>` (BRAND-21) · gate ordering 403-before-auth (SUN-15) · stale freeze-doc lines (SUN-13) · `ADMIN_SECRET_PATH` and project name `coreloop` stale (OPS-16) · pushes awaited inline in brand handlers and the Stripe webhook (PUSH-15) · accepted/rejected pushes link to the list, not the detail (PUSH-16) · sign-out only unregisters a token minted this process (PUSH-18) · no tap-routing hook test (PUSH-20) · brand web shows mobile content as a bare link (PUSH-14).

iOS: unused native modules linked (`@expo/ui`, `expo-glass-effect`) + web-only deps (QUAL-12, DEPS-12) · jest leaking timers from two mutation-hook tests (QUAL-13) · fixed-height search box vs Dynamic Type (QUAL-14) · 23 unguarded haptics calls (QUAL-15) · 5 hard-coded `#ffffff` (QUAL-16) · template leftovers: `reset-project.js`, template README (QUAL-17, DEPS-17) · typed routes not enforced in CI (QUAL-19) · splash auto-hides into a blank frame; deletion success path unawaited (QUAL-20) · Earnings rows omit campaign/brand (LOOP-14) · dashboard stats/role-switch/privacy overlay "missing" vs "descoped" needs a written reason (PARITY-13..16).

Deps/process: `expo-router` in root devDependencies as a hoisting hack (DEPS-09) · two packages above SDK 57 bundled ranges (DEPS-11) · TypeScript split 5.9 vs 6.0 (DEPS-13) · Prisma CLI transitive advisories (DEPS-14) · tooling majors behind (DEPS-15) · deprecated `react-test-renderer` type (DEPS-16) · no project guardrails in AGENTS.md/CLAUDE.md (PROC-17) · non-conventional/WIP commits on main, no PR template (PROC-18) · iCloud `* 2` duplicates (PROC-19).

---

## 6. Sequenced plan

Gates are go/no-go. Items in the same step can run in parallel.

### Phase 0 — Make the repo and production safe (no user-visible launch)
0.1 Answer the §7 **Accounts & access** and **Sequencing** questions (J).
0.2 Runbooks first: `docs/runbooks/deploy.md`, `migrate.md`, `rollback.md`, `secrets.md` (A) — **B1, H7**.
0.3 Repo hygiene in parallel (A): branch ruleset + CI fixes + Node pin (H8), README/docs rewrite (H15), delete `page 2.tsx`, decide `set-role.mjs`, drop the obsolete branch/stash once confirmed (Q-P1), Next + clerk-expo bumps (H1).
0.4 Fix production env exactly per the table below (J supplies keys, A applies) — **B2**. Then one manual waitlist submit on the live site to confirm Turnstile + Resend work.
0.5 Push the work as a **feature branch** → Vercel Preview → smoke test `/`, `/get-the-app`, `/api/v1/meta`, `/sign-in`. **Gate 0:** preview green, env table complete, `CREATOR_WEB_MODE=full` confirmed in Production.
0.6 Merge to `main` → production deploy (H7 migrate step is a no-op today; all migrations applied). Verify the same URLs live, watch logs.

### Phase 1 — Web brand launch
1.1 Decide brand access model (Q-P2) → build intake, sign-up, invite email, gate handling — **B3**.
1.2 `/api/v1` middleware/rate-limit/uploads-callback fixes + tests — **B7** (ships with web because it lives in `proxy.ts`).
1.3 Money edges: net/gross (H2), hold expiry model (H3), brand notifications + pay confirmation (H4), webhook idempotency (M4), env validation (M2).
1.4 Observability on web (H5) + Vercel Pro (H6) + Upstash confirmed live (part of B2).
1.5 Legal drafts to counsel (B9) — start now, it is the long pole.
1.6 Tests: authz matrix, uploads, money core, brand routes (H9); content-URL ownership (H10); waitlist disclosure (H12).
**Gate 1:** a brand can sign up (or be invited), create a campaign, and pay a test creator on Preview with test-mode Stripe; legal pages approved; alerts firing to Jackson; CI green on `main`.

### Phase 2 — iOS TestFlight (internal)
2.1 Apple + Expo accounts, App ID with Push, `eas init`, `eas.json`, `app.config.ts`, APNs credentials — **B5**.
2.2 Sign in with Apple — **B4**; Clerk prod providers verified (H11).
2.3 Stripe onboarding round-trip + on-demand status refresh — **B6**.
2.4 Deletion alignment — **B8**; in-app legal links (part of B9).
2.5 Prebuild clean, full simulator walk on SE-class + Pro Max, error boundary, Sentry in the app — **B11, H5**.
2.6 Resilience pass (H13), profile edit/avatar (M21), notification prefs decision (M22), prompt timing (M23), privacy manifest + nutrition labels (M32), `expo-updates` + build numbers (H11).
2.7 Staging environment + test identities (H14); **run W8-3 twice (happy + resubmit) and the W8-4 drills on a physical iPhone; record evidence in 08-release-qa-sunset.md.**
**Gate 2:** full loop passes end to end including a real push and a real upload; crash-free on both simulators; parity checklist (W8-1) written with a reason for every descoped item.

### Phase 3 — App Store
3.1 App Review pack: demo account seeded, dossier, notes, screenshots, listing, age rating, privacy labels — **B10, M33**.
3.2 External TestFlight with 10–20 waitlist creators against staging (or a documented decision to use prod) — W8-5/6.
3.3 Submit; respond to payment questions with the dossier before changing code (W8-9).
3.4 On approval: set `NEXT_PUBLIC_IOS_APP_URL`/`NEXT_PUBLIC_IOS_APP_ID` + `expo.extra.appStoreUrl`, redeploy web, flip `/get-the-app` to download, send email #1.
**Gate 3:** approved and live; 2-week watch (crash-free ≥ 99.5%, `/api/v1` 4xx/5xx, adoption widget — M14 must exist first).

### Phase 4 — Creator-web sunset (evidence-gated, unchanged from W8-12/13)
`full` → `readonly` (2–4 weeks, email #2) → `sunset` (email #3). Needs M14 (banner, emails, adoption widget) and the Stripe return pages from B6 before the `/creator/settings` exemption can go.

### Launch-day environment table

| Variable | Production | Preview | Notes |
|---|---|---|---|
| `DATABASE_URL` | set (Neon) | **missing** → needs a Neon branch (H14) | Never point Preview at prod. |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` | live ✔ | **live** (should be dev/test) | Fix Preview. |
| `CLERK_WEBHOOK_SECRET` | set | set | Same shape as the dev secret — one endpoint is likely misconfigured (verify in Clerk). |
| `NEXT_PUBLIC_CLERK_*_URL` (4) | set | set | `AFTER_SIGN_IN=/onboarding`; consider `/post-login`. |
| `STRIPE_SECRET_KEY` | **empty** | missing | Live key (prod), test key (preview). |
| `STRIPE_WEBHOOK_SECRET` | **empty** | missing | Per endpoint; add a Connect endpoint secret if needed (B6). |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | **empty** | missing | |
| `TURNSTILE_SECRET_KEY` / `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | **empty** | empty | Create the widget for `www` + apex (+ preview hosts). |
| `RESEND_API_KEY` | **placeholder** | missing | Verify `creatordocks.com` domain first. |
| `EMAIL_FROM_ADDRESS` | unset (default ok) | — | |
| `UPLOADTHING_TOKEN` | **missing** (v6 names present) | missing | v7 token; remove `UPLOADTHING_SECRET`/`APP_ID`. |
| `CREATOR_WEB_MODE` | **missing → sunset** | missing | `full` everywhere until Phase 4. |
| `UPSTASH_REDIS_REST_URL/TOKEN` or `KV_REST_API_URL/TOKEN` | **missing** | missing | Vercel Marketplace Upstash, both envs. |
| `MOBILE_MIN_SUPPORTED_VERSION` / `MOBILE_LATEST_VERSION` / `MOBILE_MAINTENANCE_MODE` | **missing** | missing | `1.0.0` / `1.0.0` / `false`. |
| `TESTER_ALLOWED_EMAILS` | **missing** | missing | Brand/creator testers, App Review account. |
| `ADMIN_ALLOWED_EMAILS` | set | missing | |
| `NEXT_PUBLIC_URL` | `https://www.creatordocks.com` ✔ | set (points at prod!) | Preview should use `VERCEL_URL` fallback. |
| `NEXT_PUBLIC_IOS_APP_URL` / `NEXT_PUBLIC_IOS_APP_ID` | unset (correct until approval) | — | Build-time; redeploy on set. |
| `DATABASE_POOL_MAX` | unset | — | Consider Neon pooled endpoint (M11). |
| `ADMIN_SECRET_PATH` | set, **dead** | — | Remove. |
| Mobile: `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` | no mechanism | — | Via `eas.json` profiles (B5). |

---

## 7. Questions for Jackson

Nothing below was guessed; the plan changes depending on the answer.

### A. Accounts & access
- **Q-A1 Stripe.** Is there an activated **live** Stripe account with the Connect platform profile approved (business verification, branding, Express ToS)? Which account do the empty Vercel values belong to? How are webhook endpoints configured — one for platform events, one for connected-account events, or both at `/api/webhooks/stripe`? Has any real test-mode key ever been used (local values are placeholders too)?
- **Q-A2 Resend.** Is `creatordocks.com` verified in Resend (SPF/DKIM) and does a real API key exist? Keep `notifications@creatordocks.com` as the sender?
- **Q-A3 UploadThing.** Which app is production, has a v7 token ever been generated, and did uploads ever work on the deployed site? Should uploads work on Preview too?
- **Q-A4 Turnstile.** Was a widget ever created for `www.creatordocks.com`? (The Vercel values were created 99 days ago as empty strings.)
- **Q-A5 Clerk production instance.** Are Google and TikTok configured with your own credentials for web **and** the native app (Native API on, `creatordocks://sso-callback` allow-listed, TikTok Login Kit approved)? Is sign-up allowed from `/sign-in`? Is "require legal consent" on? Which payment methods are enabled in Stripe (card only, or redirect methods like Affirm/Klarna)?
- **Q-A6 Upstash / Vercel plan.** OK to provision Upstash via the Marketplace and move the team to Vercel Pro before launch?
- **Q-A7 Apple.** Enrolled in the Apple Developer Program? Individual (seller shows a personal name) or Organization (needs a DUNS number and a legal entity)? Team ID? Willing to add Sign in with Apple, or would you rather remove Google/TikTok from the app?
- **Q-A8 Expo.** Do you have an expo.dev account, which account/org should own the EAS project, and is a paid EAS plan acceptable if the free queue is slow? Which Xcode image should production builds pin?
- **Q-A9 Physical device.** Do you have an iPhone for the push and upload hops of the full-loop test?
- **Q-A10 Neon.** Which plan, what PITR/history-retention window, is the `main` branch protected, is the Neon–Vercel integration installed, and which region is the DB in?
- **Q-A11 Alerts.** Who receives alerts (email/Slack/SMS) and which vendor (Sentry + an uptime tool suggested)? Who owns `support@creatordocks.com` and dispute alerts, with what response target?

### B. Product decisions
- **Q-P1 Brand intake model for launch:** (a) invite-led with a brand request-access form, (b) invite-led with a contact link and manual allowlisting, or (c) open self-serve sign-up? Should `TESTER_ALLOWED_EMAILS` stay the gate after the brand-first deploy, and is a redeploy per new brand acceptable for the first cohort? Is the parked business-waitlist branch/stash permanently abandoned (may it be deleted)? Is a creator waitlist at `/waitlist` still wanted now that `/get-the-app` is the creator funnel?
- **Q-P2 Money presentation.** Should creators see **net** of the 15% fee everywhere (current Stripe math), or should brands be charged rate + fee so "brands pay the platform fee" is literally true? Net vs gross + fee line on Earnings?
- **Q-P3 Money model.** Keep the manual-capture hold (expires ~7 days; revision cycles can exceed it) or charge at accept and transfer at approval?
- **Q-P4 Account deletion matrix.** With PENDING/PROCESSING payouts or ACCEPTED applications holding an authorization: block, defer, or allow-and-anonymize (current)? Delete/deauthorize the Stripe Express account? Delete uploaded media or keep it with the anonymized submission rows for the brand's records? Approve the copy change from "permanently deleted" to "account closed; campaign and payout records kept anonymized".
- **Q-P5 iOS launch gating.** Invite-only (allowlist maintained in Vercel, NOT_INVITED sign-ups written to the waitlist so "we'll email you" is real) or open? If open, the NOT_INVITED gate and the upload allowlist come out together.
- **Q-P6 Push content.** Do you explicitly opt in to the dollar amount in the "You got paid" push (lock screen + Expo relay)?
- **Q-P7 Mobile v1 scope.** Video submissions and camera capture in v1, or photo-only? Edit-profile/avatar in v1? Notification preferences server-side now, or "use iOS Settings" until v1.1? Password reset / MFA in-app, or defer to web? iPhone-only? Keep `@expo/ui` + `expo-glass-effect` for a planned iOS 26 Liquid Glass pass, or drop them? Dashboard stats and role switching intentionally web-only (needs a written reason in the parity checklist)?
- **Q-P8 Deadlines.** Does a campaign deadline mean end of the brand's local day or a UTC instant?
- **Q-P9 Multiple submissions per accepted application** are allowed by schema and API — intended?
- **Q-P10 After a creator deletes their account,** may a brand still accept and fund their pending applications?
- **Q-P11 Staging.** Neon branch + fully configured Preview, or a second Vercel project? Should external TestFlight and App Review run against production data with live Stripe, test-mode Stripe, or staging?
- **Q-P12 Mobile Stripe return:** web bridge pages that open `creatordocks://stripe/return`, or Universal Links (needs the Apple Team ID, an AASA file on the canonical host, and the www-vs-apex decision)?

### C. Legal & business
- **Q-L1** Does a legal entity exist for CreatorDocks? Exact name, state, mailing address.
- **Q-L2** Minimum age (18+ only? Stripe Express requires 18+ in the US). Governing law / venue state. US-only or EU/UK in scope?
- **Q-L3** Is an attorney engaged or budgeted to review terms, privacy policy and the DPA before launch?
- **Q-L4** Have you accepted the DPA/terms in each vendor dashboard (Stripe, Clerk, Resend, UploadThing, Vercel, Neon, Expo, Cloudflare)? Retention decisions: anonymized financial records, waitlist rows, submission media after a campaign, inactive push tokens?
- **Q-L5** Should the GitHub repo `Beachbroski/CoreLoop` be public? (It is, with no LICENSE; internal plans and the DPA draft are world-readable.)

### D. Sequencing & scope
- **Q-S1** Web brand-first deploy **before** the first TestFlight build (ships `/api/v1` to prod), or an internal-only TestFlight against a tunnelled local API first?
- **Q-S2** At the first brand-first deploy, `CREATOR_WEB_MODE=full` (master-plan intent) — confirm. Keep it as a Vercel env var (each flip = redeploy) or move to Edge Config for a true no-deploy flip? Should admin "view as" be exempt from the sunset redirect?
- **Q-S3** Sentry (web + `sentry-expo`) and `expo-updates` (OTA): adopt before launch, or amend W5-H5 and the rollback playbook to drop them?
- **Q-S4** Which Node major is canonical — 24 (Vercel) or 22 (CI)? The plan assumes 24.
- **Q-S5** Is a CHANGELOG still the record you want, or tagged GitHub Releases from conventional commits?
- **Q-S6** Were the Aug 20–21 mobile commits ever run on a simulator before being committed? (Evidence says no; confirming avoids a wasted retest.)

---

## 8. Verified OK — do not redo

- Web quality gates: 161 web + 48 shared tests, `tsc`, lint green; mobile 374 tests, `tsc`, `expo lint` green. ✔
- All three Prisma migrations are applied to the shared Neon DB; schema validates; production auto-deploys from GitHub `main` (pipeline itself is healthy).
- Clerk production keys are live-mode; secrets have never been committed; live security headers match `next.config.ts` plus Vercel HSTS; DNS points at Vercel for apex and www; Preview deployments are protected by Vercel Authentication.
- `/api/v1`: Bearer-only guard rejects cookie-only requests; object-level authorization returns 404 and lists are caller-scoped; no `clerkId`/`stripeAccountId`/transfer ids in any response; Zod bounds on every body/query; pagination capped server-side; state changes only via POST/PATCH/DELETE; generic client errors, no token or PII in logs; 429s carry `Retry-After`; `/onboarding` is closed-by-default in prod with a machine-readable `NOT_INVITED`; feed and apply share the deadline boundary; submission state machine and resubmit reset are correct; endpoint list matches `02-mobile-api.md` 1:1.
- Payments: destination charge with integer cents, manual capture, `application_fee_amount`; stored intents re-validated before reuse; double-release protection with idempotency keys; PROCESSING→PAID/FAILED transitions; webhook verifies the raw body and is idempotent for payouts; payout email and push quote **net** with the gross − fee arithmetic (691ece4); rejecting cancels the hold, cancelling a campaign cancels all holds; dispute/refund ops alerts wired; no purchase UI anywhere in the app (W4 AC-4 pass); Stripe secret never in the mobile workspace.
- Web brand product: landing page is brand-first with the 15% claim matching code; brand loop create/edit/cancel/review/approve/payout is owner-scoped; metrics dashboard is pure and unit-tested; admin read-only view-as enforced on every brand page; custom 404; Vercel Analytics mounted; post-login routing is a single source of truth; waitlist form is Turnstile + origin + size + rate + Zod protected.
- Sunset machinery: `lib/creator-web-mode.ts` parse/guard/redirect fully unit-tested; `proxy.ts` forwards an un-spoofable `x-pathname`; both creator mutation handlers are gated before DB access; `/get-the-app` + OG image public with waitlist CTA until the App Store URL exists; `account.updated` keeps `stripeOnboarded` authoritative; current prod cannot harm a real creator because it is tester-gated.
- iOS: bundle id is the real one; icon 1024 RGB no-alpha; splash light/dark; only the photo-library permission is requested at the plugin level; export compliance declared; tokens in Keychain only (no AsyncStorage in app or in `@clerk/clerk-expo`); sign-out is a full wipe in the right order; deletion UI exists with double confirmation; VersionGate fails open offline and validates the App Store URL; push tap deep links validated (in-app absolute paths only); registration handles simulator/no-project/denied; zero calls to legacy `/api/*` (all 19 paths are `/api/v1`); every v1 endpoint except `PATCH /me` has a consumer; upload route is Bearer-only, CREATOR-only, mirrors web limits; WCAG AA contrast enforced by a test; Dynamic Type policy centralised; Reduce Motion respected; all five `console.*` sites `__DEV__`-guarded; min iOS 16.4 consistent and iOS-26-only APIs runtime-gated; ATS default-strict.
- Push: token re-association across accounts; ownership-checked unregister; tokens never in responses; sender is best-effort and prunes `DeviceNotRegistered`; all six status triggers wired.
- Legal: `/privacy`, `/terms`, `/support` live and public with a working mailto; templates HTML-escape user values; Vercel Analytics is cookieless; fonts self-hosted; DPA draft honestly labelled.
- Deps: 0 critical advisories; mobile set matches Expo SDK 57 for 28/30 packages; RN 0.86 / Reanimated 4.5 / Worklets 0.10 / React 19.2.3 compatible; single root lockfile; Prisma 7 adapter setup aligned; Stripe SDK deliberately exact-pinned; `@expo/ui`/`expo-glass-effect` are first-party Expo code.
- Process: env files never committed; `fix/ios-design-audit` is a clean fast-forward of `main`; `creator-web-freeze.md` and `RELEASE-CHECKLIST.md` are accurate; PR history #1–#6 is descriptive.

---

## 9. Guess list

What was unclear or had to be inferred (per `CLAUDE.md`):

- **The adversarial verification pass did not run** (usage limits, twice). Blockers marked ✔ were re-checked directly; every other item is the auditor's own evidence, unchallenged. Expect a few severity ratings to move once someone pushes back.
- Vercel **Hobby plan** (H6) is an auditor inference from the plan matrix; the CLI does not print the plan. Verify in the dashboard.
- Empty Stripe/Turnstile values were read via `vercel env pull` and treated as genuinely empty rather than "Sensitive" variables the CLI cannot decrypt (the CLI labels every row "Encrypted", not "Sensitive").
- Clerk's production behaviour on `/api/v1` without a token (HTML 404 rewrite vs the 307 observed locally) comes from reading `@clerk/nextjs` source, not a live prod request (prod has no `/api/v1` yet).
- Whether UploadThing's hosted ingest fails the client upload when our callback returns 404 could not be determined from source; no real upload was run anywhere (no token exists).
- Stripe's ~7-day authorization window (H3) and Apple's enforcement of Guideline 4.8 / 5.1.1 wording are from documentation memory; both are consistent practice but re-check before relying on them.
- The live waitlist form failing with 503 is inferred from the deployed code path plus the empty Turnstile values; no POST was made against production. One manual submit settles it.
- Which Clerk instance's webhook secret is wrong (prod and dev secrets share prefix+length) is unknown.
- "Never run since Aug 15" is inferred from Metro logs, simulator container timestamps and DerivedData; a run from another checkout or machine would not show.
- Auditors did not run the app, a Stripe test flow, a push, or a device build. Everything mobile is static reading plus the test suites.
- Vercel picking up env changes only on the next deployment is assumed from Vercel docs, not tested on this project.
- The `stash@{0}` was compared to branch `c3f6b48` by `--stat`, not line by line.
