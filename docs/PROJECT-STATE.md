# CreatorDocks — how it all works

**Written 2026-09-07** for whoever picks this up next, human or agent. Orientation, not a spec: what the pieces are, how they fit, and which sharp edges will cut you. For *what needs doing* read `docs/production-readiness-2026-09-06.md` (full audit) and `docs/BLOCKED-ON-JACKSON.md` (what needs Jackson).

---

## 1. What the product is

A marketplace between **local brands** and **creators**. A brand posts a campaign with a budget and a deadline; creators apply with a pitch and a proposed rate; the brand accepts one and authorizes payment; the creator submits content; the brand approves it; the creator gets paid, minus a 15% platform fee.

**The pivot (2026-07-25) is the thing to understand first.** CreatorDocks split into two surfaces:
- **Web** (`marketplace/`, Next.js) is becoming **brand-first**. Brands run campaigns here. They pay here. Admin lives here permanently.
- **iOS** (`marketplace/mobile/`, Expo) is the **creator** product. Discover, apply, submit, get paid, get notified.

The creator web dashboard still exists but is frozen (bug fixes only, `docs/platform-split/creator-web-freeze.md`) and will be retired once the app reaches parity. There is **one backend** — the Next.js app — serving both.

The plan for all of this is `docs/platform-split/`: `00-MASTER-PLAN.md` plus workstreams `01`–`08`. **Do not trust its checkboxes** — all 50 acceptance criteria are unticked regardless of what is actually done. The code is the truth.

---

## 2. Repo layout

```
marketplace/                  ← the git repo, an npm workspace root
├── app/                      ← Next.js 16 App Router
│   ├── (dashboard)/brand/    ← the web product core, actively developed
│   ├── (dashboard)/creator/  ← FROZEN, being retired
│   ├── api/                  ← legacy cookie-session API (web)
│   ├── api/v1/               ← Bearer-token API (iOS app)
│   ├── api/_lib/             ← shared route helpers (private, not routable)
│   └── internal/             ← admin, web-only forever
├── lib/                      ← guards, flags, integrations, business logic
├── packages/shared/          ← Zod contracts shared by web AND mobile
├── mobile/                   ← the Expo iOS app (npm workspace)
├── prisma/schema.prisma      ← the data model
├── proxy.ts                  ← Clerk middleware (NOT middleware.ts)
└── docs/                     ← plans, runbooks, this file
```

`packages/shared` is the contract between the two surfaces. A field cannot reach the app without being added to a schema there — that friction is deliberate, it is the data-leak review point.

**Next.js 16 differs from what most models remember.** Read `node_modules/next/dist/docs/` before writing framework code. The middleware file is `proxy.ts` at the root.

---

## 3. Authentication — two paths, one user table

Clerk is the identity provider for both surfaces, on the same instance, so an account works in both places.

**Web** uses a Clerk cookie session. `proxy.ts` runs `clerkMiddleware`, protects everything not in its public-route list, and forwards the request path as an `x-pathname` header (App Router layouts cannot read the path themselves, and the creator sunset redirect needs it).

**iOS** sends `Authorization: Bearer <Clerk session JWT>` to `/api/v1/*`. `lib/mobile-api-guard.ts` wraps every v1 route and, in order: rate-limits, verifies the Bearer token, resolves the database user, checks the role, validates input with a shared Zod schema, runs the handler, and shapes the response through an allow-list schema. **It rejects cookie-only requests outright** — that is what stops a browser CSRF from reaching the mobile namespace, and it is why origin checks are skipped there.

`lib/current-app-user.ts` maps a Clerk identity to a `User` row for both paths.

**A creator who signs up only in the app** has a Clerk identity and no database row, so `POST /api/v1/onboarding` is the one route that runs before a row exists. It is idempotent and creates the row with `role: CREATOR`.

### Access is gated by email allowlists
`lib/admin-config.ts` reads `ADMIN_ALLOWED_EMAILS` and `TESTER_ALLOWED_EMAILS`, unless `MARKETPLACE_ACCESS=open` lifts the allowlist entirely (see the flag table below). While the product is in "waitlist mode", only allowlisted emails can use the marketplace at all. In production today `TESTER_ALLOWED_EMAILS` is unset, so **only Jackson's admin email can do anything** — and the admin role is refused by creator- and brand-only endpoints, so even that account cannot exercise the main flows. This is why there is no usable test identity.

`lib/post-login.ts` is the single source of truth for where a signed-in user lands: admin → `/internal/waitlist`, allowlisted tester with no role → `/onboarding`, brand → `/brand`, creator → `/creator`, everyone else → `/waitlist`.

---

## 4. Money

All of it is integer cents, end to end. The client formats; it never computes.

1. **Brand accepts an application** → `POST /api/stripe/create-intent` creates a Stripe **destination charge** with `capture_method: manual` and `application_fee_amount` (15%). The card is *authorized*, not charged. The intent id is stored on the `Application`.
2. **Creator submits content** → brand reviews on web.
3. **Brand approves** → `lib/payout.ts` captures the authorization (with an idempotency key) and creates a `Payout` row.
4. **Stripe webhook** (`app/api/webhooks/stripe/route.ts`) is the single source of truth for status: `payment_intent.succeeded` moves the payout to `PAID` and fires the creator's email and push, both quoting the **net** amount. Disputes and refunds alert admins.
5. **Creator onboarding** to Stripe Connect Express happens through a hosted link; `account.updated` sets `User.stripeOnboarded`, which `POST /api/v1/applications` requires before a creator may apply.

**The app never charges anyone.** That is the App Store position (Guideline 3.1.1 covers selling *to* the user; creators are being *paid*). Written up in `docs/platform-split/04-payments-payouts.md`.

Two known problems: authorizations expire in ~7 days with no handling, and the creator-facing surfaces show **gross** while the email and push say **net**. Both are decisions in the blockers file.

---

## 5. Flags and switches

| Flag | Where | What unset means |
|---|---|---|
| `CREATOR_WEB_MODE` | `lib/creator-web-mode.ts` | **`sunset`** — deliberately fails closed so a typo cannot reopen creator web. Values: `full`, `readonly`, `sunset`. Enforced in route handlers, not just hidden buttons. |
| `MARKETPLACE_ACCESS` | `lib/admin-config.ts` | **`invite`** — the TESTER/ADMIN email allowlist decides who may use the marketplace. `open` means any signed-in user with a role may. Fails closed on a typo, like `CREATOR_WEB_MODE`. Jackson chose open self-serve for brands on 2026-09-07; the flag stays `invite` until payments are verified end to end. Note it currently governs the creator/iOS path too, since both share one allowlist. |
| `MOBILE_MIN_SUPPORTED_VERSION`, `MOBILE_LATEST_VERSION`, `MOBILE_MAINTENANCE_MODE` | `/api/v1/meta` | Safe defaults (`1.0.0`, false). The app checks this on launch and can be force-updated or shown a maintenance screen — the escape hatch for shipping past a slow App Store review. |
| `NEXT_PUBLIC_IOS_APP_URL`, `NEXT_PUBLIC_IOS_APP_ID` | `/get-the-app` | No App Store button, no Safari smart banner. Correct until the app is approved. These are build-time, so setting them needs a redeploy. |

---

## 6. Data model (`prisma/schema.prisma`)

```
User (role BRAND|CREATOR|ADMIN, stripeAccountId, stripeOnboarded)
 ├── Campaign (budget, deadline, niche, platforms, status)
 │    └── Application (pitch, proposedRate, paymentIntentId; unique per campaign+creator)
 │         └── Submission (contentUrl, reviewNote, status)
 │              └── Payout (amount, platformFee, stripeTransferId, status)
 ├── Device (expoPushToken unique, platform)  ← push targets
 └── WaitlistSubmission (referral codes, status)
```

**Account deletion anonymizes, it does not delete.** `clerkId` and `email` are unique and non-null so they cannot be nulled; they get per-row placeholders (`deleted-<id>@deleted.creatordocks.invalid`). Application, Submission and Payout rows survive as a financial audit trail pointing at a scrubbed User. The privacy policy, the in-app copy and the App Store answers must all say this same thing — the in-app copy was wrong until today.

---

## 7. The iOS app

Expo SDK 57, expo-router, React Native 0.86, TypeScript strict. Four tabs: **Discover** (campaign feed → detail → apply), **Activity** (applications and submissions, withdraw, resubmit), **Earnings** (Stripe onboarding, payout history), **Profile** (account, sign-out, delete account, legal links).

- **Data layer**: react-query + `mobile/src/lib/api-client.ts`, which attaches the Bearer token and **validates every response against the shared Zod schemas at runtime**. A server change cannot silently push malformed data into the app.
- **Tokens live in the Keychain** via `expo-secure-store`. Never AsyncStorage.
- **Sign-out is a full wipe** in a specific order: unregister the push token (needs a live token, so it must happen first), then Clerk sign-out, then clear the query cache.
- **Design is deliberately different from web**: dark-first (`#07080b`), coral accent (`#ff503d`), generated campaign cover art. Approved 2026-08-13. Do not "fix" it back to the web blue. Theme tokens only, never hard-coded colors, haptics on tappables, light mode must keep working.
- **`mobile/ios/` is generated** by `expo prebuild` and gitignored. It is currently stale.

---

## 8. Environments — read this before touching anything

**There is ONE database.** `.env`, `.env.local` and `.env.production.local` all point at the same Neon instance. Local development, Vercel Preview and Production share it.

- **Never run `prisma migrate dev`** — its drift-reset behavior would run against production data. Use `prisma migrate status` to check, `prisma migrate diff` to inspect, `prisma migrate deploy` to apply. See `docs/runbooks/migrate.md`.
- **`git push origin main` is a production deploy.** Vercel auto-deploys `main`. Local `main` is 47 commits ahead of `origin/main` and nothing has been pushed since 2026-07-25, so production is running six-week-old code: the live site is still the creator waitlist, and `/api/v1`, `/brand` and `/get-the-app` all 404 there.
- **Production env is broken** — Stripe and Turnstile values are empty strings, Resend is a placeholder, UploadThing uses variable names the SDK does not read. Full table in `docs/runbooks/deploy.md`.
- **Preview is unusable and unsafe**: no database, but *live* Clerk keys.
- Migrations are applied **by hand**; the build script does not run them.

The repo lives in an iCloud-synced Desktop folder, which stamps extended attributes onto files and breaks codesigning. Run `xattr -cr mobile/ios` before every clean native build. You will also see `Pods 2/`, `build 2/`, `page 2.tsx` — iCloud duplicates, not real files.

---

## 9. Running it

```bash
# Backend (needed by the app too)
npm run dev                                    # http://localhost:3000

# Gates — all three must stay green
npx vitest run                                 # web: 174 tests
npm run test --workspace=packages/shared       # shared: 48
npx tsc --noEmit && npx eslint                 # 6 <img> warnings are pre-existing
cd mobile && npx tsc --noEmit && npx expo lint && npx jest   # mobile: 377

# iOS app (Expo Go does NOT work — native deps require a dev client)
cd mobile && npx expo start --dev-client
```

`mobile/README.md` has the full native build sequence.

---

## 10. State as of 2026-09-07

**All gates green**: web 347 tests, shared 48, mobile 377, TypeScript clean in all three workspaces (the only lint output is 6 pre-existing `<img>` warnings on dashboard pages).

**Everything is uncommitted, on branch `fix/ios-design-audit`.** Nothing was pushed. Review with `git status --short` and `git diff`.

Changed today (audit findings in brackets):
- **Account deletion now does what it says.** Device rows are deleted in the same transaction as the anonymization, so a deleted user's phone stops receiving pushes; the Clerk identity is deleted *first* and a Clerk failure returns 502 instead of a false success; Stripe pointers are cleared; a payout in flight returns 409 behind a single flag awaiting Jackson's policy call. The logic is shared with a new `user.deleted` Clerk webhook handler so a deletion started at Clerk also reaches the database. `app/api/_lib/account-deletion.ts`, `app/api/v1/me/route.ts`, `app/api/webhooks/clerk/route.ts`. [API-07, API-08, LEGAL-04/05/07, SEC-09/10, PUSH-11]
- **The app tells the truth about deletion** — copy now describes anonymization instead of promising permanent deletion. [LEGAL-03, PARITY-04]
- **Legal links in the app**: privacy, terms and support in Profile, which App Review checks for. [PARITY-03, STORE-11]
- **The app survives a render crash.** `AppErrorBoundary` wired into both the root and tab layouts — expo-router only installs a boundary when a route exports one by that exact name, so this was silently absent. [QUAL-01]
- **Mutations are never retried** (they are all non-idempotent, and a retry after a lost response duplicates an application), requests time out at 15s, and 401s are handled centrally. [AUTH-04/05/06]
- **Discover filters server-side and pages properly** instead of filtering the first 20 rows in JavaScript. [QUAL-03]
- **`/api/v1` returns a real 401 again.** The namespace was not in `proxy.ts`'s public-route list, so Clerk's `auth.protect()` answered an unauthenticated API call with a 307 to `/sign-in` (dev) or an HTML 404 rewrite (prod) — never the JSON envelope the app is written against, which meant an expired session surfaced as a permanent "couldn't load" with no way to re-authenticate. `/api/v1(.*)` and `/api/uploadthing(.*)` are now public *to the middleware only*: every route still enforces its own Bearer-only guard, and each was checked individually before the change. Every 401 now carries `WWW-Authenticate: Bearer`. Verified against a running dev server, not just in tests. [API-01, SEC-03, AUTH-03, API-11, PUSH-02, LOOP-04]
- **Three security fixes (2026-09-07, second pass).**
  - *Waitlist enumeration and overwrite* (`SEC-02`): `POST /api/waitlist` is public and takes any email, and it used to answer with that person's full row — name, handle, niche, follower range, status, referral count, referrer, and their **referral code and link**, which is the credential that attributes signups. Anyone could enumerate the list by address, and a second `step: 'profile'` post overwrote a stranger's profile. Now an address already on the list gets `{success, existing, profileComplete}` and nothing else, a completed profile is never overwritten, and the two cases are byte-identical so the response cannot be used as an oracle. The form shows an "already on the list, check your email" screen instead of echoing a link it cannot prove ownership of. Follow-up worth doing: a "resend my referral link" action that emails it — deliberately not auto-resent here, which would make this endpoint an email-bomb vector.
  - *`contentUrl` on the legacy web route* (`SEC-12`, `PUSH-05`): the H-3 hardening reached `/api/v1` only, so `POST /api/submissions` still validated with a bare `z.string().url()` and accepted `javascript:`, `data:` and any host — while the brand dashboard renders that value as an `href`. It now shares `contentUrlSchema` with the mobile route, and both brand render sites check the stored value before linking it, since rows written before the fix are still in the database.
  - *Per-route rate-limit budgets* (`API-02`): every authenticated v1 route shared one counter per user while limits ranged from 60/min to 5/min, so the lowest limit won — six campaign fetches at app launch consumed the budget and the creator's first tap on "Connect Stripe" or "Delete account" returned 429. Buckets are now per method and route, with resource ids collapsed so a caller cannot mint a fresh bucket by varying the id.
- **The authorization matrix exists (`API-05` / W2-11).** `tests/api-v1-authz-matrix.test.ts` — 142 assertions running **the real guard** against all 18 exported v1 handlers, called the way Next.js calls them. Every per-route test in `app/api/v1/**` opens by replacing the guard with a passthrough, which is precisely why the two worst defects in the audit survived a green suite. For every endpoint it asserts: no credentials → 401 + challenge, non-Bearer scheme → 401, cookie-only → 401, unverifiable token → 401, verified identity with no row → 401, wrong role → 403, another creator's row → **404 not 403**, and 429 with `Retry-After`. Mutation-tested to prove it bites: deleting the Bearer check fails 54 assertions, turning one 404 into a 403 fails 2.
- **CI is real now (`PROC-03`, `OPS-11`, `DEPS-05/06`).** It had never executed a single run — nothing was ever pushed — and it pinned Node 22 while Vercel runs 24 and this laptop runs 25. Now: Node pinned once in `.nvmrc` (24, matching Vercel) and read by every job via `node-version-file`, plus an `engines` field; **web typecheck added, which was missing from CI entirely** (mobile had it, the Next.js app did not); `prisma validate`; a schema/migration pairing check on PRs; and `npm audit` gating on critical. Every step was run locally first and passes, and `npm ci --dry-run` confirms the new `engines` field does not desync the lockfile — worth checking, because CI's first ever run happens on your first push. `.github/dependabot.yml` groups weekly bumps and excludes majors for stripe, expo, react-native, next and react, which each need a migration guide and a build check rather than a merge.

  Two deliberate omissions, both explained inline in the workflow. **No `next build`:** Vercel already builds every PR and push with real secrets, the original CI decision to skip it was deliberate, and a CI build with fabricated env can mask exactly the failures it claims to catch. **No `prisma migrate diff` drift check:** with `--from-migrations` it replays into a shadow database derived from `DATABASE_URL`, and every environment here points at the one production Neon instance — a drift check that can touch production is worse than none. The pairing check (schema edited without a migration → PR fails) covers the failure that actually matters, needs no database, and was tested against five cases including the empty diff.
- **App Review dossier written (`STORE-13`, `PAY-06`, W4-6/W8-8):** `docs/platform-split/09-app-review-dossier.md`, 852 lines. Built by five researchers working from the code, then fact-checked against the repo and stress-tested by a simulated hostile reviewer — that pass caught **14 false claims in the first draft** (wrong file:line citations, an ATS claim that contradicted `Info.plist:41-47`, a "no contradiction" verdict on privacy copy that was in fact a contradiction) and added 14 missing items. It carries paste-ready App Review Notes, the deletion matrix, nutrition-label answers, the reviewer seeding checklist, and a register of **8 blockers / 23 open risks**.

  It surfaced four things the 2026-09-06 audit missed, all verified independently: **an account a reviewer creates cannot be deleted in-app** — `DELETE /api/v1/me` is wrapped in `withMobileApi`, which 401s when no `User` row exists (`lib/mobile-api-guard.ts:163-164`), so a Clerk identity blocked at NOT_INVITED can sign in forever and never delete itself, which is a direct 5.1.1(v) failure; **the app tells the reviewer it is an internal test in four places** they will reach (Guideline 2.2); **no report/block control anywhere** while brand-authored campaign text is displayed to every creator (`discover/[id]/index.tsx:72,99`), which is Guideline 1.2 territory; and **the privacy policy contradicts the nutrition labels** — it claims "basic usage data" while the labels say Usage Data = No, and never mentions push tokens while the labels declare a Device ID.
- **PII inventory written (`W5-C`):** `docs/platform-split/pii-inventory.md`, 610 lines, **80 data elements** and **33 gaps**. Four researchers mapped the Postgres columns, the 12 subprocessors, collection/transmission points, and retention/rights readiness; a fact-checker and a completeness-checker then found **10 false claims** and **24 missing elements**, all independently re-verified before correction. It is the direct input to rewriting `app/privacy/page.tsx`, filling the DPA annexes, and resolving the policy-vs-nutrition-label contradiction.

  **It found a live data leak.** `app/api/applications/[id]/route.ts:51-53` fetches the application with `include: { creator: true }` — the whole `User` row — and line 66-67 returns it verbatim to the brand when the PATCH is a no-op (same status in as out). So any brand can PATCH an application on their own campaign with its current status and receive that creator's `email`, `bio`, `clerkId` and `stripeAccountId`. The last two are precisely the fields the `/api/v1` contract refuses to expose, and `stripeAccountId` is a Stripe Connect identifier. Verified by reading the route directly. **Not yet fixed** — it is a code change and this task was a document. The fix is a `select` allow-list on that route, mirroring what v1 already does.

  Three erasure gaps rated blocker, all confirmed by absence of any code path: the entire `WaitlistSubmission` model has **no deletion route at all** (only four `delete` calls exist repo-wide and none touch it); four free-text fields authored by or about a departed creator (`Application.pitch`, `Submission.caption`, `.notes`, `.reviewNote`) survive account closure and stay readable to the brand, which the audit-trail justification does not cover; and uploaded media is never deleted, since no `UTApi`/`deleteFiles` call exists anywhere.
- **`lib/env.ts`**: Zod-validated environment with production-required variables and a Stripe key-mode check. Nothing runs at import time, so builds without secrets still work. [SEC-07]
- **Five runbooks** in `docs/runbooks/` — deploy, migrate, rollback, incident, secrets. Read deploy.md before the first push.
- **README and mobile/README rewritten** — the old root README described a product that no longer exists and told you to run a command that would reset the production database.

**Not done, and why.** The remaining audit items are either blocked on Jackson (see `BLOCKED-ON-JACKSON.md`) or were assigned to subagents that usage limits killed mid-run. Each of these is fully specified in the audit and ready for a fresh session to pick up:

| Item | Audit ids | Notes |
|---|---|---|
| Dependency bumps | DEPS-01/02 | `next@16.3.4` closes 9 advisories including a proxy bypass; `@clerk/clerk-expo` ≥ 2.20 closes an authorization bypass. Left undone because a bump wants a full verification pass behind it, including `next build`. |
| Parity checklist | W8-1 | Pure writing, no decisions needed. Gates the creator-web sunset. (PII inventory: done 2026-09-07.) |
| Legal drafts | LEGAL-01/10/11 | Blocked on entity name, age floor and venue anyway (blockers #13/#14). |

## 11. Where to look

| Question | File |
|---|---|
| What needs doing before launch? | `docs/production-readiness-2026-09-06.md` |
| What needs Jackson? | `docs/BLOCKED-ON-JACKSON.md` |
| How do I deploy / migrate / roll back? | `docs/runbooks/` |
| Why is the product split in two? | `docs/platform-split/00-MASTER-PLAN.md` |
| What may I not build on creator web? | `docs/platform-split/creator-web-freeze.md` |
| What blocks the iOS build? | `mobile/RELEASE-CHECKLIST.md` |
| What does the mobile API promise? | `docs/platform-split/02-mobile-api.md` |
| What is the security bar? | `docs/platform-split/05-security.md` |
