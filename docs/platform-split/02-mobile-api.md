# W2 — Mobile API (`/api/v1/*` on the existing Next.js backend)

**Goal:** A versioned, token-authenticated, creator-scoped API namespace consumed by the iOS app. Additive only — existing `/api/*` routes are untouched and continue to serve the web app.

## Architecture decisions

1. **Namespace:** `app/api/v1/…` route handlers. `v1` is frozen once the app ships; breaking changes go to `v2`. Additive changes (new optional fields) are allowed in `v1`.
2. **Auth: Clerk session JWT as Bearer token.** The Expo app uses `@clerk/clerk-expo`; every request sends `Authorization: Bearer <session token>`. Server verifies with Clerk's `auth()` (which reads Bearer tokens natively) — then resolves the DB user via the existing `getCurrentAppUser()` logic, refactored so both cookie (web) and token (mobile) paths share it.
3. **CSRF posture:** origin-check CSRF (`lib/request-security.ts#isTrustedOrigin`) exists because web auth is cookie-based. Bearer-token requests are not CSRF-able (no ambient credential), so `/api/v1/*` **skips origin checks but strictly requires a valid Bearer token** — never both-optional. A request with a session cookie but no Bearer token is rejected on `/api/v1/*` (prevents cookie-based CSRF sneaking into the mobile namespace).
4. **Creator-scoped by default:** `/api/v1` serves the creator app. Every handler starts from the authenticated creator's DB id; no endpoint accepts a `userId`/`creatorId` from the client. Brand/admin functionality stays on web-only routes.

## Middleware/guard: `lib/mobile-api-guard.ts`

Single wrapper used by every v1 handler, in order:
1. Rate limit (durable store — W5-H1 is a prerequisite) keyed by user id when authenticated, IP before auth.
2. Verify Clerk Bearer token → `getCurrentAppUser()` → reject 401 if no DB user.
3. Role check: creator endpoints require `role === CREATOR` (admins may pass where explicitly noted for support; brands never).
4. Zod-validate params/query/body with `@creatordocks/shared` schemas → 400 with envelope error on failure.
5. Handler runs; response validated/shaped with the shared response schema (allow-list — this is the data-leak guardrail).
6. Errors → generic envelope message + full server-side log (route, userId, error) — never leak internals.

## Endpoints

### Auth & account
- `POST /api/v1/onboarding` — **idempotent get-or-create for the signed-in Clerk identity.** Uses the `withMobileAuthOnly` guard (verified Bearer token, but no DB user required) because it is the one route that must run *before* a `User` row exists. Without it a creator who signs up only in the app has a Clerk identity and no row, so every other v1 route 401s forever with no way to recover — rows were previously only ever created by web onboarding (`/api/users/role`), which mobile cannot call (it enforces an origin check and doesn't speak the v1 envelope). Creates with `role: CREATOR` (the app is the creator surface) and never rewrites an existing role. Gated by the tester allowlist while in waitlist mode; returns a machine-readable `NOT_INVITED` 403 so the app can show a waitlist screen rather than a generic failure. Response is the `GET /api/v1/me` shape.
- `GET /api/v1/me` — profile (id, name, email, avatarUrl, bio, role, stripeOnboarded). No clerkId, no stripeAccountId (raw acct id never goes to mobile).
- `PATCH /api/v1/me` — update name/bio/avatar. Zod length limits; sanitize as plain text.
- `DELETE /api/v1/me` — **Apple guideline 5.1.1(v) requires in-app account deletion.** Design deliberately: reject or defer if PROCESSING payouts exist (return actionable message); anonymize User rows referenced by Payout/Submission (financial audit trail) rather than hard-delete; delete Clerk user via backend API; revoke sessions; cascade per legal/DPA requirements. Document exactly what is deleted vs anonymized — App Review and the privacy policy must agree.

### Campaigns (discovery)
- `GET /api/v1/campaigns` — ACTIVE campaigns only, never DRAFT/CANCELLED. Paginated (cursor, default 20, max 50). Filters: niche, platform. Response excludes brand-internal fields.
- `GET /api/v1/campaigns/:id` — ACTIVE only (404 otherwise, including for existing-but-inactive ids — don't leak campaign existence).

### Applications
- `POST /api/v1/applications` — body: campaignId, pitch, proposedRate. Server enforces: campaign ACTIVE, no duplicate (unique constraint exists — surface as friendly 409), pitch length limits, proposedRate positive int within sane bounds. Rate limit stricter than reads (spam vector).
- `GET /api/v1/applications` — own applications, paginated, joined with campaign summary.
- `GET /api/v1/applications/:id` — own only: fetch → compare `creatorId` to authed user → 404 (not 403) on mismatch.
- `DELETE /api/v1/applications/:id` — withdraw, own + PENDING only.

### Submissions
- `POST /api/v1/submissions` — for own ACCEPTED application. Content URL/media reference validation per W6 (only accept media ids/URLs from our own UploadThing app, not arbitrary URLs).
- `GET /api/v1/submissions` / `GET /api/v1/submissions/:id` — own only; includes review status + note.
- `PATCH /api/v1/submissions/:id` — resubmit after REJECTED, own only, status-machine enforced server-side.

### Payouts & Stripe (details in W4)
- `GET /api/v1/payouts` — own payouts: amount, platformFee, status, createdAt. Stripe transfer id only if support debugging needs it — prefer internal payout id.
- `POST /api/v1/stripe/onboard` — returns Stripe Connect onboarding link (reuses `lib/payout.ts` / existing onboard logic).
- `GET /api/v1/stripe/status` — `{ onboarded: boolean }` refresh after onboarding return.

### Devices & notifications (details in W6)
- `POST /api/v1/devices` — register Expo push token; `DELETE /api/v1/devices/:token` — unregister (sign-out flow).

### Meta
- `GET /api/v1/meta` — **unauthenticated but rate-limited**: `{ minSupportedAppVersion, latestAppVersion, apiVersion, maintenanceMode }`. The app checks on launch → force-update screen when below min. This is the escape hatch for shipping breaking changes despite slow App Store review.

## Tasks

- **W2-1:** Refactor `getCurrentAppUser()` so cookie and Bearer paths share DB-resolution logic; add `lib/mobile-api-guard.ts`. Tests: valid token, expired token, no token, cookie-only-on-v1 rejected, wrong role.
- **W2-2:** CSRF/origin policy per decision 3 (tests included).
- **W2-3:** `/api/v1/me` GET/PATCH + shared schemas (W1-4 pattern established here).
- **W2-4:** Campaigns discovery endpoints + pagination helper (reused by all list endpoints).
- **W2-5:** Applications CRUD.
- **W2-6:** Submissions CRUD + status machine.
- **W2-7:** Payouts read + Stripe onboard/status (with W4).
- **W2-8:** Devices endpoints (with W6).
- **W2-9:** `/api/v1/meta` + versioning policy written into this doc.
- **W2-10:** Account deletion (design sign-off from Jackson first — deletion/anonymization matrix in the PR description).
- **W2-11:** Integration test suite for the full namespace: auth matrix, object-level authorization (creator A cannot read creator B's application/submission/payout — **every** endpoint), validation failures, rate-limit 429s.

## Security requirements (merge gate, from W5)

- Every endpoint: authenticated (except `/meta`), role-checked, object-level ownership-checked, Zod-validated, rate-limited, allow-list response.
- 404 (not 403) for resources that exist but aren't yours.
- No secrets/keys/internal ids (clerkId, stripeAccountId) in any v1 response.
- Pagination caps enforced server-side (max 50) regardless of client input.
- All state-changing endpoints are POST/PATCH/DELETE — never GET.

## Acceptance criteria

- [ ] Full endpoint list live behind `mobile-api-guard`, tests green, coverage ≥80% on new code.
- [ ] Authorization matrix test (W2-11) passes — this is the single most important test in the workstream.
- [ ] Existing web `/api/*` routes byte-for-byte untouched.
- [ ] `/api/v1/meta` returns config from env/Edge Config, not hardcoded values.
- [ ] Account deletion flow documented + approved before implementation.
