# Deploy runbook

**Read this whole page before you push to `main`.** The single most important fact
in this repository's operations:

> ## `git push origin main` IS A PRODUCTION DEPLOY.
>
> Vercel is connected to `github.com/Beachbroski/CoreLoop` (project `coreloop`,
> `.vercel/project.json`) and auto-deploys every push to `main` straight to
> Production. There is no manual "promote to prod" step in front of it. If you
> push to `main`, whatever is in that commit is live on
> `https://www.creatordocks.com` within a few minutes.

As of 2026-09-07, local `main` is **47 commits ahead of `origin/main`** and
nothing has been pushed. Production is still running the July code. That is a
grace period, not a permanent state — the moment someone pushes, all 47 commits
(mobile API, brand product, sunset machinery, everything) go live at once,
against whatever the Vercel environment happens to contain at that moment.
**Do not push until the checklist below is actually true**, not "true after the
next step."

See `docs/production-readiness-2026-09-06.md` §6 for the full sequenced plan
this checklist is extracted from (Phase 0, items 0.4–0.6).

---

## 1. Pre-push checklist

Work through this in order. Do not skip to "push" because earlier items feel
done — verify each one live, in the Vercel dashboard or CLI, not from memory of
having set it once.

### 1.1 Every required env var is present in Vercel **Production**

Pull the live values and check lengths/presence — never print the values
themselves:

```bash
vercel env pull .env.vercel-check --environment=production
grep -c '^[A-Z_]*=.\+$' .env.vercel-check   # sanity count, not a value dump
rm .env.vercel-check                        # do not leave this on disk
```

Or `vercel env ls production` for presence/metadata without pulling values.

As audited on 2026-09-06, this is the state of Production (🔴 = blocks a
launch, 🟡 = wrong but non-blocking, 🟢 = fine):

> ⚠️ **`vercel env pull` cannot read a "Sensitive" variable.** Vercel has two variable types: `encrypted` (the CLI and dashboard can read it back) and `sensitive` (write-only — it reaches builds, but every read returns an empty string). The plain `vercel env ls` output labels **both** as "Encrypted", so an empty value in a pulled file means *either* genuinely unset *or* set-and-write-only. To tell them apart:
>
> ```bash
> vercel env ls --format json | python3 -c "import json,sys;raw=sys.stdin.read();d=json.loads(raw[raw.find('{'):]);[print(f\"{e['key']:<38}{e.get('type')}\") for e in d.get('envs',[])]"
> ```
>
> As of 2026-09-07 the sensitive ones are `STRIPE_WEBHOOK_SECRET`, `TURNSTILE_SECRET_KEY` and `NEXT_PUBLIC_TURNSTILE_SITE_KEY`. The 2026-09-06 audit read all three as "empty" and it could not have known better from a pull alone — `STRIPE_WEBHOOK_SECRET` was in fact simply unset at the time, and Turnstile was independently confirmed unconfigured by loading the live waitlist page (the widget does not render and carries no sitekey). Verify in the dashboard before acting on a blank value.

| Variable | State on 2026-09-06 | Needed value |
|---|---|---|
| `DATABASE_URL` | 🟢 set | Neon connection string — same DB as local/preview (see `migrate.md`) |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` | 🟢 set, live-mode | unchanged |
| `CLERK_WEBHOOK_SECRET` | 🟡 set, but same shape as the dev secret — verify it's the *production* endpoint's secret in the Clerk dashboard | confirm before relying on it |
| `NEXT_PUBLIC_CLERK_*_URL` (4 vars) | 🟢 set | unchanged |
| `STRIPE_SECRET_KEY` | 🟢 set 2026-09-07 — live-mode key (`sk_live_`, 107 chars) | live Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | 🟢 set 2026-09-07 — endpoint `CreatorDocks production webhook`, 7 events, API version 2026-04-22.dahlia. Stored as Vercel **Sensitive** type, so `vercel env pull` returns it blank *by design* — that is not a missing value | secret for the endpoint at `https://www.creatordocks.com/api/webhooks/stripe`, subscribed to the six handled events (see `app/api/webhooks/stripe/route.ts`) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | 🟢 set 2026-09-07 — live-mode key (`pk_live_`, 107 chars) | live Stripe publishable key |
| `TURNSTILE_SECRET_KEY` | 🔴 **empty string** | Cloudflare Turnstile secret for a widget created for `www.creatordocks.com` (+ apex) |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | 🔴 **empty string** | matching Turnstile site key |
| `RESEND_API_KEY` | 🔴 **14-char placeholder**, not a real key | real Resend API key, `creatordocks.com` domain verified (SPF/DKIM/DMARC) |
| `EMAIL_FROM_ADDRESS` | 🟢 unset is fine (defaults to `CreatorDocks <notifications@creatordocks.com>`) | leave unset unless overriding |
| `UPLOADTHING_TOKEN` | 🟢 set 2026-09-08 (encrypted). The dead v6 names (`UPLOADTHING_SECRET`, `UPLOADTHING_APP_ID`) have been deleted from every environment. Note this is **Production only** — Preview and Development carry no UploadThing config, and `.env.local` still holds the old v6 pair with no token, so local uploads still fail | nothing for production; add the token to `.env.local` (and drop the two dead lines) before testing uploads against `localhost:3000`, which is what the iOS app calls |
| `CREATOR_WEB_MODE` | 🔴 **missing** → resolves to `sunset` | `full` — see the boxed warning below, this is the single most consequential flag on this list |
| `MARKETPLACE_ACCESS` | 🔴 missing → resolves to `invite` (allowlist decides) | `invite` for the first deploy. Flip to `open` **only after** the Stripe vars above are live and one real payment has completed end to end — Jackson chose open self-serve on 2026-09-07, but a brand who can sign up and cannot be charged is worse than one who was never let in. Note it also opens iOS account creation, which shares the same allowlist. |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` (or `KV_REST_API_URL`/`KV_REST_API_TOKEN`) | 🔴 **missing** — rate limiting has no durable backend | provision Upstash Redis via the Vercel Marketplace |
| `MOBILE_MIN_SUPPORTED_VERSION` | 🔴 missing (defaults to `1.0.0` in code, but set it explicitly) | `1.0.0` |
| `MOBILE_LATEST_VERSION` | 🔴 missing | `1.0.0` |
| `MOBILE_MAINTENANCE_MODE` | 🔴 missing | `false` |
| `TESTER_ALLOWED_EMAILS` | 🔴 **missing** | brand/creator tester emails + the App Review demo account, comma-separated |
| `ADMIN_ALLOWED_EMAILS` | 🟢 set | unchanged |
| `NEXT_PUBLIC_URL` | 🟢 set to `https://www.creatordocks.com` | unchanged |
| `NEXT_PUBLIC_IOS_APP_URL` / `NEXT_PUBLIC_IOS_APP_ID` | 🟢 correctly unset (no App Store listing yet) | leave unset until the app is approved — see Phase 3 of the audit |
| `DATABASE_POOL_MAX` | 🟢 unset is acceptable for now | consider setting once on Neon's pooled endpoint |
| `ADMIN_SECRET_PATH` | 🟡 set but dead code — remove it | delete |

This table is a snapshot from the 2026-09-06 audit. **Re-verify it live before
every deploy** — do not trust this file once any of these values have been
touched. `vercel env ls production` is the source of truth, not this table.

### 1.2 `CREATOR_WEB_MODE` is an explicit decision, not an accident

`lib/creator-web-mode.ts`: unset or invalid ⇒ `sunset`. Deploying with this
variable missing from Production **retires the entire creator web dashboard**
(`app/(dashboard)/creator/*` redirects to `/get-the-app`, all creator mutations
403) the instant the deploy finishes — see
`docs/platform-split/creator-web-freeze.md`.

Before this push, one of these two must be true:

- **`CREATOR_WEB_MODE=full`** is set in Vercel Production (and Preview, and your
  `.env.local`), and you intend creator web to keep working — this is the
  correct value until the platform-split plan reaches Phase 4, or
- You have deliberately decided to sunset creator web on this deploy, the W8-12
  gate conditions in `docs/platform-split/08-release-qa-sunset.md` are actually
  met (parity checklist green, ≥60% of monthly-active creators in the app, no
  open CRITICAL app bugs), and Jackson has signed off on it in writing.

If neither is true, **stop and set the variable** before continuing.

### 1.3 Database migrations are applied

The build script (`package.json`) is `prisma generate && next build` — it does
**not** run `prisma migrate deploy`. Migrations are applied by hand, to the one
shared Neon database, before the deploy that depends on them ships. Follow
`migrate.md` in full, in order: diff → status → (backup/branch) → deploy →
verify. Do this *before* pushing, not after — a deploy that expects a column
that doesn't exist yet will 500 on every request that touches it.

### 1.4 All quality gates are green, on this exact commit

```bash
npx vitest run                                  # web: 161 tests as of 2026-09-06
npx tsc --noEmit
npx eslint
npm run test --workspace=packages/shared        # 48 tests
cd mobile && npx tsc --noEmit && npx expo lint && npx jest   # 374 tests
```

CI (`.github/workflows/ci.yml`) mirrors most of this but **has never actually
run** (0 executions — nothing has ever been pushed to trigger it), pins Node 22
while Vercel runs Node 24 and local dev runs 25, and never runs `next build` or
`prisma validate`. Don't rely on a green CI check existing yet — run the
commands above yourself.

### 1.5 Feature branch → Preview → smoke test, before `main`

Never push straight to `main` for anything non-trivial. Push the feature branch
first:

```bash
git push origin <branch-name>
```

Vercel builds a **Preview** deployment for it automatically (protected by
Vercel Authentication — you'll need to be signed into the right Vercel team to
view it). On that Preview URL, smoke test at minimum:

- `/` loads (brand-first landing page)
- `/get-the-app` loads (requires it to be in `proxy.ts`'s public route list —
  see `creator-web-freeze.md`'s "Open item")
- `/sign-in` loads and completes a sign-in
- `GET /api/v1/meta` returns `{"success":true,"data":{...}}` (see §3 below)

Preview today does **not** have its own database, Stripe, Resend, or
UploadThing config, and (as of the 2026-09-06 audit) carries **live** Clerk
keys — anything that touches the DB or a paid vendor on Preview is hitting
production-shaped keys against no or the wrong backing service. Don't run a
real money flow on Preview until `docs/production-readiness-2026-09-06.md`
H14 / Q-P11 (a proper staging environment) is resolved. A plain page-load smoke
test is still worth doing — it catches build breaks and env-driven 500s before
they reach real traffic.

---

## 2. Deploy steps

Once every box in §1 is genuinely checked:

```bash
git checkout main
git merge --ff-only <branch-name>   # or open a PR and merge it — either way, no --no-verify, no force
git push origin main
```

That push **is** the production deploy. Watch it:

```bash
vercel ls coreloop --prod            # or: watch the Vercel dashboard deployments tab
vercel inspect <deployment-url> --logs
```

There is no separate "promote" step. If the build fails, Production keeps
serving the previous successful deployment (Vercel's default behavior) — see
`rollback.md` if you need to force that explicitly.

---

## 3. Post-deploy verification

Run these against the real production domain immediately after the deploy
finishes. Do this every time — a green build does not mean the runtime env is
correct (empty env vars fail at request time, not build time).

```bash
curl -s https://www.creatordocks.com/ -o /dev/null -w '%{http_code}\n'
# expect: 200

curl -s https://www.creatordocks.com/api/v1/meta
# expect: {"success":true,"data":{"apiVersion":"v1","minSupportedAppVersion":"1.0.0","latestAppVersion":"1.0.0","maintenanceMode":false}}
# if maintenanceMode is true or the version fields are wrong, MOBILE_* env vars are misconfigured

curl -s https://www.creatordocks.com/get-the-app -o /dev/null -w '%{http_code}\n'
# expect: 200 (not a redirect to /sign-in — that would mean the public-route fix from B7 hasn't shipped)

curl -s -X POST https://www.creatordocks.com/api/v1/applications -o /dev/null -w '%{http_code}\n'
# expect: 401 with a JSON body (curl -i to see it) — NOT a 307 redirect and NOT an HTML 404.
# A 307/404 here means the /api/v1 proxy public-route fix (B7) is missing and the
# mobile app's 401 handling will never fire.
```

Then, manually:

- Submit the waitlist form once on the live site. A working submission proves
  Turnstile (`TURNSTILE_SECRET_KEY`/`NEXT_PUBLIC_TURNSTILE_SITE_KEY`) and
  Resend (`RESEND_API_KEY`) are both actually live, not just present. (Before
  the env fix in §1.1, this form fails closed — Turnstile has no keys.)
- Check the Vercel Runtime Logs (Project → Logs, or `vercel logs coreloop --prod`) for
  the few minutes after deploy for unhandled exceptions. Retention is 1 hour on
  the Hobby plan — see `incident.md` for what that means in practice.
- If this deploy touched `CREATOR_WEB_MODE`: sign in as a creator tester and
  confirm the dashboard behaves as intended (renders + mutations allowed in
  `full`, 403 + redirect in `sunset`).
- If this deploy touched Stripe: check the Stripe dashboard's webhook logs for
  the production endpoint — confirm signed events are being accepted (200s),
  not failing signature verification.

---

## 4. When to roll back

Roll back immediately, don't try to hot-fix forward, if any of these are true
right after a deploy:

- The homepage or `/api/v1/meta` is erroring (5xx) for real traffic.
- Vercel Runtime Logs show exceptions on a hot path (sign-in, apply, webhook
  handlers) rather than isolated edge cases.
- A Stripe webhook is failing signature verification in the Stripe dashboard
  (means `STRIPE_WEBHOOK_SECRET` doesn't match the live endpoint).
- `CREATOR_WEB_MODE` flipped in a way that wasn't intended (creator web
  unexpectedly sunset, or unexpectedly reopened).

See `rollback.md` for the actual mechanics (Vercel instant rollback vs. an env
revert vs. the mobile-specific levers). The short version: a **code** problem
rolls back instantly and for free in the Vercel dashboard; an **env** problem
needs a new deploy to take effect even after you fix the variable.
