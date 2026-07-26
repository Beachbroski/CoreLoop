# W4 — Payments, Payouts & Apple Compliance

**Goal:** Creators onboard to Stripe Connect and track earnings from the iOS app, without tripping Apple's in-app purchase rules or weakening the existing payment flow.

## The money flow (unchanged by this split)

1. Brand accepts an application → pays via Stripe PaymentIntent (**web only** — this never moves into the app).
2. Creator submits content → brand approves → payout released: Stripe **transfer** to the creator's Connect account minus `platformFee` (existing `lib/payout.ts` / `release-payout` logic).
3. Stripe webhooks (`app/api/webhooks/stripe`, svix-style signature verification already in place) reconcile status; dispute/refund ops alerts already wired (PR #4).

The iOS app only ever: onboards a creator to Connect, displays payout status, and shows earnings. **The app never charges anyone.**

## Apple App Store position (write this down for review)

- Guideline **3.1.1 (IAP)** applies to selling digital goods/services *to the app's user*. Nothing is sold to creators in this app; creators *receive* money for real-world marketing services. Money received is out of IAP scope.
- Guideline **3.1.5(a)** (physical goods & services outside IAP) is where marketplace-style flows live; brand→platform payments happen entirely on web regardless.
- Guideline **3.1.3(b)/(f)**: reader/“person-to-person” style exemptions aren't even needed — keep the app free of any purchase UI, price display for app-user purchases, or links steering brands to pay. Do not show brands a "pay here" anything in this app; it's creator-only.
- Precedent: creator-payout apps (marketplace/gig platforms) routinely pass review with Stripe Connect payouts.
- **App Review notes must include** a 2-3 sentence explanation of the money flow + a demo account with visible (test-mode-backed) payout history.

## Tasks

- **W4-1: Mobile Connect onboarding.**
  - `POST /api/v1/stripe/onboard` returns an Account Link (reuse existing onboard logic; add `platform=mobile` so return/refresh URLs are mobile-specific).
  - Return/refresh URLs → small web pages that immediately deep-link `creatordocks://stripe/return` / `…/refresh`. App resumes → calls `GET /api/v1/stripe/status` → updates UI.
  - Onboarding opens in `expo-web-browser` (ephemeral session, in-app). Never embed Stripe onboarding in a raw WebView (Stripe requires a secure browser context; WebView breaks their fraud checks).
- **W4-2: `GET /api/v1/stripe/status`** — server-side check of the Connect account (charges/payouts enabled), updating `stripeOnboarded`; response is only `{ onboarded, requirementsDue: boolean }`. Raw Stripe requirement details stay server-side.
- **W4-3: Payout history endpoint** (`GET /api/v1/payouts`, with W2-7): own payouts only; amount, platformFee, status, dates. Server-computed lifetime/pending totals in `meta` (client never derives money math).
- **W4-4: Earnings UI (with W3-9):** payout list, totals, status explanation copy ("Processing — typically arrives in 2 business days"), onboarding prompt state when `!stripeOnboarded`, requirements-due nudge state.
- **W4-5: Push on payout events (with W6):** notify on payout PAID and FAILED via existing Stripe webhook handlers. FAILED copy tells the creator what to do (check Stripe requirements) without leaking Stripe internals.
- **W4-6: App Review dossier:** money-flow explanation, demo creds, screenshots of earnings screens, account-deletion behavior for users with payout history (ties to W2-10: financial records are anonymized, not destroyed — matches privacy policy).

## Security requirements (from W5)

- The mobile client never sees: `stripeAccountId`, transfer ids (unless product requires; default no), platform fee *rates* or margin logic — only per-payout computed amounts.
- Onboard/status endpoints: authenticated + rate-limited (Account Link creation hits Stripe's API; don't let a client spam it).
- Amounts are integers (cents) end-to-end; the client formats but never computes.
- Webhook handlers remain the single source of payout-status truth; the app never "confirms" money movement from the client side.
- Stripe keys: live keys only in Vercel prod env; test keys everywhere else; nothing Stripe-secret ever in the mobile workspace.

## Acceptance criteria

- [ ] Creator can complete Connect onboarding starting and ending inside the app (test mode), with status reflected after return.
- [ ] Payout history + totals render from server data; values match Stripe test-mode dashboard.
- [ ] Push received on payout PAID/FAILED in test flow.
- [ ] No purchase UI anywhere in the app; grep-level check for price/pay/buy strings targeted at app users.
- [ ] App Review dossier written and stored in this directory.
