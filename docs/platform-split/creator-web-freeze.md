# Creator Web Freeze

**Status:** in force from the merge of W7 (`07-brand-web-refocus.md`, task W7-3).
**Audience:** anyone — human or agent — about to write code under `app/(dashboard)/creator/*`.

## The rule

**No new creator-facing web features. Bug fixes only.**

New creator capability ships in the iOS app (`mobile/`, W3) against the `/api/v1`
contract. The creator web dashboard is in run-out: it is being retired in W8, and
work invested there is work thrown away.

## What is frozen

| Area | Status |
|---|---|
| `app/(dashboard)/creator/*` pages | Frozen. Bug fixes only. |
| `app/api/applications` POST, `app/api/submissions` POST (web/session-auth) | Frozen, and gated by `CREATOR_WEB_MODE` (below). |
| Creator-facing web copy, empty states, nav | Frozen. Do not polish. |
| Creator onboarding on web | Frozen. |

## What is *not* frozen

- **`/api/v1/*`** — the mobile contract. This is where creator features go now.
- **`mobile/`** — the iOS app.
- **`/brand/*`** — the web product core, actively developed (W7-1/W7-2).
- **`/internal/*`** — admin, web-only forever.
- **`/privacy`, `/terms`, `/support`** — creator-facing legal/support pages stay
  on the web permanently; the app links out to them.
- **`/creator/settings`** — see the Stripe carve-out below. Not a feature area,
  but it must keep working.

## The flag: `CREATOR_WEB_MODE`

Implemented in `lib/creator-web-mode.ts`, tested in `lib/creator-web-mode.test.ts`.
Server-evaluated from the environment only — never read or trusted from a client.

| Value | Creator dashboard renders | Creator mutations | Notes |
|---|---|---|---|
| `full` | yes | allowed | Today's behavior, unchanged. |
| `readonly` | yes | **403** `Manage this in the CreatorDocks iOS app` | Transition safety valve (W8-13). |
| `sunset` | redirects to `/get-the-app` | **403** | End state. |

**Unset or invalid values resolve to `sunset`.** This is deliberate: a typo must
not silently reopen creator web. Note it inverts the "default `full`" line in
`07-brand-web-refocus.md` — the product decision superseded the doc.

> ⚠️ **Operational consequence.** Any environment that still wants a working
> creator dashboard must set `CREATOR_WEB_MODE=full` explicitly — production,
> preview, and local `.env.local`. Deploying without it is the sunset flip.

The flip itself belongs to W8-13 (`08-release-qa-sunset.md`): `full` →
`readonly` for 2–4 weeks → `sunset`. Reverting is one env change, no deploy.

### Enforcement is server-side

Per the W5 security requirement carried into W7: hiding buttons is not enough.
Write handlers call the guard directly and return before touching the database:

```ts
const creatorWebGate = creatorWriteBlockedResponse()
if (creatorWebGate) return creatorWebGate
```

Any new creator write path on web must call this guard. There is no client-side
equivalent and there should not be one.

## Carve-out: `/creator/settings` stays reachable in every mode

Stripe Connect onboarding sends creators back to `/creator/settings` —
`return_url` and `refresh_url` in both `app/api/stripe/onboard/route.ts` and
`app/api/v1/stripe/onboard/route.ts`. Redirecting that path would strand a
creator mid-onboarding and break payout setup, so it is exempt from the sunset
redirect (`SUNSET_EXEMPT_CREATOR_PATHS` in `lib/creator-web-mode.ts`).

**Remove the exemption only after those Stripe URLs point somewhere else** — a
dedicated return route, or a deep link back into the app.

### Known limitation: pathname resolution

App Router layouts cannot read the request pathname (Next 16 `layout.md`:
"Layouts do not re-render on navigation, so they do not access pathname"), and
`app/(dashboard)/creator/layout.tsx` is the only file wrapping every creator
route. The layout therefore recovers the path from request headers, in order:
`x-pathname`, `x-matched-path` (set by Vercel on every invocation), `next-url`.

When none resolve — notably under plain `next dev` — the resolver **does not
redirect**. Failing open costs a missed redirect; failing closed risks breaking
Stripe onboarding, and writes are blocked in `sunset` regardless, so the redirect
is a UX affordance rather than a security boundary.

**Follow-up (one line, not done here):** have `proxy.ts` forward the pathname as
`x-pathname` on every request. That makes the redirect deterministic in every
environment including local dev, and removes the client-spoofable fallbacks.

## The landing page

`app/get-the-app/page.tsx` is where sunset-mode creators land and where the
brand-first site points creators.

- CTA is waitlist capture (`/waitlist`) until **`NEXT_PUBLIC_IOS_APP_URL`** is
  set; then it renders an App Store button instead.
- Safari's smart banner (`apple-itunes-app`) is emitted only when
  **`NEXT_PUBLIC_IOS_APP_ID`** is set, via Next's `metadata.itunes`.
- Both are `NEXT_PUBLIC_*`, so they are inlined at build time — setting them
  requires a redeploy, not just an env change.

**Open item:** `/get-the-app` is not in `proxy.ts`'s `isPublicRoute` list, so it
currently requires sign-in. It must be added before the page is useful publicly.
