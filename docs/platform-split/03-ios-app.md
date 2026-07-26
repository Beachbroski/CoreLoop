# W3 — Creator iOS App (Expo / React Native)

**Goal:** The creator-side product as a native iOS app: discover campaigns, apply, submit content, track payouts, get notified. Feature parity with today's creator web dashboard is the bar for sunsetting web (W8).

## Stack

- **Expo SDK (latest stable) + expo-router** (file-based routing, mirrors App Router mental model), TypeScript strict.
- **EAS Build/Submit/Update** — cloud builds, TestFlight submission, OTA updates for JS-only fixes.
- **Auth:** `@clerk/clerk-expo` — same Clerk instance as web, so accounts work on both surfaces during the transition. Token cache in **`expo-secure-store` (Keychain)** — never AsyncStorage.
- **Data layer:** `@tanstack/react-query` + a thin typed API client wrapping fetch: attaches Bearer token, validates every response against `@creatordocks/shared` response schemas, maps envelope errors to typed errors.
- **UI:** start with React Native primitives + a small design-system layer (tokens for color/spacing/type mirroring the web palette). No heavy UI kit dependency for v1.
- Lives in `mobile/` workspace (W1), consuming `@creatordocks/shared`.

## Screen map

```
(auth)
  sign-in / sign-up            — Clerk (email + OAuth per web parity)
(app)                          — authed tab shell
  discover/                    — campaign feed (filter: niche, platform)
    [id]                       — campaign detail → Apply CTA
    [id]/apply                 — pitch + proposed rate form
  activity/                    — segmented: Applications | Submissions
    applications/[id]          — status, withdraw (PENDING only)
    submissions/[id]           — status, review note, resubmit if REJECTED
    submissions/new            — media upload (W6) + link + notes
  earnings/                    — payout list + totals; Stripe onboarding state
    onboard                    — opens Stripe hosted onboarding (in-app browser)
  profile/                     — edit name/bio/avatar; settings
    settings                   — notifications toggle, legal links, sign out,
                                 DELETE ACCOUNT (Apple-mandated, W2-10)
  force-update                 — full-screen gate driven by /api/v1/meta
```

## Tasks

- **W3-1: Scaffold.** Expo app in `mobile/`, TS strict, expo-router, ESLint/Prettier matching repo, Metro monorepo config (watchFolders → `packages/shared`), env via `app.config.ts` + EAS env (see security), CI job: typecheck + lint + unit tests.
- **W3-2: App shell + meta gate.** Launch flow: check `/api/v1/meta` → force-update or maintenance screen when required; splash → auth state → tabs. Global error boundary; offline banner (react-query `onlineManager`).
- **W3-3: Auth.** Clerk sign-in/up/OAuth; SecureStore token cache; session refresh; sign-out clears SecureStore, react-query cache, and unregisters push token (W6). Deep-link scheme `creatordocks://` registered (Stripe return + notification taps).
- **W3-4: API client + contracts.** Typed client with runtime response validation (a schema mismatch = tracked error, not a crash); central 401 handling → re-auth; retry/backoff for idempotent GETs only.
- **W3-5: Discover.** Feed with cursor pagination + pull-to-refresh, filters, campaign detail. Empty/loading/error states designed, not defaulted.
- **W3-6: Apply flow.** Form with client-side Zod (same schema server enforces), optimistic-safe submit (handle 409 duplicate gracefully), success → activity tab.
- **W3-7: Activity.** Applications + submissions lists/details, withdraw, resubmit. Status changes surfaced via pull-to-refresh + push (W6) — no polling.
- **W3-8: Submission creation.** Media upload via W6 pipeline; progress UI; link + notes fields with validation.
- **W3-9: Earnings.** Payout list, totals, status chips; Stripe onboarding via `expo-web-browser` in-app session → deep-link return → `GET /api/v1/stripe/status` refresh (W4 details).
- **W3-10: Profile + settings.** Edit profile, avatar (W6 upload), notification preferences, legal links (privacy/support pages on web), sign out, account deletion flow (confirmation + consequences copy, calls W2-10).
- **W3-11: Push UX.** Permission prompt after first meaningful action (not on first launch); token registration; notification tap → deep-link to the right screen (W6).
- **W3-12: E2E.** Maestro flows: sign-in, browse→apply, submit content, view payout, delete account (test env). Runs in CI on EAS builds before any TestFlight promotion.

## Security requirements (from W5)

- Tokens **only** in SecureStore/Keychain. Audit that no dependency (including Clerk cache config) writes tokens to AsyncStorage.
- No secrets in the app bundle or `app.config.ts` — only the public API base URL and Clerk **publishable** key. Everything in the JS bundle is extractable; treat it as public.
- All traffic HTTPS to the production domain only; ATS stays default-strict (no arbitrary-loads exceptions). Certificate pinning: not for v1 (rotation risk > threat model), revisit post-launch.
- Runtime response validation (W3-4) doubles as defense: server changes can't silently push malformed data into stored state.
- Screens with financial data (earnings) excluded from iOS app-switcher screenshot via privacy overlay.
- Sign-out is a full local wipe: SecureStore, query cache, push token unregistration.
- Privacy manifest (`PrivacyInfo.xcprivacy`) + App Store privacy nutrition labels accurate to actual collection (W8 checklist).

## Acceptance criteria

- [ ] Full screen map implemented against `/api/v1`; zero calls to legacy `/api/*` routes.
- [ ] Feature parity checklist vs creator web dashboard (drawn up in W8) fully green.
- [ ] Maestro E2E suite green in CI.
- [ ] Cold start → interactive discover feed < 3s on mid-tier device; feed scroll 60fps.
- [ ] Security checklist above verified item-by-item before first TestFlight build.
