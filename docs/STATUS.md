# CreatorDocks — one status file

**Written 2026-09-08.** This is the single source of truth for *where the product stands and what is left*. It merges `production-readiness-2026-09-06.md`, `BLOCKED-ON-JACKSON.md`, `PROJECT-STATE.md`, the parity checklist, the App Review dossier, the PII inventory, the legal README and the web-redesign plan into one place.

> **It supersedes the status tables in all of those documents.** Several of them still say Turnstile, Resend, UploadThing and Upstash are unset. They are configured and verified. Where this file and another document disagree, this file is right — every fact below was re-verified live on 2026-09-08, not read from an older doc. The other documents remain useful for *detail and evidence*; §9 maps them.

---

## 1. The five things to know

1. **Production is ~6 weeks stale, and a push is the deploy.** `origin/main` was last updated 2026-07-25. www.creatordocks.com is still the July creator waitlist: `/brand`, `/get-the-app` and `/api/v1/meta` all return 404. Vercel auto-deploys `main`; there is no promote step.
2. **The production environment is no longer broken.** Every launch-blocking variable is set and verified (§4). `CREATOR_WEB_MODE="full"` is confirmed, so a deploy will *not* silently retire creator web.
3. **The marketplace has never been used.** 0 brands, 0 applications, 0 submissions, 0 payouts, 0 registered devices. 5 waitlist rows, all internal tests. No money has ever moved through the product.
4. **The iOS app cannot be submitted, and the blocker is not code.** No Apple Developer Program enrollment → no App ID → no push capability → no EAS project → no build. That chain starts with a legal entity. It is the longest lead time in the project.
5. **Brands are the paying side and they are web-only.** Nothing about getting a first brand depends on the iOS app.

---

## 2. Status by surface

| Surface | State | One line |
|---|---|---|
| Web — brand product | 🟢 Ready to deploy | Full loop built and now tested. Not yet live. |
| Web — creator dashboard | 🟢 Working, frozen | `CREATOR_WEB_MODE=full`. Bug fixes only; retires when the app reaches parity. |
| `/api/v1` (mobile API) | 🟢 Ready | 18 routes, Bearer-only, authorization matrix test, real JSON 401s. |
| iOS app | 🟠 Built, unshippable | Feature-complete and tested; blocked entirely on Apple/Expo accounts. |
| Payments | 🟡 Correct, unproven | Logic is right and now covered by tests. Zero real transactions ever. |
| Infra & ops | 🟡 Adequate | Env correct, rate limiting durable, CI written but never run. No error tracking. |
| Legal | 🔴 Not launchable | Drafts exist with 49 placeholders and 40 attorney decisions. No legal entity. |
| Business | 🔴 No demand yet | No brand has ever been asked. |

---

## 3. Blockers, merged and deduped

**Owner key:** **J** = only Jackson can do it · **A** = an agent can do it · **J→A** = decide, then it gets built.

### 3.1 Blocking the first real brand

| # | Owner | Item | Notes |
|---|---|---|---|
| B1 | **J** | **Push `main`** | The deploy itself. Everything below assumes it has happened. |
| B2 | **J** | **Confirm Stripe is live-ready** | Business verification done, Connect platform profile approved, Express onboarding enabled. Keys and webhook are configured; account readiness is unverified. |
| B3 | **J** | **One real payment, end to end** | Nothing has ever been charged or paid out. Until this happens the money path is theory. |
| B4 | **J** | **Set `MARKETPLACE_ACCESS=open`** | Only after B3. Unset today = `invite`, so only allowlisted emails can use the marketplace at all. Note it also opens iOS account creation — they share one allowlist. |
| B5 | **J→A** | **Split the access flag** | If brands should be open while creators stay invite-only until TestFlight, the one flag must become two. Small change, but must be deliberate. |

### 3.2 Blocking TestFlight

| # | Owner | Item | Lead time |
|---|---|---|---|
| B6 | **J** | **Apple Developer Program** — Individual (same-day, personal name as seller) or Organization (needs DUNS + legal entity, days–weeks) | **longest pole** |
| B7 | **J** | Register App ID `com.creatordocks.app` with Push Notifications | after B6 |
| B8 | **J** | Expo account + `eas init` (no EAS project exists, so no push token can be minted) | 30 min |
| B9 | **J** | Verify the Clerk **production** instance: Native API on, `creatordocks://sso-callback` allowlisted, Google + TikTok credentials, TikTok Login Kit approved | 30 min |
| B10 | **J** | A physical iPhone for one session — push delivery and photo upload cannot be verified on a simulator | 1 h |
| B11 | **A** | Point the production build at `https://www.creatordocks.com` — `mobile/.env` still says cleartext `http://localhost:3000` (dossier blocker A5) | after B8 |

### 3.3 Blocking App Store review

The dossier's own verdict is **NOT SUBMITTABLE TODAY**.

| # | Owner | Item |
|---|---|---|
| B12 | **J→A** | **Two** demo accounts, not one — testing account deletion destroys the first, and there is no way back in |
| B13 | **J** | Decide where demo data lives. There is no staging, so today that means seeding **production** |
| B14 | **J→A** | **Abuse reporting.** No report/block control exists anywhere, while brand-authored campaign text is shown to every creator (Guideline 1.2). This is build work, not a note you can argue |
| B15 | **A** | Remove "internal test / beta" copy from the four places a reviewer reaches (Guideline 2.2) |
| B16 | **J→A** | Resolve the privacy-policy vs nutrition-label contradiction: the policy claims "basic usage data" while the labels say Usage Data = No, and never mentions push tokens while the labels declare a Device ID |

### 3.4 Blocking a lawful launch

| # | Owner | Item |
|---|---|---|
| B17 | **J** | **Legal entity** — exact name, state, mailing address. Every legal document has a placeholder here, and Apple asks for a seller name |
| B18 | **J** | Minimum age (Stripe Express is 18+ in the US), governing law/venue, and whether EU/UK users are in scope |
| B19 | **J** | Engage an attorney. Drafts are ready: **49 `[PLACEHOLDER]`**, **40 `[ATTORNEY]`**, **3 `[UNVERIFIED]`** |
| B20 | **J** | Accept the DPA/terms in each vendor dashboard (Stripe, Clerk, Resend, UploadThing, Vercel, Neon, Expo, Cloudflare) |

The drafts deliberately admit four things the product cannot do: no media deletion, no waitlist deletion, no data export, no retention schedule.

---

## 4. Environment — verified live 2026-09-08

Vercel **Production**. Do not trust any other document's copy of this table.

| Variable | State |
|---|---|
| `DATABASE_URL`, Clerk (×7), `NEXT_PUBLIC_URL`, `ADMIN_ALLOWED_EMAILS` | ✅ set |
| `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | ✅ set, live-mode |
| `STRIPE_WEBHOOK_SECRET` | ✅ set — **Vercel "sensitive" type, so it reads back blank by design.** Two audits misdiagnosed this as missing |
| `TURNSTILE_SECRET_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | ✅ set, verified in a browser |
| `RESEND_API_KEY` | ✅ set, real email delivered |
| `UPLOADTHING_TOKEN` | ✅ set (v7). Dead v6 names removed everywhere |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` (Upstash) | ✅ set — rate limiting is durable |
| `CREATOR_WEB_MODE` | ✅ **`"full"`** — value confirmed, not just presence |
| `MOBILE_MIN_SUPPORTED_VERSION` / `LATEST` / `MAINTENANCE_MODE` | ✅ `1.0.0` / `1.0.0` / `false` |
| `MARKETPLACE_ACCESS` | ⬜ unset ⇒ `invite`. Correct for the first deploy |
| `TESTER_ALLOWED_EMAILS` | ⬜ unset ⇒ only the admin email can use the marketplace |
| `NEXT_PUBLIC_IOS_APP_URL` / `_ID` | ⬜ correctly unset until the app is approved |

**Rules that have already cost real time:**
- **Never mark a `NEXT_PUBLIC_*` variable "sensitive".** Sensitive vars reach runtime but not the build, so the value silently fails to inline. This broke the live waitlist form once.
- **A blank value from `vercel env pull` means unset *or* sensitive.** Check the `type` field before concluding anything.
- **`.env.production.local` is an output, not a source.** Editing it does nothing. It was deleted on 2026-09-08 because it held a live `sk_live_` key in plaintext inside iCloud-synced `~/Desktop` — **that key is worth rotating.**

**Database:** one Neon instance shared by local, preview and production. `prisma migrate dev` must never be run. All 3 migrations applied; schema up to date as of 2026-09-08. Preview has no database but *live* Clerk keys.

---

## 5. Where the product actually is, by the numbers

**Production data, read 2026-09-08:**

```
users            4   (2 ADMIN, 2 CREATOR, 0 BRAND)
campaigns        1
applications     0
submissions      0
payouts          0
devices          0
waitlist         5   (4 from 2026-07-04, 1 internal test)
```

**Quality gates, all green on the deployed commit:**

```
web       914 tests / 39 files      tsc clean   eslint 0 errors (10 warnings)
shared     51 tests / 10 files      tsc clean
mobile    408 tests / 41 suites     tsc clean
          ─────
total   1,373 tests
```

**Parity (the creator-web sunset gate):** 135 capabilities — 56 parity, 22 partial, 28 missing, 12 descoped, 17 app-only. **Verdict: hold at `full`.** The largest gap: there is no surface at all for a non-iPhone creator, since no Android package is configured.

---

## 6. Decisions waiting on Jackson

Each of these has code ready or blocked behind it.

| Decision | Why it cannot be defaulted |
|---|---|
| **Net vs gross** | The app, the web payouts page and the API show **gross**; the payout email and push say **net**. One must change. Also: should brands pay rate + fee, so "brands pay the platform fee" is literally true? |
| **Money model** | The card is authorized at acceptance and captured at approval. Authorizations expire in ~7 days and a revision cycle easily exceeds that. Keep the hold and handle expiry, or charge at acceptance and transfer at approval? |
| **Non-iPhone creators** | No Android build, no creator web after sunset. Today they simply lose the product. Keep creator web permanently, build Android, or say publicly that it is iPhone-only *before* taking signups. |
| **Creators mid-obligation at the flip** | Someone holding an ACCEPTED application with an unsubmitted deliverable when creator web stops accepting writes. No handling exists. |
| **Staging** | One database for everything. Beta testing and App Review would run against production data. |
| **Deletion policy** | Refuse deletion while a payout is in flight (today's behaviour, behind a flag), or accept and defer? Should the Stripe Connect account be deauthorized? Should uploaded media be deleted? |
| **Waitlist deletion** | The entire `WaitlistSubmission` model has no deletion path of any kind. A member asking to be erased currently cannot be. |
| **Free text after a creator deletes** | Their pitches, captions and the brand's review notes stay readable to the brand. The audit-trail argument covers amounts, not prose. |
| **Repo visibility** | `Beachbroski/CoreLoop` is **public**, `main` unprotected, secret scanning off, no LICENSE. Internal plans and the DPA draft are world-readable. |
| **Vercel plan** | Appears to be Hobby — non-commercial-use-only, 1-hour log retention. Pro looks necessary before taking real money. |
| **Error tracking** | Neither Sentry nor `expo-updates` is installed, yet the rollback runbook assumes both. Adopt them, or amend the runbook. |
| **Alert recipients** | Who gets paged, where, and who owns `support@creatordocks.com` — which the site already advertises. |
| **`prisma/set-role.mjs`** | Deliberately left uncommitted: its allowlist guard is `if (allowlist.size > 0 && ...)`, so with the env vars empty it **fails open** and will flip any account to ADMIN against the production database. Fix the guard or delete the file. |

Smaller, batched: campaign deadline timezone (drifts a day between the brand form and the app); whether push notifications may put dollar amounts on the lock screen; whether `/waitlist` survives now that `/get-the-app` is the creator funnel; whether multiple submissions per accepted application are intended; whether a BRAND-role account should reach `/api/v1` at all (8 of 18 routes declare no role check — not a leak, every one is self-scoped and test-locked, but it deviates from the spec).

---

## 7. Known issues shipped deliberately

Accepted risk in the current deploy, recorded so nobody rediscovers them as surprises.

| Issue | Why it shipped |
|---|---|
| **Webhook admin alerts are not deduped** | Dispute and refund redeliveries re-alert admins. The only writable state is `Payout.status`, which has no DISPUTED/REFUNDED member — corrupting the row the creator's earnings read from, to dedupe an email, is the worse bug. Proper fix needs a persisted Stripe event id (a schema change). |
| **Notification idempotency has a theoretical race** | The status read is inside the transaction, but Prisma runs at Postgres READ COMMITTED, so two truly concurrent deliveries could both observe the pre-transition state. Requires simultaneous redelivery of the same event. |
| **Refunds and disputes leave `Payout.status = PAID`** | There is no automated resolution flow yet, so money surfaces over-report creator earnings until one exists. |
| **Returning waitlist visitors on a new device cannot finish a profile** | The claim cookie that closes the takeover is per-browser, 30 days. They see "already on the list, check your email". Fixing it properly needs an emailed magic link. |
| **An unknown referral code is silently ignored** | Removing the distinguishable 400 removed an existence oracle, at the cost of "double-check the code" feedback. |
| **CI has never run** | Nothing was ever pushed. Its first execution is the branch push. |
| **No coverage threshold** | No coverage provider is installed, and mobile's real statement coverage is ~48% against a house rule of 80%. Install, measure, then ratchet — that is a decision, not a config edit. |
| **Branch protection off** | Left off deliberately so the 72-commit push could land. Enable after CI has reported once. |

---

## 8. What changed on 2026-09-08

Beyond the deploy itself:

- **Three live data-exposure defects closed.** A brand could read any creator's `email`, `bio`, `clerkId` and `stripeAccountId` via a no-op status PATCH. An unauthenticated caller could overwrite any unfinished waitlist signup and harvest their referral credential — and the first fix for it was itself forgeable, because the response handed out the exact claim pair to anyone quoting a public referral code. `PATCH /api/users/role` resolved accounts by an unverified, non-primary email address and then rebound the row.
- **A live 500 fixed:** every creator listing their applications on the web dashboard hit a Prisma `select`+`include` conflict.
- **The payout notification path corrected.** The idempotency guard, as first written, would have meant creators were *never* told they had been paid, because `releasePayout` writes PAID synchronously before the webhook arrives.
- **The money core went from zero tests to full coverage.** Web tests 377 → 914.
- **Deleted:** `.env.production.local` (live Stripe key in an iCloud folder) and the stale `page 2.tsx` duplicate.

Method note worth keeping: every one of the security findings above came from an **adversarial** pass, not the pass that wrote the code. Two rounds of fixes each introduced a new defect that only a reviewer told to *refute* the fix caught. Budget for the refutation round.

---

## 9. Where the detail lives

This file is the status. Those files are the evidence.

| Question | File |
|---|---|
| How does the system actually work? | `PROJECT-STATE.md` |
| Full audit with `path:line` evidence | `production-readiness-2026-09-06.md` |
| Deploy / migrate / roll back / incident / secrets | `runbooks/` |
| Why the product is split in two | `platform-split/00-MASTER-PLAN.md` |
| What may not be built on creator web | `platform-split/creator-web-freeze.md` |
| App Store submission dossier (8 blockers, 23 risks) | `platform-split/09-app-review-dossier.md` |
| Every data element and where it goes (80 elements, 33 gaps) | `platform-split/pii-inventory.md` |
| The creator-web sunset gate (135 capabilities) | `platform-split/parity-checklist.md` |
| Privacy/terms drafts + the owner checklist | `legal/` |
| What blocks the iOS build | `../mobile/RELEASE-CHECKLIST.md` |
| Brand-web redesign plan and mockups | `web-redesign-2026-09/` |

**Three ground rules an agent will not break without you:**
1. `git push origin main` **is** a production deploy.
2. There is **one** database — local, preview and production all point at it.
3. `CREATOR_WEB_MODE` unset means **sunset**.
