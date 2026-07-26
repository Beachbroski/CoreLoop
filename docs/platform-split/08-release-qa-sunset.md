# W8 — Release, QA, App Store & Creator-Web Sunset

**Goal:** Ship the iOS app through TestFlight → App Store, then retire creator web on evidence (adoption), not on a date picked in advance.

## Prerequisites
All of: W3 acceptance criteria green, W4 App Review dossier done, W5-H6 security review passed, W6 push/media verified on device, W7 flag + landing page + email sequence staged.

## Phase A — Internal QA (Jackson + TestFlight internal)
- **W8-1: Parity checklist.** Enumerate every capability of today's creator web dashboard (walk `app/(dashboard)/creator/*` route by route); verify each exists in the app or is explicitly descoped with a written reason. This checklist — not vibes — is the sunset gate.
- **W8-2: Device matrix.** Smallest supported iPhone (SE-class), largest (Pro Max), oldest supported iOS (minimum: current iOS − 1). Dark mode, Dynamic Type at accessibility sizes, VoiceOver pass on core flows (also an App Review risk area).
- **W8-3: Full-loop staging test.** Brand (web) creates campaign → creator (app) applies → brand accepts + pays (Stripe test) → creator submits (real upload) → brand approves → payout released → push received → earnings reflect it. Twice: happy path + rejection/resubmit path.
- **W8-4: Failure drills.** Airplane mode mid-submit, expired session mid-flow, force-update gate (set min version above build), maintenance mode, account deletion with payout history (verify W2-10 anonymization).

## Phase B — External beta (TestFlight external)
- **W8-5:** Recruit 10–20 waitlist creators; beta build points at **staging** (prod-shaped data, test-mode Stripe) unless a deliberate, documented decision says otherwise.
- **W8-6:** Beta feedback loop: in-app feedback link, Sentry triage; fix CRITICAL/HIGH before submission; OTA (EAS Update) for JS-only fixes to beta.

## Phase C — App Store submission
- **W8-7: Listing.** Name, subtitle, keywords, screenshots (6.7" + 6.1"), description — brand-consistent with the W7 site.
- **W8-8: Compliance pack.**
  - Privacy nutrition labels + `PrivacyInfo.xcprivacy` matching the W5-C PII inventory exactly.
  - Account deletion visible and functional (5.1.1(v)) — reviewers check.
  - Demo account with seeded data: browsable campaigns, an application in each status, payout history. **Reviewers must not need to onboard through Stripe to see the app.**
  - App Review notes: W4 money-flow explanation (creators are paid, never charged; no purchases in-app).
  - Export compliance: standard HTTPS-only → exempt encryption declaration.
- **W8-9: Submit.** Expect 1–3 review rounds; if rejected on payments, respond with the W4 dossier before changing any code.

## Phase D — Launch
- **W8-10:** Release (manual release after approval, not automatic). Flip W7 banner to "Download now"; landing page live; send email #1 ("the app is here") to creators + waitlist.
- **W8-11:** Watch for 2 weeks: Sentry crash-free rate (≥99.5% target), API 4xx/5xx on `/api/v1`, App Store reviews, adoption (devices registered ÷ active creators — the W7-2 admin widget).

## Phase E — Creator-web sunset (evidence-gated)
- **W8-12: Gate.** Proceed only when: parity checklist still green, ≥60% of monthly-active creators have signed into the app, and no open CRITICAL app bugs. Otherwise hold in `full` mode — the flag makes waiting free.
- **W8-13: Staged flip.** Email #2 with date (≥2 weeks notice) → `CREATOR_WEB_MODE=readonly` for 2–4 weeks (mutations prompt toward the app; safety valve: instant revert to `full` if something critical was missed) → email #3 → `sunset` (redirects). Legal/support/Stripe-return pages stay live.
- **W8-14: Cleanup (post-sunset, separate PRs).** Remove dead creator-web mutation paths after one quiet month in `sunset`; keep read-only code deletable-later rather than rushing deletion. Update docs; final security pass to confirm retired routes actually reject writes.

## Rollback playbook
| Situation | Response |
|---|---|
| Bad JS bug in production app | EAS Update (OTA) — minutes |
| Bad native bug | Expedited App Store review request + `/api/v1/meta` maintenance/force-update gate as tourniquet |
| API regression | Standard Vercel instant rollback; v1 contract stability means old app builds keep working |
| Sunset backlash / missed workflow | Flag back to `readonly` or `full` — one env change, zero deploys |

## Acceptance criteria
- [ ] Parity checklist artifact committed and green.
- [ ] Staging full-loop (W8-3) documented with evidence (screenshots/recording).
- [ ] App approved and live; compliance pack archived in this directory.
- [ ] 2-week health targets met (W8-11).
- [ ] Sunset executed through all three flag stages with comms sent, or an explicit written decision to hold.
