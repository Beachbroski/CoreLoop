# Blocked on Jackson

**Updated 2026-09-08.** Everything an agent cannot do, or must not decide alone. Companion to `docs/production-readiness-2026-09-06.md` (the full audit) — that document has the evidence; this one is the to-do list.

Two kinds of item:
- **DO** — an action only you can take (an account, a payment, a dashboard, a key). No agent can do it, ever.
- **DECIDE** — a product or policy call. An agent will build it the moment you answer; guessing risks building the wrong thing.

Ordered so the things that unblock the most work come first. The "unblocks" column names what starts moving when it is done.

---

## Tier 1 — nothing ships until these are done

| # | Type | Item | Unblocks | Est. |
|---|---|---|---|---|
| 1 | **DO** | **Fill in the remaining broken production environment variables.** ✅ `STRIPE_SECRET_KEY` and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` set 2026-09-07 (live-mode). ✅ `STRIPE_WEBHOOK_SECRET` set 2026-09-07 (stored as Vercel *Sensitive*, so a pull reads it blank — that is expected). Still outstanding: `TURNSTILE_SECRET_KEY` + `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (confirmed genuinely unconfigured — the live waitlist page renders no widget and carries no sitekey) and `RESEND_API_KEY` (still the 14-character `re_placeholder`). Walk the table in `docs/runbooks/deploy.md`. | The waitlist form and every email. | ~40 min |
| 2 | **DO** | ✅ **Production done 2026-09-08.** `UPLOADTHING_TOKEN` is set (encrypted) in Production, and the dead v6 `UPLOADTHING_SECRET`/`UPLOADTHING_APP_ID` are gone from *every* Vercel environment. Verified against the SDK: `uploadthing` 7.7.4's dist references `UPLOADTHING_TOKEN` and contains no reference to `UPLOADTHING_SECRET`. **Still outstanding: `.env.local`,** which keeps the old `UPLOADTHING_SECRET`/`UPLOADTHING_APP_ID` pair and has no token — so local uploads fail exactly as before, and that is the path the iOS app exercises (it calls `http://localhost:3000`). Add the same token there and delete the two dead lines. Preview and Development have no UploadThing config at all; whether that matters depends on the staging decision (item 17). | Creator content submission on both web and iOS. | 5 min left |
| 3 | **DO** | **Set `CREATOR_WEB_MODE=full`** in Vercel Production, Preview and Development, and in `.env.local`. It is set in **no** environment, and unset resolves to `sunset` by design — so the next deploy silently retires the creator web dashboard. | Deploying without breaking creator web. | 10 min |
| 4 | ~~DECIDE~~ **DECIDED 2026-09-07: open self-serve.** Any brand can sign up and run a campaign. Half-built: `/sign-up` is now a real Clerk sign-up page, and the allowlist gate moved behind one flag, `MARKETPLACE_ACCESS`. It still reads `invite` (today's behavior) because opening it before payments work would let brands sign up and hit a 500 at checkout. **Your remaining action: set `MARKETPLACE_ACCESS=open` in Vercel Production once items 1 and 5 are done and one real payment has gone through.** | ✅ decided | 1 env var, after Stripe |
| 5 | **DO** | ✅ Webhook endpoint created 2026-09-07 (7 events, live mode). Still to confirm: **is the Stripe account live-ready** — business verification done, Connect platform profile approved, Express onboarding enabled — and tell us how the webhook endpoints are configured (one endpoint for account events, one for connected-account events, or both at `/api/webhooks/stripe`). There is one `STRIPE_WEBHOOK_SECRET` but the code needs events from both classes. | Real money moving. Creator Stripe onboarding. | 30 min |
| 6 | **DO** | **Provision Upstash Redis** (Vercel Marketplace) for Production and Preview. The rate limiter already supports it and falls back to per-instance memory, which on serverless is decorative. | Rate limiting that actually limits. W5-H1. | 15 min |

## Tier 2 — needed before the iOS app can reach TestFlight

| # | Type | Item | Unblocks | Est. |
|---|---|---|---|---|
| 7 | **DO** | **Apple Developer Program.** Enroll if you have not. Tell us: Individual or Organization? (Organization needs a DUNS number and a legal entity, and takes days-to-weeks; Individual shows your personal name as the seller.) Then register App ID `com.creatordocks.app` with the **Push Notifications** capability. | Every build. Push. Everything below. | hours–weeks |
| 8 | **DO** | **Expo account + `eas init`.** No EAS project exists, so push tokens cannot be minted and there is no cloud build path. Tell us which account should own it. | TestFlight builds, push, OTA. | 30 min |
| 9 | **DECIDE + DO** | **Sign in with Apple.** The app offers Google and TikTok sign-in with no Apple option, which is a Guideline 4.8 rejection. Either add it (you enable the capability + configure Apple in Clerk; an agent writes the code) **or** we remove Google and TikTok. | App Store submission. | decision + 1 h |
| 10 | **DO** | **Verify the Clerk production instance** is ready for native auth: Native API on, `creatordocks://sso-callback` in the redirect allowlist, your own Google and TikTok credentials configured, TikTok Login Kit approved by TikTok. Nobody can see this but you. | Sign-in working outside dev. | 30 min |
| 11 | **DECIDE + DO** | **App Review demo account.** Reviewers hit a login wall behind an invite allowlist. Pick an email, let us add it to `TESTER_ALLOWED_EMAILS`, and approve seeding demo data (campaigns, an application in each status, payout history) **in the production database** — there is no staging. Or fund a staging environment (item 17). | App Store review. | decision |
| 12 | **DO** | **A physical iPhone** for one test session. Push delivery and photo upload cannot be verified on a simulator. | Confidence the loop actually works. | 1 h |

## From the App Review dossier (2026-09-07)

Full detail and paste-ready text in `docs/platform-split/09-app-review-dossier.md` — 8 blockers, 23 open risks. The ones needing **you**, beyond items 7-12 above:

| Item | Why |
|---|---|
| **Decide where the reviewer's demo account lives** | It must be Stripe-onboarded with PAID payout history, or Earnings shows only a "connect payouts" prompt and the reviewer cannot see the product. There is no staging, so today that means seeding **production**. Your W8 plan says reviewers must not have to onboard through Stripe themselves. |
| **Provide two review accounts, not one** | Testing account deletion destroys the account. One credential means the reviewer deletes it and cannot get back in. |
| **Approve the abuse-reporting work** | There is no report or block control anywhere, and brand-written campaign text is shown to every creator. Guideline 1.2 expects a reporting mechanism for user-generated content; the Terms need a matching clause. This is build work, not a note you can argue in the review. |
| **Decide the "beta" copy** | The app says it is an invite-only internal test in four places a reviewer reaches. Guideline 2.2 rejects software presented as a trial or beta. These strings have to change before submission. |
| **Resolve the privacy-policy contradiction** | The policy claims "basic usage data" while the nutrition labels say Usage Data = No, and it never mentions push tokens while the labels declare a Device ID. Apple checks the two against each other. Ties into blocker #9. |

## From the PII inventory (2026-09-07)

Full map in `docs/platform-split/pii-inventory.md` — 80 elements, 33 gaps. Decisions only you can make:

| Item | Why |
|---|---|
| **Waitlist deletion** | The whole `WaitlistSubmission` model — name, email, social handle, niche, follower range, referral graph — has no deletion path of any kind. A waitlist member asking to be erased currently cannot be. Needs an admin control at minimum; self-service needs an email-verified link. |
| **What survives a creator's deletion** | Their pitches, submission captions, notes, and the brand's review notes about them all stay readable to the brand. The audit-trail argument covers amounts and statuses, not prose. Decide whether to redact the free text. |
| **Uploaded media on deletion** | Nothing ever deletes files from UploadThing. Decide: delete on account closure, or document a contractual retention period. Ties to blocker #20. |
| **Stripe Connect account on deletion** | Nulling `stripeAccountId` does not deauthorize the account, and `Payout.stripeTransferId` is still a route back to that Stripe identity. This is open question Q-P4. |
| **A retention schedule** | There is none, for any model: no cron, no TTL, no `vercel.json`. Everything is kept forever. The DPA already lists this as a gap. |

## From the parity checklist (2026-09-08)

`docs/platform-split/parity-checklist.md` — 135 capabilities, 20 blocking gaps, **15 decisions that are yours**. Verdict: hold creator web at `full`. The ones I would not let pass quietly:

| Decision | Why it cannot wait for the flip |
|---|---|
| **What happens to non-iPhone creators** | There is no Android build configured and no creator web after sunset. Today they simply lose the product. Options: keep a minimal creator web permanently, build Android, or decide the product is iPhone-only and say so publicly before you take anyone's signup. |
| **Creators mid-obligation at the flip** | Someone with an ACCEPTED application and an unsubmitted deliverable, on a surface that is about to stop accepting writes. There is no handling for this today. |
| **The role-change write on the one page left standing** | `/creator/settings` is sunset-exempt for the Stripe return trip, but `PATCH /api/users/role` is ungated — so the surviving page carries a live role-changing write. Deliberate or oversight; nothing in the repo says. |
| **Email change never reaching us** | A creator changing their email in Clerk leaves `User.email` stale, and that column is what the tester allowlist and every notification key on. |
| **Whether Earnings should hide history behind Stripe onboarding** | It does today, so a creator whose requirements come due cannot see money they have already been paid. |

Nine further gaps have no recorded reason for being absent (creator home stats, platform filter, notification preferences, edit-profile, avatar, Clerk account management) — each needs a build-it-or-descope-it call, and a descope needs a written reason to satisfy W8-1.

## Legal drafts are ready for your attorney (2026-09-08)

`docs/legal/` — privacy policy and terms drafts, plus a README that is the working checklist. They are **not** live; applying them is a deliberate step after review.

- **49 `[PLACEHOLDER]` markers** are yours to fill — entity name, minimum age, governing law, retention periods, contact addresses. The README lists every one.
- **40 `[ATTORNEY]` markers** are decisions your lawyer makes — legal bases, liability cap, indemnity, warranties, arbitration, international transfers.
- **3 `[UNVERIFIED]` markers** are questions no code read can settle: whether photo EXIF (including location) survives the upload path, and whether Clerk revokes sessions on `deleteUser`. Each names the test that would answer it. The EXIF one matters — it decides an App Store Location label.
- The drafts admit four things the product cannot currently do: no media deletion, no waitlist deletion, no data export, no retention schedule. Closing those is engineering work; until then the documents tell the truth about it.

**One code fix falls out of this:** `lib/clerk-appearance.ts:22` nests the legal-link config under `options`, a key Clerk ignores, so no terms or privacy link appears at web sign-up. One-word go-ahead and I will move it to `layout`.

## Tier 3 — legal and business

| # | Type | Item | Unblocks | Est. |
|---|---|---|---|---|
| 13 | **DO** | **Legal entity.** Exact name, state of formation, mailing address. Every legal document has a `[PLACEHOLDER]` where this goes, and Apple asks for a seller name. | Terms, privacy policy, DPA, App Store listing. | — |
| 14 | **DECIDE** | **Minimum age** (Stripe Express requires 18+ in the US — is the whole platform 18+?), **governing law / venue** (which state), and whether **EU/UK users** are in scope for launch or you are US-only. | Terms and privacy drafting. | decision |
| 15 | **DO** | **Engage an attorney.** Drafts are ready for review (see below), but the fee terms, liability, indemnity and content-license clauses should be negotiated, not defaulted. | Launching without legal exposure. | — |
| 16 | **DO** | **Accept the DPA/terms in each vendor dashboard** (Stripe, Clerk, Resend, UploadThing, Vercel, Neon, Expo, Cloudflare) and tell us which Neon region the database is in. | `docs/dpa-draft.md` becoming accurate. | 1 h |

## Tier 4 — money and infrastructure decisions

| # | Type | Item | Unblocks | Est. |
|---|---|---|---|---|
| 17 | **DECIDE** | **Staging.** There is ONE Neon database shared by local, preview and production, and Preview has no database but *live* Clerk keys. Options: a Neon branch + fully configured Vercel Preview, or a second Vercel project. Until then, beta testing and App Review run against production data. | Safe testing. The W8-3 full-loop test. | decision |
| 18 | **DECIDE** | **Net vs gross.** The app, the web payouts page and the API show the **gross** amount; the payout email and push say **net** (after the 15% fee). One of them has to change. Related: should brands be charged rate + fee so "brands pay the platform fee" is literally true, instead of the fee coming out of the creator's rate? | Fixing a live inconsistency creators will notice. | decision |
| 19 | **DECIDE** | **Money model.** Today the brand's card is authorized at acceptance and captured at approval. Card authorizations expire in about 7 days, and a revision cycle can easily take longer — approving after expiry currently fails with a bare 500. Keep the hold and handle expiry, or charge at acceptance and transfer at approval? | A whole class of production failure. | decision |
| 20 | **DECIDE** | **Deletion policy while a payout is in flight.** Implemented today as: refuse with "wait until it lands" (409). The alternative is accept and defer. It is one flag — `BLOCK_DELETION_WITH_IN_FLIGHT_PAYOUTS` in `app/api/v1/me/route.ts`. Also: should the Stripe Connect account be deauthorized, and should uploaded media be deleted? | Finalizing deletion + the App Review answer. | decision |
| 21 | **DO** | **Vercel plan.** The team appears to be on Hobby, which is non-commercial-use-only and keeps logs for one hour. Moving to Pro before taking real money looks necessary — please confirm the plan and upgrade. | Legitimacy, log retention, alerting. | 15 min |
| 22 | **DECIDE** | **Repo visibility.** `Beachbroski/CoreLoop` is **public** with no LICENSE, `main` unprotected, and secret scanning off. Internal plans and the DPA draft are world-readable. Intentional? | Closing an information leak. | decision |
| 23 | **DECIDE** | **Error tracking and OTA.** Neither Sentry nor `expo-updates` is installed, yet the rollback playbook assumes both. Adopt them, or amend the playbook to match reality? | Knowing when production breaks. | decision |
| 24 | **DO** | **Alert recipients.** Who gets paged, and where (email/Slack/SMS)? Who owns `support@creatordocks.com`, which the site already advertises, and what response time do you want to commit to? | Incident response being real. | decision |

## One thing to do *after* the first deploy, not before

**Branch protection on `main`** (`PROC-02`) is still off, and I left it off on purpose. Requiring PRs and passing checks is the right end state, but turning it on now would block *you* from pushing the 47 commits sitting on local `main` — the very thing that has to happen next. Enable it once that push has landed and CI has run at least once (status checks cannot be marked required until GitHub has seen them report):

```bash
gh api -X PUT repos/Beachbroski/CoreLoop/branches/main/protection \
  -F required_status_checks[strict]=true \
  -f 'required_status_checks[contexts][]=Web (Next.js + shared)' \
  -f 'required_status_checks[contexts][]=Mobile (Expo)' \
  -F enforce_admins=false \
  -F required_pull_request_reviews[required_approving_review_count]=0 \
  -F restrictions=null
```

Also still open from the CI work: a **coverage threshold**. Not added because no coverage provider is installed (`@vitest/coverage-v8` is absent), and mobile's real statement coverage is 47.9% against a house rule of 80% — so a threshold set today fails on day one. The honest sequence is: install the provider, measure a baseline, agree a number that ratchets upward. That is a decision, not a config edit.

## Smaller decisions, batched

- **Node version**: canonical is 24 (matches Vercel). CI said 22, your laptop runs 25. Confirm 24.
- **Business waitlist**: branch `fix/waitlist-launch-gating` and `stash@{0}` re-add a schema `main` deliberately dropped. Permanently abandoned? If yes we delete both.
- **`prisma/set-role.mjs`** (untracked): keep it as a committed dev tool with a production guard, or delete it? It can flip any account to ADMIN against the shared production database.
- **`app/(dashboard)/creator/payouts/page 2.tsx`** (untracked): a stale iCloud duplicate of `page.tsx`, missing the admin view-as feature. I did not delete it because I did not create it — confirm and it goes.
- **Does open self-serve extend to creators?** Item 4 settled *brands*. The same `MARKETPLACE_ACCESS` flag also governs iOS account creation (`POST /api/v1/onboarding`) and content uploads, because they share one allowlist. Flipping it to `open` therefore opens the iOS app to anyone too. If you want brands open but creators invite-only until TestFlight, say so and the two get separated into different flags — a small change, but it must be made deliberately rather than discovered after launch.
- **Should a BRAND-role account be able to use the iOS API at all?** The authorization matrix found that 8 of 18 `/api/v1` handlers declare no role check — `GET/PATCH/DELETE /me`, both `/campaigns` routes, and both `/devices` routes — while `02-mobile-api.md` says "brands never". It is **not** a leak: every one is scoped to the caller's own id, verified and locked down by tests. But it is a real deviation. Closing it is a one-line change per route; the reason not to do it blind is `DELETE /api/v1/me`, which is Apple's mandated account-deletion path (5.1.1(v)) — 403-ing a brand there could be worse than allowing it. Your call.
- **Test data cleanup**: two waitlist rows created on 2026-09-07 while verifying the fixes live — `jackson.m.steele@gmail.com` (code `JACKSO842S`) and `jackson.m.steele+wl1@gmail.com` (handle `@testtest`). Delete before launch or before any waitlist export. See N3 in the audit.
- **Referral codes leak email prefixes** (audit N1): codes are seeded from the user's email, so a publicly shared referral link exposes the first six characters of their address. Agent-fixable, but regenerating existing codes is a product call since old links would stop working.
- **Mobile v1 scope**: video submissions? edit-profile and avatar upload? notification preferences, or "use iOS Settings" until v1.1? in-app password reset? iPhone-only? Keep `@expo/ui` and `expo-glass-effect` for a planned iOS 26 visual pass, or drop them?
- **Push content**: the "You got paid" notification currently puts the dollar amount on the lock screen. The spec says no amounts unless you explicitly opt in. Do you?
- **Campaign deadlines**: end of the brand's local day, or a UTC instant? They currently drift by a day between the brand form and the app.
- **Waitlist**: still wanted at `/waitlist` with referral codes now that `/get-the-app` is the creator funnel, or retire it?
- **Multiple submissions per accepted application** are allowed by the schema and the API. Intended?
- **After a creator deletes their account**, may a brand still accept and fund their pending applications?

---

## What is waiting on you, specifically

These are built, tested and sitting in the working tree, but cannot be finished without an answer above:

| Waiting on | What is ready |
|---|---|
| #1 + #5 Stripe | `MARKETPLACE_ACCESS=open`. The sign-up page and the flag are built and tested; flipping it before payments work would hand brands a broken checkout. |
| #18 net vs gross | A one-file change to the payouts API and the Earnings screen. |
| #19 money model | Authorization-expiry handling. |
| #20 deletion policy | Everything else about deletion is done; the payout guard is behind a flag awaiting your call. |
| #9 Sign in with Apple | The code is ~1 hour once the capability exists. |
| #13/#14 legal | Drafts exist with placeholders; they cannot be published without an entity name, an age floor and a venue. |

## A trap that already cost one round trip

`.env.production.local` is an **output** of `vercel env pull`, not a source. Editing it does nothing to production, and the next pull overwrites it. Production env vars are only ever set with `vercel env add <NAME> production` or in the Vercel dashboard, and they take effect on the **next deployment**, not on save.

Related, and still outstanding: that file currently holds a live Stripe secret key in plaintext inside an iCloud-synced folder (`~/Desktop`), which means it has been uploaded to Apple. Now that Vercel has the values, the file can be deleted. Consider rotating the key, and moving this repo off the Desktop — the same iCloud sync is what breaks mobile codesigning.

## Ground rules an agent will not break without you

1. **`git push origin main` is a production deploy.** Local `main` is 47 commits ahead of `origin`. Nothing has been pushed. Read `docs/runbooks/deploy.md` before the first push.
2. **There is one database.** Local, preview and production all point at the same Neon instance. `prisma migrate dev` must never be run.
3. **`CREATOR_WEB_MODE` unset means sunset.** Deploying without setting it retires creator web.
