# Changelog

All notable changes to this project are logged here, most recent first. This is a human-readable companion to `git log` — each entry summarizes the *why*, not just the diff.

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
