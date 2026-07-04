# Changelog

All notable changes to this project are logged here, most recent first. This is a human-readable companion to `git log` — each entry summarizes the *why*, not just the diff.

## 2026-07-04 — Full backlog pass: notifications, brand tooling, dashboard metrics

Follow-up to the waitlist-launch fix, working through the full "what's next" backlog: bug fixes, missing brand tooling, real dashboard metrics, and the product's first transactional emails.

**Fixes:**
- Admin "View waitlist"/"View as user" buttons both linked to a dead `?view=public` parameter that nothing read. Replaced with a real admin-preview banner (`app/AdminPreviewBanner.tsx`) shown on the public site via `?preview=admin`.
- Applications could be submitted to campaigns whose deadline had already passed (only `status === 'ACTIVE'` was checked).
- Accepting an application never checked the sum of accepted `proposedRate` against `campaign.budget` — only headcount was capped.
- Creators never saw a campaign's `targetAudience`/`creatorRequirements`/`usageRights` before applying, even though brands could.
- The BRAND↔CREATOR role-switch API had no UI outside onboarding; added a `ChangeRoleControl` to both settings pages, gated to before any activity.

**Notifications (new — nothing emailed anyone before this):**
- Added `lib/email.ts` (Resend) wired into: application accepted/rejected, submission approved, payout paid, waitlist confirmation, referral milestone (3 referrals), and waitlist "Invited" status.
- Added `RESEND_API_KEY`/`EMAIL_FROM_ADDRESS` env vars; sending no-ops with a warning if the key isn't set, rather than failing.

**Brand tooling (previously creator-only equivalents existed, brand had none):**
- Campaign edit/cancel UI (`CampaignEditControls.tsx`), using the `PATCH /api/campaigns/[id]` support that already existed but had no UI.
- Consolidated `/brand/applications` and `/brand/submissions` views, using the aggregate GET endpoints that existed but were never called.
- `/brand/settings` page, mirroring creator's.
- Submission revision-request/reject now takes a required reason (`Submission.reviewNote`, new migration), shown to the creator.

**Dashboard metrics:**
- Creator and brand dashboards: replaced 3 flat lifetime counters with 4 stats including week-over-week trend and acceptance rate (`lib/utils.ts#compareToLastWeek`).
- Waitlist admin dashboard: added a 14-day signups chart, top-referrers leaderboard, platform/niche/follower-range breakdown, and converted the submissions list from stacked cards to a sortable table.
- New `/creator/payouts` page: per-payout status (PENDING/PROCESSING/PAID/FAILED) instead of one lifetime "total earned" figure, so a failed payout is no longer invisible to the creator it happened to.

**Removed:** the $25-per-3-referrals promotional copy (landing page + waitlist form) — not being automated, so the promise came out rather than staying unfulfilled. Referral tracking itself is unchanged.

## 2026-07-03 — Fix waitlist-launch gating, dashboard bugs, and landing page

**Problem:** the "waitlist launch" hardening pass stacked an admin-only gate on top of every marketplace API and dashboard, which also required a BRAND/CREATOR role. Those two checks are mutually exclusive for a single user, so the marketplace was completely unusable — by anyone, including admins. The onboarding role picker was also unreachable, sign-in ignored role/admin status, and there was no way to create an admin account at all.

**Changes:**
- Replaced the admin-only marketplace gate with a `TESTER_ALLOWED_EMAILS` (+ `ADMIN_ALLOWED_EMAILS`) allowlist (`lib/admin-config.ts`, `lib/admin-api-guard.ts`), so allowlisted testers can onboard as BRAND/CREATOR and use the dashboards/APIs while the public site stays waitlist-only.
- Added `/post-login` and `lib/post-login.ts` as the single source of truth for where a signed-in user lands (admin → `/internal/waitlist`, tester with no role → `/onboarding`, BRAND/CREATOR → their dashboard, everyone else → `/waitlist`).
- Fixed `/api/users/me` so the onboarding role picker is actually reachable, and locked `/api/users/role` so an ADMIN account can't be overwritten to BRAND/CREATOR.
- Rewrote the three dashboard layouts to gate on the user's real role (not the admin allowlist) and to render the previously-orphaned `DashboardNavShell` sidebar/mobile nav.
- Removed the `ADMIN_SECRET_PATH`/secret-URL rewrite machinery from `proxy.ts` and the internal waitlist pages; `/internal/waitlist` is now protected by a server-side admin-role check in every environment (previously only enforced in production).
- Added `prisma/promote-admin.mjs` (`npm run promote:admin -- <email>`) as the documented way to create an admin account, validated against `ADMIN_ALLOWED_EMAILS`.
- Fixed creator dashboard stats being capped at 5 (was reusing a `take: 5` query for totals), brand "total spend" counting unpaid/other-brands' payouts, and campaigns closing after one approved submission regardless of `creatorsNeeded`.
- Landing page: fixed the lopsided bento grid (8+4+4 columns → 12 / 6+6), removed the never-rendered `HomeAudienceTabs` component and its dead CSS, dead `.mobile-nav-cta` rules, unused starter SVGs, a redundant inline query-sync script, and corrected the heading hierarchy.
- Renamed a leftover internal `CoreLoop` naming remnant to `CreatorDocks` (`lib/request-security.ts` global var, `docs/vercel-domain-launch.md`).
- Updated `README.md` with the new role/login model and environment variables.

## Codebase cleanup pass

- Removed `docs/security-hardening-report-2026-05-29.md` (described the secret-URL admin scheme removed above; no longer accurate).
- Removed dead CSS from `app/globals.css`: `.auth-panel-intro/-eyebrow/-title/-copy` (superseded by the `auth-hero-*` classes actually used on the sign-in page), `.muted`, `.feature-link`, `.learn-more-link`.
- Removed the unused `UploadDropzone` export from `lib/uploadthing.ts` (only `UploadButton` is used).
- `lib/turnstile.ts` now imports `isProductionDeployment` from `lib/admin-config.ts` instead of redefining it.
- Replaced the stock Next.js starter `app/favicon.ico` with `app/icon.tsx`, generating the actual CreatorDocks brand mark (red rounded square, white "D") via `next/og`, matching `app/opengraph-image.tsx`.
- **Bug found while testing the favicon change:** `/icon` and `/opengraph-image` were never in `proxy.ts`'s public-route allowlist, so Clerk's middleware redirected signed-out requests for them to `/sign-in` (307) instead of serving the image — meaning the favicon and social-preview image never actually loaded for anyone not logged in, even before this pass (the old static `favicon.ico` was exempt only because of its file extension; the OG image route had no such exemption and was already broken). Added both to the public allowlist in `proxy.ts`.
- Folded `docs/creatordocks-waitlist-ux-changes-2026-05-29.pdf` into this changelog (see entry below) and removed the PDF — it was a one-off deployment record that had started to overlap with this file.
- Fixed a stale line in `docs/vercel-domain-launch.md` claiming no git remote was configured.

## 2026-05-29 — Waitlist landing page and form UX pass

*(Folded in from a standalone PDF changelog that predated this file.)*

Reworked the public waitlist landing page and form: mobile-readable hero that still scales on desktop, a shared type scale for headings via CSS variables, a slimmer/more opaque sticky nav with "Tester sign in" downgraded from a button to a text link, tighter eyebrow pills, removal of a duplicate referral-incentive card (the "refer 3, complete 3, earn $25" offer now appears once in the early-access area and once as the form callout), and the incentive callout restyled from amber/warning to blue/informational.

Waitlist form: constrained max width, visible borders/white backgrounds/blue focus ring on inputs and selects, full-width submit on mobile / right-aligned on desktop, confirmed `type=email`/`autocomplete=email`, visible required indicators on Full name/Email/Creator handle, disabled autocorrect/capitalization on the handle field, removed a filler line next to the submit button.

Verified via `npm run build`/`npm run lint`, a 390px mobile check (hero + CTA visible without scrolling), and a production deploy aliased to `www.creatordocks.com`. Known follow-up at the time: the production Vercel deployment was still using a development Clerk publishable key — noted as a risk for flaky Safari/OAuth behavior until production Clerk keys and domain settings were applied.
