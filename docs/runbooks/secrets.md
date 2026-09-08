# Secrets runbook

## Where each secret lives

### Vercel environment variables (web)

Every server-side secret the web app uses lives in Vercel's environment
variables, scoped per environment (Production / Preview / Development). List
what's present (never dump values) with:

```bash
vercel env ls production
vercel env ls preview
```

Full inventory, purpose, and current state as of 2026-09-06 (which of these
are empty/placeholder in Production) is in `deploy.md` §1.1 — that table is
the canonical reference for "what should be set and to roughly what," this
section is about *how secrets get there and rotated*, not the current values.

Categories, by vendor:

| Vendor | Vars | Notes |
|---|---|---|
| Clerk | `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_WEBHOOK_SECRET` | Publishable key is intentionally public (`NEXT_PUBLIC_*`, shipped to the browser). Secret key and webhook secret are not. |
| Stripe | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Same public/secret split as Clerk. Live vs test mode must match `VERCEL_ENV` — there's no runtime assertion of this yet (M2 in the audit). |
| Cloudflare Turnstile | `TURNSTILE_SECRET_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Site key is public by design (it's embedded in the widget). |
| Resend | `RESEND_API_KEY` | Server-only. |
| UploadThing | `UPLOADTHING_TOKEN` (v7 — the SDK installed here reads only this name; the v6 names `UPLOADTHING_SECRET`/`UPLOADTHING_APP_ID` present in Production as of 2026-09-06 are dead and should be removed, not rotated) | Server-only. |
| Neon | `DATABASE_URL` | Contains a Postgres password inline. Server-only, and — see `migrate.md` — this is the **one shared database** for local, preview, and production, so this "secret" is also the single point where an environment boundary doesn't exist yet. |
| Upstash | `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` (or `KV_REST_API_URL`/`KV_REST_API_TOKEN` if provisioned via Vercel KV naming) | Server-only, backs the rate limiter. |
| Internal / app config | `ADMIN_ALLOWED_EMAILS`, `TESTER_ALLOWED_EMAILS`, `ADMIN_SECRET_PATH` (dead, remove — see `deploy.md`), `CREATOR_WEB_MODE`, `MOBILE_MIN_SUPPORTED_VERSION`/`MOBILE_LATEST_VERSION`/`MOBILE_MAINTENANCE_MODE` | Not secrets in the credential sense, but still config that should not leak (`ADMIN_ALLOWED_EMAILS` is a list of real email addresses) and still lives in the same Vercel env var store. |

### Local `.env*` files

```
.env
.env.local
.env.production.local
```

All three exist on disk today and are all covered by `.gitignore`'s `.env*`
pattern — confirmed none are tracked in git. That's the correct state; keep it
that way. **Never remove `.env*` from `.gitignore`, never `git add -f` one of
these files, and never paste their contents into a commit message, a PR
description, a chat message, or this documentation.**

`.env.production.local` is worth calling out specifically: despite the name
suggesting "the local file for the production environment," it is a **local**
file on this machine that happens to hold values shaped like production
config. It is not synced anywhere and is not the same thing as Vercel's actual
Production environment variables — don't confuse editing this file with
changing what's deployed.

### Mobile: publishable-only values, nothing secret

`mobile/.env` exists locally (gitignored, same as the web `.env*` files) and
the app reads exactly two variables at runtime
(`mobile/src/lib/api-client.ts`, Clerk's `clerk-expo` setup):

- `EXPO_PUBLIC_API_URL`
- `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`

Both are `EXPO_PUBLIC_*` — Expo's convention for "this gets inlined into the
JS bundle and shipped to every device that installs the app." **Nothing with
`EXPO_PUBLIC_` in front of it is a secret once it ships** — treat it as public
the moment it's in a build, the same way `NEXT_PUBLIC_*` is public on the web.
This is why the mobile app never holds a Stripe secret key, a Clerk secret
key, or a database credential: there is no secure-secret-storage story for a
distributed app binary, so the design is "the app only ever holds a
publishable key and talks to `/api/v1`, which holds every real secret
server-side."

**The rule, stated plainly: nothing secret ever enters the mobile bundle.**
Before adding any new `EXPO_PUBLIC_*` variable, ask "would I be comfortable if
this value appeared in a decompiled APK/IPA on a stranger's laptop?" If not,
it belongs on the server behind `/api/v1`, not in the mobile env.

There is currently no delivery mechanism for setting these two values in a
built (TestFlight/App Store) app — `docs/production-readiness-2026-09-06.md`
B5 tracks adding `eas.json` build profiles with per-profile env. Until that
exists, these values only work in local Expo Go / dev-client runs, pointed at
`http://localhost:3000` or a tunnel.

## Rotation steps, per vendor

General principle for all of these: **generate/rotate the new credential
first, verify it works somewhere non-production if possible, then update
Vercel, then redeploy** (env vars need a redeploy — see `rollback.md` §2).
Don't revoke the old credential until the new one is confirmed live, to avoid
a self-inflicted outage.

- **Clerk** (`CLERK_SECRET_KEY`): Clerk dashboard → API Keys → roll the secret
  key. Update `CLERK_SECRET_KEY` in Vercel (all environments that should
  change), redeploy. Existing sessions are typically unaffected (Clerk
  validates sessions against its own service, not the secret key directly),
  but verify sign-in end-to-end right after.
  For `CLERK_WEBHOOK_SECRET`: rotate per-endpoint in Clerk's Webhooks settings
  — this is scoped to one endpoint, so confirm which endpoint (prod vs dev) a
  given secret belongs to before rotating (the audit flagged the prod and dev
  secrets as suspiciously same-shaped — resolve that ambiguity before
  rotating, not after).
- **Stripe** (`STRIPE_SECRET_KEY`): Stripe dashboard → Developers → API keys
  → roll the secret key (Stripe supports a grace period with both old and new
  keys valid — use it). Update Vercel, redeploy, confirm a test charge/webhook
  round-trips, then revoke the old key.
  For `STRIPE_WEBHOOK_SECRET`: rotating means creating a new signing secret
  for the specific webhook endpoint in Stripe's dashboard — this is
  per-endpoint, so confirm you're rotating the production endpoint's secret,
  not a Connect endpoint's, before overwriting the Vercel var (see B6 in the
  audit: there may need to be two separate webhook secrets, platform vs
  Connect).
- **Turnstile** (`TURNSTILE_SECRET_KEY`): Cloudflare dashboard → Turnstile →
  the widget → rotate secret. The site key
  (`NEXT_PUBLIC_TURNSTILE_SITE_KEY`) does not need rotation as a security
  measure (it's public) but must be regenerated together if you recreate the
  widget itself.
- **Resend** (`RESEND_API_KEY`): Resend dashboard → API Keys → create a new
  key, update Vercel, redeploy, revoke the old key. Domain verification
  (SPF/DKIM/DMARC for `creatordocks.com`) is separate from the API key and
  does not need re-doing on rotation.
- **UploadThing** (`UPLOADTHING_TOKEN`): UploadThing dashboard → regenerate
  the app token. Update Vercel, redeploy. Note the v6→v7 migration mentioned
  above is not a rotation, it's a one-time fix — do it as part of the next
  deploy per `deploy.md`, not as a "rotation."
- **Neon** (`DATABASE_URL`): Neon console → reset the role password (or create
  a new role). Because this is the one shared database across every
  environment, changing it means updating it everywhere at once —
  `.env.local`, `.env.production.local` (locally, by hand, never via a script
  that could log the value), Vercel Production, and Vercel Preview if it's
  been given its own value by then. Test a local connection before assuming
  Vercel picked it up.
- **Upstash**: Upstash console (or the Vercel Marketplace integration panel,
  if provisioned that way) → rotate the REST token. Update Vercel, redeploy.
  A brief rate-limiter outage during rotation fails open by design (see the
  audit's API-20: "fallback rate limiter fails open silently") — not ideal,
  but not a hard outage either.
- **Admin/tester allowlists** (`ADMIN_ALLOWED_EMAILS`,
  `TESTER_ALLOWED_EMAILS`): not a credential rotation, but treat changes with
  the same care — these are access-control lists, not just config. Update via
  Vercel env, redeploy, and confirm the intended person can (and an unintended
  person can't) reach `/internal/waitlist` or the marketplace dashboards
  afterward.

## If a secret leaks (committed, pasted somewhere, logged)

1. Rotate it immediately using the steps above — treat "might have leaked" the
   same as "definitely leaked." Don't wait to confirm exposure before acting.
2. If it was committed to git: rotating the credential is what actually
   neutralizes the leak (the old value in git history is worthless once
   rotated) — do not spend time trying to scrub git history as the primary
   response, though it's worth doing for hygiene once the credential is dead.
3. Check Vercel Runtime Logs and any place the value might have been printed
   (a `console.log` of a full request object, an error message that echoes
   config) — this repo's coding style forbids `console.log` in production code
   for exactly this class of reason; if you find one that logs a secret,
   remove it as part of the incident, not just the rotation.
4. This repository is **public** (`github.com/Beachbroski/CoreLoop`, confirmed
   via `gh repo view` in the audit, H8/Q-L5) with secret scanning and push
   protection currently **off**. Turning those on (GitHub → Settings → Code
   security) is a standing recommendation independent of any specific leak —
   do it once, don't wait for an incident to be the reason.
