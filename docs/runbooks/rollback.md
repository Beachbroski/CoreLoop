# Rollback runbook

Four separate rollback stories, because "roll back" means something different
depending on what broke. Read the section for what actually broke — don't
default to the web one just because it's first.

---

## 1. Web: bad code in a deploy

Vercel keeps every previous successful deployment and can point production
traffic at one of them instantly — this does **not** rebuild anything, it just
repoints the alias, so it takes effect in seconds.

```bash
vercel ls coreloop --prod              # list recent production deployments
vercel rollback <deployment-url>       # or use the "Instant Rollback" button
                                        # on that deployment in the dashboard
```

This is safe to reach for quickly — it's fast, free, and reversible (you can
roll forward again the same way once the fix is ready). Do it as soon as you
see the "when to roll back" signals in `deploy.md` §4 rather than trying to
hot-fix forward under pressure.

**What an instant rollback does NOT undo:**
- **Database migrations.** If the bad deploy included a `prisma migrate
  deploy` that changed the schema, rolling back the *code* does not roll back
  the *schema* — the old code now runs against a newer schema than it expects.
  Check `prisma migrate status` after a code rollback; if a migration shipped
  with the bad deploy, you likely need the compensating-migration path in
  `migrate.md` too, not just a code rollback.
- **Anything already sent** — emails, pushes, Stripe charges made during the
  bad deploy's window are real and already happened.

## 2. Env var / feature flag revert

Some fixes are "change a Vercel env var back," not "roll back code." The
critical fact here: **an environment variable change does not take effect
until the next deployment.** Vercel does not hot-reload env vars into a
running deployment. So:

```bash
vercel env rm <VAR_NAME> production      # or vercel env add to change it —
                                          # see the HARD RULES in the task
                                          # brief: only run this if you are the
                                          # agent explicitly told to, otherwise
                                          # tell Jackson what to change and why
```

then **redeploy** — either `vercel redeploy <deployment-url>` (rebuilds and
re-applies the current code with the new env) or an empty commit pushed to
`main` (which is a real deploy — see `deploy.md`'s opening warning). There is
no faster path for an env-only fix; budget for a full deploy cycle, not an
instant flip.

**Exception — flags that are read at request time, not build time:**
`CREATOR_WEB_MODE` and the `MOBILE_*` variables are read from
`process.env` inside route handlers on every request, not inlined at build
time (they are not `NEXT_PUBLIC_*`). In principle that means a bare env change
plus Vercel's own env-propagation to the running deployment could apply
without a full rebuild — but this has not been verified on this project (see
the audit's guess list: "Vercel picking up env changes only on the next
deployment is assumed from Vercel docs, not tested"). Treat "change the env
var, then redeploy to be sure" as the reliable path until someone confirms
otherwise. `NEXT_PUBLIC_*` vars (Clerk redirect URLs, the Stripe publishable
key, `NEXT_PUBLIC_IOS_APP_URL`/`_APP_ID`) are inlined at build time and
**always** need a redeploy, no exception.

The specific case this matters most for: if a deploy accidentally sunsets
creator web (missing `CREATOR_WEB_MODE`), reverting is "set
`CREATOR_WEB_MODE=full` in Vercel Production, then redeploy" — not
instantaneous, but cheap and well-understood
(`docs/platform-split/creator-web-freeze.md` calls this out explicitly: "one
env change, no deploy" is the aspiration in `08-release-qa-sunset.md`'s
rollback table, but until env-without-redeploy is actually verified, plan for
the redeploy).

## 3. API regression affecting the mobile app

`/api/v1` is a versioned, Bearer-token contract that old app builds depend on.
The standard web instant rollback (§1) is the fix here too — old mobile app
builds keep working against the previous deployment's contract as long as the
contract itself didn't change shape in a backward-incompatible way. If it did
(a field renamed or removed, not just added), an instant rollback of the *web*
deployment is still the first move; a shape change that already shipped to
installed app builds is a harder problem addressed by the mobile-specific
levers below, not by this section.

## 4. Mobile: the honest story

Read this section fully before assuming any of these exist — several are
aspirational in `docs/platform-split/08-release-qa-sunset.md`'s rollback table
and are **not actually available today** (2026-09-07).

### What does NOT exist yet

- **No OTA / EAS Update.** `08-release-qa-sunset.md`'s rollback table lists
  "Bad JS bug in production app → EAS Update (OTA) — minutes" as the response.
  **`expo-updates` is not installed** (confirmed: absent from
  `mobile/package.json` and the root `package.json`'s dependency list, and
  flagged explicitly in `docs/production-readiness-2026-09-06.md` H11 — "no
  `expo-updates` (the documented OTA rollback path does not exist)"). There is
  no runtime version policy, no update channel, nothing to push an OTA update
  to. If a JS-only bug ships in a build, there is currently no way to fix it
  without a new App Store submission and review cycle. **Do not tell anyone —
  Jackson, a beta tester, or yourself under pressure — that "we can just push
  an OTA fix." We cannot, until H11 is implemented.**
- **No crash reporting.** No Sentry or equivalent in the mobile app (see
  `incident.md`) — you will not get a stack trace or a crash-free-rate signal
  for a bad native build; you'll find out from App Store reviews, TestFlight
  feedback, or Jackson's own device.

### What DOES exist today as mobile levers

Two env-driven switches on the web API that the app reads on every launch via
`GET /api/v1/meta` (`app/api/v1/meta/route.ts`):

- **`MOBILE_MAINTENANCE_MODE=true`** — the app's maintenance-mode UI takes
  over. Use this to stop the bleeding (e.g. a backend incident making every
  app screen fail) while you fix the server side. This is a Vercel env change
  + redeploy (§2 above), not instant, and it affects every app user
  immediately once it propagates — use it deliberately, not as a first
  reflex.
- **`MOBILE_MIN_SUPPORTED_VERSION`** — bump this above the version of the bad
  build and the app's version gate refuses to let that build proceed past its
  startup check, forcing users toward whatever version you set as
  `MOBILE_LATEST_VERSION`. This only helps if a *newer, fixed* build already
  exists and has cleared App Store review — it cannot conjure a fix into
  existence, it can only steer users away from a known-bad version once a
  good one is available. `mobile/RELEASE-CHECKLIST.md` and
  `docs/production-readiness-2026-09-06.md` H16 both flag that
  `expo.extra.appStoreUrl` (where the gate sends users) is not filled in yet
  either — confirm that's set before relying on this.

- **Expedited App Store review.** For a bad *native* bug (not fixable by
  maintenance mode or the version gate alone, e.g. a crash on launch), Apple's
  expedited review request is the only path to get a fix in front of users
  faster than the normal review queue. This takes hours to a day or two, not
  minutes — it is not a substitute for OTA, it is what you use because OTA
  doesn't exist. Request it from App Store Connect ("Request Expedited
  Review") and be ready to explain the severity.

### Net effect

Until `expo-updates` is added (tracked as H11), the realistic mobile incident
response is: **maintenance mode or the version gate to stop new damage,
expedited App Store review to actually ship a fix, and no way to patch an
already-installed bad build's JS in place.** Size mobile releases and QA
accordingly — the cost of a bad native release is measured in review-queue
days, not minutes, until this gap closes.
