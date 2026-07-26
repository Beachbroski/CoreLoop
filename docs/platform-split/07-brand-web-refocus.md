# W7 — CreatorDocks Web Becomes Brand-First

**Goal:** Reposition the web product around brands (the paying side) without breaking creator web before W8 says so. Mostly marketing/IA/copy work plus groundwork for the sunset — deliberately low-risk.

## Scope

### W7-1: Marketing site repositioning
- Landing page: brand-first messaging (find creators, launch campaigns, pay on results). Creators get a clear secondary path: "Creators → get the iOS app" (waitlist/App Store link once live).
- Waitlist logic: the current waitlist (creator-oriented, referral codes) becomes the **iOS app launch list** for creators; brand-side moves toward direct onboarding (or its own list until brand supply is ready — Jackson's call at implementation time; note the orphaned business-waitlist schema from the July drift cleanup was dropped, so a brand waitlist would be a fresh, deliberate migration this time).

### W7-2: Information architecture
- `/brand/*` remains the authenticated product core; audit brand dashboards for creator-centric copy leftovers.
- Post-login routing (`lib/post-login.ts` / `app/post-login`): brands → brand dashboard (unchanged); creators → creator dashboard still, **plus** a persistent, dismissible "CreatorDocks for iOS is coming/here" banner component (single component, easy to flip messaging at launch — this banner is the primary migration funnel for W8).
- Admin (`/internal/*`): unchanged, web-only forever. Gains read-only visibility into mobile-era data as W2/W6 land (devices registered, app adoption count) — small additive widgets, not a rebuild.

### W7-3: Creator web freeze policy
- From this doc's merge onward: **no new creator-facing web features.** Bug fixes only. New creator capability goes to the iOS app (W3).
- Add a short `docs/platform-split/creator-web-freeze.md` note listing what's frozen, so future contributors (and agents) don't accidentally invest there.

### W7-4: Sunset groundwork (build now, flip in W8)
- Feature flag / env var `CREATOR_WEB_MODE = full | readonly | sunset`:
  - `full` — today's behavior (default until parity).
  - `readonly` — creator dashboards render but mutations return a friendly "manage this in the iOS app" prompt (transition safety valve).
  - `sunset` — creator dashboard routes redirect to an App Store landing page.
- Implement the flag plumbing + the App Store landing page now; **flip only in W8.** Creator-facing legal/support pages (privacy, support) stay on web permanently — the app links to them.

### W7-5: SEO & comms prep
- App Store landing page with smart banner (`apple-itunes-app` meta), OG tags.
- Email templates (Resend) for the sunset sequence: "app is here" → "web dashboard becoming read-only on <date>" → "web dashboard retired." Drafted now, sent by W8 on its schedule.

## Security requirements (from W5)
- No changes to auth flows, origin checks, Turnstile, or admin guards in this workstream — it's IA/copy/flag work. Any PR here that touches `lib/request-security.ts`, `middleware`, or admin guards is out of scope and should be split out.
- The `CREATOR_WEB_MODE` flag is server-evaluated (env/Edge Config), never client-trusted — `readonly` must be enforced in route handlers/server actions, not just hidden buttons.

## Acceptance criteria
- [ ] Landing page ships brand-first messaging with creator→app path.
- [ ] iOS banner component live for creator web users (pre-launch messaging).
- [ ] `CREATOR_WEB_MODE` implemented with tests proving `readonly` blocks mutations server-side; default `full`.
- [ ] App Store landing page + smart banner ready (behind the flag).
- [ ] Sunset email sequence drafted in Resend templates, unsent.
- [ ] Creator web behavior under `full` mode is byte-for-byte unchanged.
