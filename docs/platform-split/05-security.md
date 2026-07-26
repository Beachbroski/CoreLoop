# W5 — Security (cross-cutting gate + hardening tasks)

**Role of this doc:** Part checklist (applied to every PR in every workstream — reviewers verify it), part workstream (hardening tasks H1–H6 with owners and ordering). Nothing ships to TestFlight/App Store until the checklist and all H-tasks are green.

## A. Hardening tasks (do these; H1–H2 before any public v1 endpoint)

- **H1 — Durable rate limiting (prerequisite for W2).** `lib/request-security.ts` uses an in-memory Map — on Vercel serverless each instance has its own map, so limits are effectively decorative under load and reset constantly. Replace with a durable store (Upstash Redis via Vercel Marketplace, or Vercel Runtime Cache if semantics suffice — evaluate: rate limiting needs atomic increment + TTL; Redis `INCR`/`EXPIRE` is the safe default). Keep the same helper API so existing web routes get the fix for free. Per-route configs: reads 60/min/user, writes 10/min/user, auth-adjacent + `/meta` per-IP.
- **H2 — Mobile auth path review (with W2-1/W2-2).** Threat-model the Bearer path: token lifetime/refresh via Clerk defaults (short-lived session JWTs — verify expiry config), replay window acceptable, cookie-auth explicitly rejected on `/api/v1/*`, `WWW-Authenticate` on 401s, no token material ever logged.
- **H3 — Secrets audit.** Verify every secret (Stripe, Clerk, Resend, UploadThing, DB, Turnstile) lives only in env (Vercel envs + local `.env*` gitignored — confirm `.gitignore` covers `.env.production.local`). Startup validation (fail fast on missing secrets) per house rules — add a `lib/env.ts` Zod-validated env module if absent. EAS: mobile build profiles contain **only** publishable values.
- **H4 — Dependency & supply chain.** Enable Dependabot (or `npm audit` in CI with failure threshold) for root + mobile workspaces. Pin EAS build image. Review every new mobile dependency (RN ecosystem has a long tail of abandoned packages) — prefer Expo-maintained modules.
- **H5 — Logging & monitoring.** Server: structured logs on every v1 request (route, userId, status, latency — no bodies, no tokens); alert on 401/403/429 spikes (early signal of probing). Mobile: crash + error reporting (Sentry `sentry-expo`) with PII scrubbing on; runtime schema-validation failures (W3-4) reported as first-class errors.
- **H6 — Pre-launch security review.** Before App Store submission: run the security-reviewer agent over the mobile API + app; fix CRITICAL/HIGH; document accepted MEDIUM/LOW. Re-run the authorization matrix test (W2-11) against a production-like environment.

## B. Per-PR checklist (copy into every workstream PR description)

**Every API endpoint:**
- [ ] Authentication enforced (or explicitly documented as public + rate-limited, e.g. `/meta`)
- [ ] Role check (creator-only unless documented)
- [ ] **Object-level authorization** — resource ownership verified against authed user; cross-user access returns 404
- [ ] Input Zod-validated (body, params, query) with length/range bounds
- [ ] Response is an allow-list shape from `@creatordocks/shared` — no spreading DB rows
- [ ] Rate limited via H1 helper
- [ ] Errors: generic client message, detailed server log
- [ ] State changes only via POST/PATCH/DELETE

**Every mobile change:**
- [ ] No secrets/keys/URLs-with-tokens in code, config, or bundle
- [ ] Sensitive data only in SecureStore; nothing sensitive in AsyncStorage, logs, or crash reports
- [ ] New deps reviewed (maintenance, popularity, native code provenance)
- [ ] Deep links validate their params (a `creatordocks://` link can be crafted by any app/website — treat params as untrusted input; navigation only, never state-mutating side effects from a deep link)

**Every web change (W7):**
- [ ] Existing origin-check + Turnstile protections preserved on cookie-auth routes
- [ ] Admin routes remain admin-guarded (`lib/admin-api-guard.ts` pattern)

## C. Data protection & privacy

- **Data minimization to mobile:** the app receives only what its screens render. Adding a field to a v1 response requires updating the shared schema — that friction is intentional; it's the leak review point.
- **Financial records:** payout/submission history is anonymized (not deleted) on account deletion — legal/audit requirement; privacy policy, DPA draft (PR #5), and App Store answers must all say the same thing (W2-10, W4-6).
- **Privacy artifacts (W8 inputs):** iOS privacy manifest, App Store nutrition labels, updated privacy policy covering mobile (push tokens, device identifiers, crash data). Answers must match actual SDK behavior (Clerk, Sentry, Expo, UploadThing all collect *something* — enumerate it).
- **PII inventory:** name, email, avatar, bio, pitches, media, payout amounts, push tokens. Document where each lives (Postgres/Clerk/Stripe/UploadThing/Expo push service) and its deletion story.

## D. Explicit non-goals (documented so nobody burns time)

- Certificate pinning (v1): rotation-outage risk outweighs threat model; revisit with scale.
- Jailbreak detection: not warranted for this product; trivially bypassed anyway.
- Custom crypto of any kind: TLS + Keychain + managed providers only.
