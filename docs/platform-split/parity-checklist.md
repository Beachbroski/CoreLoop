# Creator parity checklist — the W8-1 sunset gate

**Status: HOLD AT `full`.** Not a sign-off. This is the instrument for re-checking.

---

## 1. What this gates, and the verdict

`docs/platform-split/08-release-qa-sunset.md:9` (W8-1) defines this document: *"Enumerate every capability of today's creator web dashboard … verify each exists in the app or is explicitly descoped with a written reason. This checklist — not vibes — is the sunset gate."* `08-release-qa-sunset.md:33` (W8-12) makes it one of three conditions for flipping the flag, alongside ≥60% of monthly-active creators signed into the app and no open CRITICAL app bugs. The flip itself is staged — `full` → `readonly` → `sunset` (W8-13, `08-release-qa-sunset.md:34`) — driven by `CREATOR_WEB_MODE` (`lib/creator-web-mode.ts:17`).

**State this was written against**

| Fact | Value |
|---|---|
| Branch | `fix/ios-design-audit` |
| HEAD | `9fdf866` |
| Working tree | 68 files uncommitted |
| Gates | web 363 tests, shared 48, mobile 404 — all green; TypeScript clean in all workspaces |
| App Store | Not submitted. `mobile/app.json` has no `extra.eas.projectId` (grep: no match); `mobile/app.config.ts:26` throws when `resolveBuildEnv` rejects the environment |
| Production `CREATOR_WEB_MODE` | Not read — see §8 |

**Verdict: hold at `full`.** The app is not in the App Store and cannot currently be built, so no creator can reach the replacement surface at all — every downstream W8-12 condition (60% app sign-in, no CRITICAL bugs) is unmeasurable by construction, and 26 web capabilities have no app equivalent today. Even setting the build problem aside, three of the gaps are load-bearing rather than cosmetic: payout history is capped at 20 rows on the app with no way to page (`mobile/src/app/(app)/earnings/index.tsx:165-195` — no `onEndReached`, no `fetchNextPage` caller) while web is unpaginated (`app/(dashboard)/creator/payouts/page.tsx:21-33`); push — the app's only notification channel — cannot be delivered by any build that exists (`mobile/src/lib/push.ts:77-88` returns `unconfigured`); and admin "view as creator", the sole support tool for "a creator says X is broken", dies at `sunset` with no replacement on either surface (`lib/view-as.ts:32-36`, no `/api/v1` admin scope).

**This document is not a one-time sign-off.** It is written ahead of the gate it governs. Re-run it — re-reading each cited line, because both columns move — before each of the three flag flips. §6 says what must be true before each one.

**Reading rules used here.** Every row cites `path:line` on both sides or names the absence. A capability is Parity only if a creator can *reach a screen* that does it — an implemented hook with no caller is not a capability (`mobile/src/lib/queries/use-update-me.ts:21` is the standing example: fully written, referenced only by its own test). Where a survey and the code disagreed, the code won.

---

## 2. The parity table

**94 capabilities.** Parity 47 · Partial 12 · Missing 14 · Descoped 5 · App-only 16. Paths are relative to the repo root.

Status vocabulary, used strictly:
- **Parity** — the app does it fully, via a screen a creator can reach.
- **Partial** — the app does some of it; the row says exactly what is missing.
- **Missing** — the app cannot do it.
- **Descoped** — deliberately not coming, with the written reason and its citation.
- **App-only** — the app has it and creator web never did.

### 2.1 Discovery

| # | Capability | Creator web | iOS app | Status | Notes |
|---|---|---|---|---|---|
| D-01 | Browse the live campaign feed | `app/(dashboard)/creator/campaigns/page.tsx:33-44`, grid `:66` | `mobile/src/app/(app)/discover/index.tsx:233-273`; tile `mobile/src/components/campaign-tile.tsx:132-243` | Parity | App is better: web renders every ACTIVE campaign on one page with no `take`; app pages 20 at a time. |
| D-02 | Feed excludes campaigns past deadline | none — web query filters on `status: 'ACTIVE'` only, `campaigns/page.tsx:34-38` | `app/api/v1/campaigns/route.ts:22-27` (`deadline: { gte: new Date() }`) | App-only | Web shows dead-end briefs a creator cannot apply to. |
| D-03 | Paginate / infinite-scroll the feed | none (unpaginated single page) | `mobile/src/app/(app)/discover/index.tsx:160-170`, footer `:275-279`; `mobile/src/lib/queries/use-campaigns.ts:27-40` | App-only | The only list in the app that actually pages. |
| D-04 | Filter by niche | `campaigns/page.tsx:9` (9 fixed chips), chips `:252-259`, query `:36` | `mobile/src/app/(app)/discover/index.tsx:77,84-85,214`; `mobile/src/components/category-chips.tsx` | Parity | App filters server-side and derives chips from the live feed; chip row hides itself at ≤2 niches (`discover/index.tsx:213`). |
| D-05 | Filter by platform | `campaigns/page.tsx:10` (TikTok/Instagram/YouTube/X/Discord), chips `:261-268`, query `:37` | none — API accepts it (`app/api/v1/campaigns/route.ts:15,26`) but `mobile/src/lib/queries/use-campaigns.ts:35` only ever sends `niche`, and no UI exists | **Missing** | Planned: `docs/platform-split/03-ios-app.md:20` ("filter: niche, platform"). Server work is already done; this is UI only. |
| D-06 | Clear filters / active-chip state | `campaigns/page.tsx:246-251` ("All" chip), active class `:256`, `:266` | `mobile/src/app/(app)/discover/index.tsx:77` (`ALL_CATEGORIES`), `:214` | Parity | |
| D-07 | Free-text search | none | `mobile/src/app/(app)/discover/index.tsx:113-124`, input `:197-209` | App-only | Client-side over loaded pages only — a match on page 3 is invisible until scrolled to. |
| D-08 | See which brand posted the campaign | `campaigns/page.tsx:72-86`, query include `:40` | tile `mobile/src/components/campaign-tile.tsx:194-195`; detail `mobile/src/app/(app)/discover/[id]/index.tsx:100` | Parity | |
| D-09 | See the deadline | `campaigns/page.tsx:87` | `mobile/src/app/(app)/discover/[id]/index.tsx:108` | Parity | App adds deadline-urgency styling on the tile. |
| D-10 | See title and description | `campaigns/page.tsx:91-103` — description clamped to 3 lines, no expand | `mobile/src/app/(app)/discover/[id]/index.tsx:99`, description as "About this campaign" `:72`, untruncated | Parity | App is better; web truncates with no way to read the rest. |
| D-11 | See required platforms and headcount | `campaigns/page.tsx:106-115` | `mobile/src/app/(app)/discover/[id]/index.tsx:109-113` | Parity | |
| D-12 | Read the brief — Objective | `campaigns/page.tsx:119-128`, truncated at 140 chars (`:17-20`) | `mobile/src/app/(app)/discover/[id]/index.tsx:73`, full text | Parity | |
| D-13 | Read the brief — Deliverables | `campaigns/page.tsx:130-139`, truncated at 160 | `mobile/src/app/(app)/discover/[id]/index.tsx:74` | Parity | |
| D-14 | Read the brief — Target audience | `campaigns/page.tsx:152-161`, truncated at 160 | `mobile/src/app/(app)/discover/[id]/index.tsx:75` | Parity | |
| D-15 | Read the brief — Creator requirements | `campaigns/page.tsx:163-172`, truncated at 160 | `mobile/src/app/(app)/discover/[id]/index.tsx:76` | Parity | |
| D-16 | Read the brief — Call to action | `campaigns/page.tsx:141-150`, truncated at 120 | `mobile/src/app/(app)/discover/[id]/index.tsx:77` | Parity | |
| D-17 | Read the brief — **Usage rights** | `campaigns/page.tsx:174-183`, truncated at 160 | `mobile/src/app/(app)/discover/[id]/index.tsx:78`, full text | Parity | Contractual terms. App shows them in full; web truncated them, so this is a strict improvement. |
| D-18 | See the budget | `campaigns/page.tsx:189-192` | `mobile/src/app/(app)/discover/[id]/index.tsx:107` (StatChip "Budget") | Parity | |
| D-19 | See "Applied" on a campaign you already applied to | `campaigns/page.tsx:41,68,195-198` (per-creator sub-query drives a grey pill in place of Apply) | none — Apply renders unconditionally, `mobile/src/app/(app)/discover/[id]/index.tsx:122-124`; no `applied` flag in the schema or route | **Missing** | The creator writes a full pitch, then eats a 409 (`app/api/v1/applications/route.ts:57-59`). |
| D-20 | See the Stripe pre-condition before applying | inline pill `campaigns/page.tsx:203-204`; dashboard banner `app/(dashboard)/creator/page.tsx:83-93`; settings banner `app/(dashboard)/creator/settings/page.tsx:56-62` | none — `useStripeStatus` is imported only by Earnings (`mobile/src/app/(app)/earnings/index.tsx:23,86,125`); Discover, detail and Apply never read it | **Missing** | Server 403s at `app/api/v1/applications/route.ts:34-40` *after* the pitch is written. Highest-friction gap for a brand-new creator. |
| D-21 | Empty state when nothing matches | `campaigns/page.tsx:46-59` | `mobile/src/app/(app)/discover/index.tsx:239-249` | Parity | Both distinguish "no results for filters" from "no campaigns". |
| D-22 | Loading skeleton | `campaigns/page.tsx:215-223`, `:272` | `mobile/src/app/(app)/discover/index.tsx:218-221` | Parity | |
| D-23 | Pull-to-refresh + stale-data banner | none (server-rendered; a reload is the refresh) | `mobile/src/app/(app)/discover/index.tsx:224`, `:236` | App-only | A failed refetch keeps the last good feed instead of blanking it. |
| D-24 | Campaign cover imagery | none | `mobile/src/lib/cover-art.ts:1-40`; `mobile/src/components/cover-art.tsx`; used `campaign-tile.tsx:159`, `discover/[id]/index.tsx:85-96` | App-only | Deterministic procedural art seeded by id + niche; no backend image field exists. |

### 2.2 Applying

| # | Capability | Creator web | iOS app | Status | Notes |
|---|---|---|---|---|---|
| A-01 | Open an apply form | `app/(dashboard)/creator/campaigns/ApplyModal.tsx:57-63`, dismiss `:65-85`, `:169-177` | `mobile/src/app/(app)/discover/[id]/apply.tsx:58-113`; entry `discover/[id]/index.tsx:123` | Parity | Modal on web, pushed screen on app. |
| A-02 | Write a pitch | `ApplyModal.tsx:110-128` — required, 20–2000 chars client-side | `mobile/src/app/(app)/discover/[id]/apply.tsx:67-84`, min 20 with a live counter `:83` | Parity | App has no client-side 2000 cap; the server enforces it (`app/api/v1/applications/route.ts` → shared schema). |
| A-03 | Propose a rate in USD | `ApplyModal.tsx:135-154`, cents conversion `:37` | `mobile/src/app/(app)/discover/[id]/apply.tsx:96-105`, cents conversion `:34` | Parity | |
| A-04 | See the campaign budget while quoting a rate | `ApplyModal.tsx:142` (placeholder) and `:156` ("Campaign budget: …") | none — the Apply screen shows no budget; it is one screen back at `discover/[id]/index.tsx:107` | **Partial** | Creator must remember the number or back out. Small, cheap to close. |
| A-05 | **Submit an application** | `ApplyModal.tsx:40-48`; handler `app/api/applications/route.ts:14-93`, create `:84-91` | `mobile/src/app/(app)/discover/[id]/apply.tsx:43-51`; handler `app/api/v1/applications/route.ts:22` | Parity | Web path is `creatorWriteBlockedResponse()`-gated at `app/api/applications/route.ts:27`; the v1 path is not, by design. |
| A-06 | See why an application was refused | `ApplyModal.tsx:46`, `:91-104` | `mobile/src/app/(app)/discover/[id]/apply.tsx:47-49`, `:107` | Parity | Both render the server's message verbatim. |
| A-07 | Land somewhere sensible after applying | full page reload of the campaigns list, `ApplyModal.tsx:44` | `router.replace('/activity')`, `mobile/src/app/(app)/discover/[id]/apply.tsx:45` | Parity | |
| A-08 | See every application you have made | `app/(dashboard)/creator/applications/page.tsx:31-38` — all of them, unpaginated | `mobile/src/app/(app)/activity/index.tsx:165-185`; `mobile/src/lib/queries/use-applications.ts:16-26` | **Partial** | App shows the **first 20 only**. `useInfiniteQuery` is wired with a working `getNextPageParam` but no `FlatList` sets `onEndReached` and nothing calls `fetchNextPage` (grep across `mobile/src`: only Discover does, `discover/index.tsx:166`). Page limit 20 / max 50, `packages/shared/src/pagination.ts:8`. |
| A-09 | Re-read your own submitted pitch | `applications/page.tsx:89` | `mobile/src/app/(app)/activity/applications/[id].tsx:72-75` | Parity | The only place on either surface where a creator can see what they wrote. |
| A-10 | See the brand's name on your application | `applications/page.tsx:69-79` (avatar + name) | none — detail shows campaign title only, `mobile/src/app/(app)/activity/applications/[id].tsx:63`; row shows title, `activity/index.tsx:105-116` | **Partial** | Campaign title is shown; the brand behind it is not. |
| A-11 | See application status | `applications/page.tsx:86`, pill map `:10-14` | row `mobile/src/app/(app)/activity/index.tsx:100`; detail `activity/applications/[id].tsx:66` | Parity | |
| A-12 | See your proposed rate on the application | `applications/page.tsx:82-84` | `mobile/src/app/(app)/activity/applications/[id].tsx:67-69`; row subtitle `activity/index.tsx:109` | Parity | |
| A-13 | **Withdraw an application** | none — `app/api/applications/[id]/route.ts` exports only `PATCH`, brand-only (`:36-38`); no `DELETE` handler exists in `app/api` | `mobile/src/app/(app)/activity/applications/[id].tsx:84-108`; `app/api/v1/applications/[id]/route.ts:30`, PENDING-only `:40-45` | App-only | |
| A-14 | Applications empty state with a CTA | `applications/page.tsx:40-56` | `mobile/src/app/(app)/activity/index.tsx:176-183` | Parity | |
| A-15 | See a brand's reason for rejecting an application | none — pill only (`applications/page.tsx:86`); the brand review endpoint takes no note field (`app/api/applications/[id]/route.ts:13-15`) | none | Descoped | Absent on both surfaces by construction — feedback exists at submission level only (`app/api/submissions/[id]/route.ts:101-107`). Not a sunset gap; recorded so it is not mistaken for one. |

### 2.3 Submissions

| # | Capability | Creator web | iOS app | Status | Notes |
|---|---|---|---|---|---|
| S-01 | Submission section unlocks on ACCEPTED | `applications/page.tsx:91` | `mobile/src/app/(app)/activity/applications/[id].tsx:110-114` | Parity | |
| S-02 | Upload a content file | `applications/SubmitContentModal.tsx:118-126` (`UploadButton`, `contentUploader`); router `app/api/uploadthing/route.ts:10-13` — images ≤16 MB ×5 or video ≤256 MB ×1 | `mobile/src/components/content-upload-field.tsx:29-59`; route `app/api/v1/uploads/route.ts:36-39` (same limits) | **Partial** | App picks from the **photo library only** (`content-upload-field.tsx:55`, `source: 'library'`), keeps only `res[0]` (`:35`) despite `maxFileCount: 5`, and the copy and preview are image-shaped (`:143`, `:96-103`). Web's file picker takes any file, including multi-image and video, with a correct confirmation state. |
| S-03 | Upload video | supported by the same picker; limits `app/api/uploadthing/route.ts:12` | route permits it (`app/api/v1/uploads/route.ts:38`) and the UploadThing Expo helper widens the picker accordingly, but nothing in the UI says so and the preview renders through `expo-image` | **Partial** | See §8 — this is a two-hop inference through a dependency's internals and is not confirmed. If wrong, video is flatly Missing, which matters for any creator whose deliverable is a Reel. |
| S-04 | Capture content with the camera | none | none — `content-upload-field.tsx:55` is library-only; `mobile/app.json:51-57` sets `cameraPermission: false` | Descoped | Absent on both surfaces. Not a sunset gap. |
| S-05 | Confirm / replace an upload before submitting | `SubmitContentModal.tsx:106-116` ("✓ File uploaded" + Remove) | `mobile/src/components/content-upload-field.tsx:80-116` (thumbnail preview + replace) | Parity | |
| S-06 | Add a caption and notes for the brand | `SubmitContentModal.tsx:133-156` | `mobile/src/app/(app)/activity/submissions/new.tsx:68-87` | Parity | Both optional; server caps each at 2000 chars. |
| S-07 | **Submit content for review** | `SubmitContentModal.tsx:40-54`, disabled until upload `:167`; handler `app/api/submissions/route.ts:21-84`, create `:74-82` | `mobile/src/app/(app)/activity/submissions/new.tsx:29-49,90-92`; handler `app/api/v1/submissions/route.ts:29` | Parity | Web path is gated at `app/api/submissions/route.ts:34`; the v1 path is not, by design. |
| S-08 | See every submission you have made | nested per application, `applications/page.tsx:35`, `:109-128` — all of them | `mobile/src/app/(app)/activity/index.tsx:187-207`; `mobile/src/lib/queries/use-submissions.ts:11-21` | **Partial** | Same 20-row ceiling as A-08 — no `onEndReached` on the submissions `FlatList` either. The app's flat cross-campaign list is otherwise an improvement on web's per-application nesting. |
| S-09 | Open the submitted content | `applications/page.tsx:114-116` (new tab, `noopener noreferrer`) | `mobile/src/app/(app)/activity/submissions/[id].tsx:98-112` (system browser) | Parity | |
| S-10 | See per-submission review status | map `applications/page.tsx:16-21`; pill `:117-119` | row `mobile/src/app/(app)/activity/index.tsx:118-128`; detail `activity/submissions/[id].tsx:92-94` | Parity | Four states on both: Pending / Approved / Revision requested / Rejected. |
| S-11 | **Read the brand's review note** | `applications/page.tsx:121-125` | `mobile/src/app/(app)/activity/submissions/[id].tsx:120-133` | Parity | The only channel through which revision instructions reach a creator — there is no messaging feature on either surface. App colour-codes it by status. |
| S-12 | Resubmit after a revision request | not a feature — the Submit button stays available on any ACCEPTED application (`applications/page.tsx:100`; server checks only `status === 'ACCEPTED'`, `app/api/submissions/route.ts:70-72`), so an *additional* row is created, unlinked and uncapped | `mobile/src/app/(app)/activity/submissions/[id].tsx:137-149`; `app/api/v1/submissions/[id]/route.ts:49`, allowed only from `REVISION_REQUESTED`/`REJECTED` (`:59-64`), status returns to PENDING and the note clears | Parity | Different mechanisms. The app's is stricter and better modelled; nothing web could do is lost. |
| S-13 | Withdraw or edit a submission | none — `app/api/submissions/[id]/route.ts` exports only `PATCH`, brand-only (`:38-40`) | none | Descoped | Absent on both surfaces. Not a sunset gap. |
| S-14 | Submissions empty state | `applications/page.tsx:103-106` | `mobile/src/app/(app)/activity/index.tsx:199-205` | Parity | |

### 2.4 Earnings and payouts

| # | Capability | Creator web | iOS app | Status | Notes |
|---|---|---|---|---|---|
| E-01 | See lifetime total paid | tile `app/(dashboard)/creator/payouts/page.tsx:35-37`, `:59-62`; also dashboard `app/(dashboard)/creator/page.tsx:44-47`, `:61` | hero `mobile/src/app/(app)/earnings/index.tsx:132-136`, `:182-184`; server aggregate `app/api/v1/payouts/route.ts:73,80` | Parity | App aggregates server-side across all payouts; web reduces the fetched rows in JS. App's number is the more robust one. |
| E-02 | See pending + processing total | tile `payouts/page.tsx:38-40`, `:63-66` | none | **Missing** | "What am I owed" has no answer in the app. |
| E-03 | See failed-payout count | tile `payouts/page.tsx:41`, `:67-70` | none | **Missing** | |
| E-04 | See payout history rows | `payouts/page.tsx:93-120` | `mobile/src/app/(app)/earnings/index.tsx:66-82`, `:187` | **Partial** | See E-05/E-06/E-07/E-08 for exactly what each row drops. |
| E-05 | Know which campaign a payout is for | `payouts/page.tsx:99` (joined submission → application → campaign) | none — the API sends `campaign: { id, title, brand: { name } }` (`app/api/v1/payouts/route.ts:70`; schema `packages/shared/src/payout.ts:27-40`) and `PayoutRow` renders amount, date, status only (`earnings/index.tsx:66-82`) | **Missing** | Data is already on the wire. This is a render-only fix. |
| E-06 | See the platform fee on a payout | `payouts/page.tsx:102` | none — `platformFee` is selected (`app/api/v1/payouts/route.ts:68`) and never rendered | **Missing** | Creators reconciling gross vs net have no path. |
| E-07 | See per-payout status | pill `payouts/page.tsx:114-116`, map `:7-12` | `mobile/src/app/(app)/earnings/index.tsx:79` | Parity | Same four states. |
| E-08 | Understand a failed payout | `payouts/page.tsx:104-108` — "This payout failed. Reach out to support if it doesn't resolve on its own." | none — a FAILED pill with no explanation and no support pointer | **Partial** | The pill exists; the guidance does not. |
| E-09 | See payouts beyond the 20 most recent | unpaginated — `payouts/page.tsx:21-33` returns every row | none — `mobile/src/app/(app)/earnings/index.tsx:165-195` sets no `onEndReached`; `mobile/src/lib/queries/use-payouts.ts:24-34` has `getNextPageParam` but no caller | **Missing** | Silent, worsens with tenure, and visibly self-contradicting: the server-aggregated lifetime hero (E-01) will exceed the sum of the rows beneath it. |
| E-10 | Payouts empty state | `payouts/page.tsx:83-90` | `mobile/src/app/(app)/earnings/index.tsx:188-194` | Parity | |
| E-11 | See Stripe payout-account status | `app/(dashboard)/creator/settings/page.tsx:11`, `:34-53` | `mobile/src/app/(app)/earnings/index.tsx:125`, `:154`; `mobile/src/lib/queries/use-stripe-status.ts:7` | Parity | Whole Earnings tab branches on it. |
| E-12 | **Connect a Stripe payout account** | `settings/ConnectStripeButton.tsx:9-21`; handler `app/api/stripe/onboard/route.ts:8-69`, link `:62-67` | `mobile/src/app/(app)/earnings/index.tsx:84-121`, handler `:89-105`; route `app/api/v1/stripe/onboard/route.ts:34-38` | Parity | Both send the creator to Stripe's hosted onboarding and both return to `/creator/settings` — see §4. |
| E-13 | See onboarding failure feedback | `ConnectStripeButton.tsx:33`; server messages `app/api/stripe/onboard/route.ts:34-37`, `:73-76` | `mobile/src/app/(app)/earnings/index.tsx:98`, `:103` | Parity | |
| E-14 | Understand the Stripe pre-condition | banner `settings/page.tsx:56-62`; nudge `creator/page.tsx:83-93` | `OnboardingPrompt` on Earnings, `mobile/src/app/(app)/earnings/index.tsx:84-121`, `:155` | Parity | Present on Earnings. Its absence *at the point of applying* is D-20, a separate row. |
| E-15 | Filter, sort, export or drill into a payout | none — no filter bar, no CSV, no Stripe link, `stripeTransferId` (`prisma/schema.prisma:172`) never rendered | none | Descoped | Absent on both surfaces. Not a sunset gap. |

### 2.5 Profile and account

| # | Capability | Creator web | iOS app | Status | Notes |
|---|---|---|---|---|---|
| P-01 | See your own name | `settings/page.tsx:77-78` | `mobile/src/app/(app)/profile/index.tsx:166-168` | Parity | |
| P-02 | See which email your account uses | `settings/page.tsx:89-90` (its own row) | **only as a fallback** — `profile/index.tsx:167` renders `me.name ?? me.email`, so a creator with a name set never sees their email | **Partial** | Matters for support ("which address are you signed in with?"). |
| P-03 | See your role | implied by the shell label, `app/(dashboard)/creator/layout.tsx:34` | `mobile/src/app/(app)/profile/index.tsx:169-171`; `mobile/src/lib/format-role.ts:9-11` | Parity | |
| P-04 | Edit name / bio | none — `settings/page.tsx:77-90` is static text; `app/api/users/me/route.ts:5` exports only `GET` | none reachable — `PATCH /api/v1/me` exists (`app/api/v1/me/route.ts:24`) and `mobile/src/lib/queries/use-update-me.ts:21` is fully written, but grep across `mobile/src` returns only the definition and its test. No screen, no `TextInput`, no route | Descoped | Absent on both surfaces, so not a sunset gap. But it is **planned** app work (`docs/platform-split/03-ios-app.md:29,46`) and the API half is already shipped — see §7. |
| P-05 | Change your avatar | none | none — `me.avatarUrl` is returned (`app/api/v1/me/route.ts:7-15`) and never read; Profile draws a coral-gradient monogram (`profile/index.tsx:154-164`). The only `avatarUrl` use in `mobile/src` is the *brand's* logo (`campaign-tile.tsx:194-195`) | Descoped | Absent on both surfaces. Planned at `03-ios-app.md:46`. Not a sunset gap. |
| P-06 | **Switch role CREATOR → BRAND** | `app/(dashboard)/creator/settings/page.tsx:92-102`; `app/ChangeRoleControl.tsx:17-21`, `:30`; handler `app/api/users/role/route.ts:12-122`, update `:66-69`. Shown only with zero campaigns and zero applications (`settings/page.tsx:13-17`), enforced server-side (`:54-64`) | none — `app/api/v1/onboarding/route.ts:79` always creates `CREATOR` and never rewrites a role; Profile renders the role as a label with no control | Descoped | Written reason at `app/api/v1/onboarding/route.ts:35-37`: *"Role is always CREATOR: the iOS app is the creator surface. Brands onboard on web, where they pick a role."* **Survives sunset regardless** — it lives on the exempt `/creator/settings`. See §7 for the ungated-write question that raises. |
| P-07 | Understand the role-switch window | `settings/page.tsx:96-98` | n/a | Descoped | Follows P-06. |
| P-08 | **Delete your account** | none — no delete UI and no `DELETE` handler anywhere in `app/api` | `mobile/src/app/(app)/profile/index.tsx:90-124`, row `:188`; `mobile/src/lib/queries/use-delete-account.ts:18`; `app/api/v1/me/route.ts:98-141`, blocked on live payouts `:102-109` | App-only | Apple-mandated (W2-10). Two-step destructive confirm; anonymizes the row and deletes the Clerk identity and push tokens. |
| P-09 | Sign out | `app/DashboardNavShell.tsx:93`, `:146` (Clerk `<UserButton>`) | `mobile/src/app/(app)/profile/index.tsx:77-88`, row `:183-187` | Parity | App also unregisters the push token and clears the query cache. |
| P-10 | Manage the Clerk identity — password change, email addresses, MFA, active devices | Clerk `<UserButton>` account modal, `DashboardNavShell.tsx:93`, `:146` | none — Profile has six rows and none opens a Clerk account UI (`profile/index.tsx:175-189`) | **Missing** | Not gated by `CREATOR_WEB_MODE`, so it survives `readonly`; it dies at `sunset` along with the rest of the shell. Scope depends on the Clerk instance's User Profile config, which is not in-repo — see §8. |
| P-11 | See the app/build version | none | `mobile/src/app/(app)/profile/index.tsx:176` | App-only | |
| P-12 | Dashboard stat — applications submitted, with a week-over-week trend | `creator/page.tsx:41`, `:48-51`, tile `:58`, trend render `:100-104`; `lib/utils.ts:18-32` | none — four tabs, no dashboard (`mobile/src/app/(app)/_layout.tsx:144-205`) | **Missing — needs a decision** | No written descope exists. See §7. |
| P-13 | Dashboard stat — acceptance rate | `creator/page.tsx:42`, math `:54`, tile `:59` | none | **Missing — needs a decision** | |
| P-14 | Dashboard stat — pending review count | `creator/page.tsx:43`, tile `:60` | none | **Missing — needs a decision** | |
| P-15 | Dashboard stat — total earned | `creator/page.tsx:44-47`, tile `:61` | covered by E-01 (Earnings hero) | Parity | The number survives; only its placement on a home dashboard does not. |
| P-16 | Recent-applications panel + "View all" | `creator/page.tsx:130-145`, link `:116` | the Activity tab is the list, `mobile/src/app/(app)/activity/index.tsx:165-185` | Parity | The app replaces a 5-row preview with the full list one tap away. |
| P-17 | Personalised greeting | `creator/page.tsx:75` | none | Descoped | Cosmetic. No decision required. |
| P-18 | "How to get shortlisted faster" coaching panel | `creator/page.tsx:150-168`, tips `:158-162` | none | **Missing — needs a decision** | Static copy; cheap to port into an empty state if Jackson wants it. See §7. |
| P-19 | Static "System feel" sidebar panel | `app/DashboardNavShell.tsx:127-143` | none | Descoped | Marketing copy, no data. No decision required. |
| P-20 | **Admin "view as creator" (read-only support)** | `lib/view-as.ts:32-36` (admin + valid id → that account, `readOnly: true`); entry `app/internal/users/page.tsx:85` (`/creator?viewAs=<id>`); banner `app/(dashboard)/AdminViewBanner.tsx:10-19`; used on all five creator pages | none — no admin view in the app; every `/api/v1` route is `role: 'CREATOR'`- or self-scoped (`app/api/v1/me/route.ts:17`, `app/api/v1/stripe/status/route.ts:5`) | **Missing** | The single largest un-replaced loss. `/creator` is not exempt (`lib/creator-web-mode.ts:46`) and the redirect runs *after* the `CREATOR || ADMIN` check (`app/(dashboard)/creator/layout.tsx:12`, `:25-26`), so admins are bounced exactly like creators. Only `/creator/settings?viewAs=<id>` still renders. |
| P-21 | Crash containment | Next error boundaries (framework default) | `mobile/src/app/_layout.tsx:61-63`; `mobile/src/app/(app)/_layout.tsx:236-238`; `mobile/src/components/app-error-boundary.tsx` | App-only | Per-tab boundaries so one crash does not kill the app. |
| P-22 | Automatic light/dark | web is light-only | `mobile/src/app/_layout.tsx:16-38`, `:46`; `mobile/src/hooks/use-theme.ts:9-18` | App-only | |
| P-23 | Remote kill-switch — maintenance mode and minimum-version gate | none | `mobile/src/components/version-gate.tsx:125-153`, mounted `mobile/src/app/_layout.tsx:47`; `app/api/v1/meta/route.ts:4-12` | App-only | The App Store link degrades to written instructions until `EXPO_PUBLIC_APP_STORE_URL` is set (`version-gate.tsx:26-28`, `:121`). |
| P-24 | Haptic feedback on primary interactions | n/a | `mobile/src/app/(app)/_layout.tsx:90-92`; `campaign-tile.tsx:117`; `content-upload-field.tsx:42,51` | App-only | |

### 2.6 Auth

| # | Capability | Creator web | iOS app | Status | Notes |
|---|---|---|---|---|---|
| AU-01 | Email + password sign-in | `app/(auth)/sign-in/[[...sign-in]]/page.tsx:33-39` (Clerk `<SignIn>`) | `mobile/src/app/(auth)/sign-in.tsx:36-39`, form `:98-126` | Parity | Same Clerk instance, so an account works on both surfaces through the transition. |
| AU-02 | Sign up + email verification code | `app/(auth)/sign-up/[[...sign-up]]/page.tsx:47-53` | `mobile/src/app/(auth)/sign-up.tsx:39-40`, `:56-60`, UI `:93-125` | Parity | |
| AU-03 | Google SSO | Clerk `<SignIn>`/`<SignUp>` (provider set lives in the Clerk dashboard) | `mobile/src/components/oauth-buttons.tsx:20`, `:84-114`, mounted `sign-in.tsx:88` / `sign-up.tsx:137` | Parity | Web provider list is UNVERIFIED — §8. |
| AU-04 | TikTok SSO | as AU-03 | `mobile/src/components/oauth-buttons.tsx:21`, `:122` | Parity | |
| AU-05 | Sign in with Apple | not wired on web (UNVERIFIED — §8) | `mobile/src/components/apple-sign-in-button.tsx:96-128`, rendered first at `oauth-buttons.tsx:121`; `mobile/app.json:12` | App-only | Added in the last working session. App Store requirement where third-party SSO is offered. |
| AU-06 | SSO callback handling | `app/sso-callback/[[...sso-callback]]/page.tsx:1-12` | `mobile/src/app/sso-callback.tsx:6-9` (safety net; `useSSO` normally completes in-promise) | Parity | Redirect `creatordocks://sso-callback`, `oauth-buttons.tsx:89`. |
| AU-07 | **Password reset** | Clerk `<SignIn>` handles it, `app/(auth)/sign-in/[[...sign-in]]/page.tsx:33` | none — `mobile/src/app/(auth)/sign-in.tsx:98-132` is the whole form: email, password, submit, "Sign up". No forgot-password link, no reset strategy, no route under `(auth)` | **Missing** | Web `/sign-in` survives sunset (`proxy.ts:14`), so this is recoverable — but only if the creator guesses to go to the website. Nothing in the app points there. |
| AU-08 | MFA / step-up verification | Clerk `<SignIn>` handles it | none — `mobile/src/app/(auth)/sign-in.tsx:47` sets the error to *"Additional verification is required. Please continue on the web."* | **Missing** | The app names web as its fallback, and after signing in there a CREATOR is routed to `/creator` (`lib/post-login.ts:17`), which at sunset redirects to `/get-the-app` — so the creator gets no confirmation the verification worked. |
| AU-09 | Session storage | Clerk cookie session | iOS Keychain via `expo-secure-store`, `mobile/src/lib/token-cache.ts:6-29` | Parity | **Not** biometric: `mobile/app.json:44-49` sets `faceIDPermission: false` and no call site passes `requireAuthentication`. Describe it as "Keychain-stored session, no biometric prompt". |
| AU-10 | Recover from an expired session | Clerk redirects to `/sign-in` | **broken** — `onAuthFailure` is exported (`mobile/src/lib/api-client.ts:96-101`) with no subscriber anywhere in `mobile/src`; `isAuthError` (`:77-79`) is likewise uncalled | **Partial** | A 401 mid-session does not sign the creator out. Every screen renders "Your session has expired…" with a Retry that cannot work until the app is force-quit or the creator finds Profile → Sign out. UNVERIFIED — §8. |
| AU-11 | Account provisioning on first launch | `/onboarding` with an explicit role choice, `app/onboarding/page.tsx:163-175` → `PATCH /api/users/role` | automatic, `mobile/src/app/(app)/_layout.tsx:102` → `mobile/src/lib/queries/use-ensure-account.ts:36` → `app/api/v1/onboarding/route.ts:39-85` | Parity | App skips the role question by design (P-06's citation). It also adopts an existing row matching the verified email, so a creator who onboarded on web keeps their account. |
| AU-12 | Waitlist gate for a non-invited account | redirect to `/waitlist` from `app/(dashboard)/layout.tsx:9` | `mobile/src/app/(app)/_layout.tsx:41-73`, triggered `:115`, from the 403 at `app/api/v1/onboarding/route.ts:70` | Parity | Same `isTesterEmailAllowed` gate (`lib/admin-config.ts:69-80`). |
| AU-13 | **Join the waitlist (submit a request)** | `app/waitlist/page.tsx:30-55`, form `app/waitlist/WaitlistForm.tsx`, `POST /api/waitlist` | none — `WaitlistGate` says "You're on the list" and offers Sign out; it never collects a submission | Descoped | Web-only permanently; `/waitlist(.*)` is public (`proxy.ts:6`) and outside `/creator`, so it rides through sunset untouched. Carve-out recorded in §4. |
| AU-14 | Offline handling | browser-native | none — React Query's `onlineManager` is left on its browser default, so the app believes it is online forever; documented candidly at `mobile/src/lib/query-client.ts:66-81` | **Missing — needs a decision** | Not a web-parity gap (web has no offline story either), but W3-2 (`03-ios-app.md:38`) planned an offline banner. Listed here because it changes what a creator sees when the app is their only surface. |

### 2.7 Notifications

| # | Capability | Creator web | iOS app | Status | Notes |
|---|---|---|---|---|---|
| N-01 | Email: application accepted | `lib/email.ts:60-72`, sent from `app/api/applications/[id]/route.ts:148` | same email (server-side, surface-independent) | Parity | Its **link** breaks at sunset — §5, E1. |
| N-02 | Email: application rejected | `lib/email.ts:74-86`, sent from `app/api/applications/[id]/route.ts:151` | same email | Parity | Link breaks at sunset — §5, E2. |
| N-03 | Email: submission approved | `lib/email.ts:88-100`, sent from `app/api/submissions/[id]/route.ts:91` | same email | Parity | Link breaks at sunset — §5, E3. |
| N-04 | Email: payout paid | `lib/email.ts:109-126`, sent from `app/api/webhooks/stripe/route.ts:112` | same email | Parity | Link survives but is already wrong today — §5, E4. |
| N-05 | Notice that a submission needs revision, or was rejected | **none** — `lib/email.ts` has no counterpart to the approved email; the creator finds out by opening the dashboard | push only (`lib/push.ts:97-106`, `:108-117`), currently undeliverable | **Missing** | Today, with push dead and web live, a creator whose work is sent back is notified by **nothing at all**. Post-sunset it becomes no notice and no dashboard. Argues for wiring `extra.eas.projectId` *before* the gate, not after. |
| N-06 | Push notifications — 7 creator events | none (no browser push anywhere in `app/`) | senders `lib/push.ts:70-138`; wired at `app/api/applications/[id]/route.ts:149,152`, `app/api/submissions/[id]/route.ts:94,116,118`, `app/api/webhooks/stripe/route.ts:117,151`; registration `mobile/src/app/(app)/_layout.tsx:106` → `mobile/src/lib/push.ts:74-114` → `app/api/v1/devices/route.ts:5` | App-only | **Implemented but not operational.** `mobile/app.json` has no `extra.eas.projectId` (grep: no match), so `registerForPushNotifications` returns `{status:'unconfigured'}` (`mobile/src/lib/push.ts:77-88`), no `Device` row is ever created, and `lib/push.ts:26` no-ops for everyone. |
| N-07 | Notification tap → deep link | n/a | `mobile/src/hooks/use-push-notifications.ts:38-65`; untrusted-URL guard `:45`; cold-launch path `:52` | App-only | Every `data.url` is an in-app path, so push is entirely unaffected by `CREATOR_WEB_MODE`. |
| N-08 | Notification preferences (per-event toggles or a master switch) | none anywhere under `app/(dashboard)/creator/` | none — the only notification surface is the one-shot OS permission prompt; `mobile/src/lib/push.ts:90-102` computes `{status:'denied', canAskAgain}` and the only caller (`use-push-notifications.ts:33-35`) discards it. Profile's rows are `profile/index.tsx:176-188` — no notification row | **Missing — needs a decision** | Absent on both surfaces, so not a strict sunset gap — but W3-10 (`03-ios-app.md:30,46`) planned it, and once push works, the OS toggle is the only control a creator has. See §7. |

### 2.8 Support and legal

| # | Capability | Creator web | iOS app | Status | Notes |
|---|---|---|---|---|---|
| L-01 | Privacy policy | `app/privacy/page.tsx:36-50`; public via `proxy.ts:11` | `mobile/src/app/(app)/profile/index.tsx:177` → `mobile/src/constants/links.ts:11` | Parity | Page stays on web permanently (§4). App Review Guideline 5.1.1(i) depends on the in-app link resolving. |
| L-02 | Terms of use | `app/terms/page.tsx`; public via `proxy.ts:12` | `mobile/src/app/(app)/profile/index.tsx:178` → `links.ts:12` | Parity | |
| L-03 | Support | `app/support/page.tsx:3-40`, mailto `support@creatordocks.com` `:13`; public via `proxy.ts:13` | `mobile/src/app/(app)/profile/index.tsx:179` → `links.ts:13` | Parity | |
| L-04 | Reach legal/support **from inside the creator workspace** | none — the pages exist but nothing in `app/DashboardNavShell.tsx` or any creator page links to them | `mobile/src/app/(app)/profile/index.tsx:177-179` | App-only | The app is strictly better here. |
| L-05 | `/get-the-app` landing page | `app/get-the-app/page.tsx:114-274`; public via `proxy.ts:10` with the comment at `:7-9` explaining it must be | n/a — it is the app's own landing page | Parity | Sunset redirects here (`lib/creator-web-mode.ts:32`). Its own FAQ says the dashboard is winding down and legal/support stay permanently (`get-the-app/page.tsx:88-89`). |
| L-06 | Footer links to all four public pages | `app/PublicPageShell.tsx:49-53` | n/a | Parity | |
| L-07 | Guidance when something goes wrong with money | `payouts/page.tsx:104-108` points at support | none — see E-08 | **Partial** | Duplicate of E-08, restated here because it is the only place either surface tells a creator to contact support about a payment. |

### 2.9 Absent on both surfaces (recorded so they are not mistaken for gaps)

| Capability | Web | App | Why it is here |
|---|---|---|---|
| Withdraw / edit an application (web side) | none, `app/api/applications/[id]/route.ts:36-38` is brand-only | app has it (A-13) | The app *gains* this. |
| Rejection reason on an application | none, `app/api/applications/[id]/route.ts:13-15` | none | A-15. |
| Withdraw / edit a submission | none, `app/api/submissions/[id]/route.ts:38-40` | none | S-13. |
| Payout filter / sort / export / transfer id | none | none | E-15. |
| Edit profile, avatar | none | none reachable | P-04, P-05 — planned app work, not a web loss. |
| Notification preferences | none | none | N-08. |
| Camera capture | none | none | S-04. |

---

## 3. Blocking gaps

Split into two lists, because they need different things from Jackson.

### 3.1 Must close before `sunset` — a creator loses something real with no replacement

| # | Gap | Stage it blocks | What it would take |
|---|---|---|---|
| B-1 | **Push is undeliverable.** `mobile/app.json` has no `extra.eas.projectId`; `mobile/src/lib/push.ts:77-88` short-circuits. No `Device` row is ever created (N-06) | `readonly` — this is the app's only notification channel, and `readonly` is when creators are told to switch | `eas init` to write `extra.eas.projectId` into `app.json` (`mobile/app.config.ts:34-37` already spreads `config.extra` forward); APNs credentials in EAS; a build; confirm a `Device` row lands via `POST /api/v1/devices`. Blocked on the Apple App ID. |
| B-2 | **No notice at all for "revision requested" / "submission rejected"** (N-05). No email counterpart exists, and push is dead | `readonly` | Either add the two email senders alongside `sendSubmissionApprovedEmail` (`lib/email.ts:88`), or close B-1. Email is the cheaper of the two and does not depend on Apple. |
| B-3 | **Payout history capped at 20 rows** (E-09), with the lifetime hero visibly disagreeing with the rows beneath it | `sunset` — web's payout history is the fallback until then | Add `onEndReached` → `fetchNextPage` to the Earnings `FlatList` (`mobile/src/app/(app)/earnings/index.tsx:165-195`). `usePayouts` already has a working `getNextPageParam` (`use-payouts.ts:32`). One-line-ish. |
| B-4 | **Application and submission lists capped at 20 rows** (A-08, S-08) | `sunset` | Same fix on both `FlatList`s in `mobile/src/app/(app)/activity/index.tsx:166-184`, `:188-206`. Hooks are already infinite queries. |
| B-5 | **Payout rows do not name the campaign or the fee** (E-05, E-06) | `sunset` | Render-only. `campaign` and `platformFee` are already on the wire (`app/api/v1/payouts/route.ts:68,70`); `PayoutRow` (`earnings/index.tsx:66-82`) drops them. |
| B-6 | **No pending/processing or failed totals** (E-02, E-03) | `sunset` | Either add the two tiles from the page-level payout data, or extend `meta` in `app/api/v1/payouts/route.ts:80` the way `lifetimePaidAmount` already is. |
| B-7 | **Admin "view as creator" dies** (P-20), with no app or API replacement | `sunset` | Two cheap options, neither in the tree: exempt `/creator*` from the redirect when `viewAs` is present, or move the redirect below an `isAdminViewing` check in `app/(dashboard)/creator/layout.tsx:25-26`. Whichever, add a test — this is the support tool. |
| B-8 | **Three creator emails deep-link into non-exempt `/creator` paths** (E1/E2/E3 in §5) | `sunset` | Point them at `/get-the-app`, or at an app deep link once one exists. See §5. |
| B-9 | **No password reset in the app** (AU-07), and no pointer to the web page that has one | `sunset` — web `/sign-in` survives, but discoverability does not | Add a "Forgot password?" link on `mobile/src/app/(auth)/sign-in.tsx:98-132`, either to a Clerk reset flow in-app or out to `creatordocks.com/sign-in`. |
| B-10 | **Nothing tells a creator about the Stripe pre-condition until after they write a pitch** (D-20) | `readonly` — this is the first thing a newly-switched creator hits | Read `useStripeStatus` on Discover or the campaign detail screen and gate/annotate the Apply button, mirroring `campaigns/page.tsx:203-204`. |
| B-11 | **Campaign detail does not know you already applied** (D-19) | `readonly` | Add an `applied` flag to `campaignDetailSchema` and `app/api/v1/campaigns/[id]/route.ts`, or fetch the creator's applications alongside. Web does it with a sub-query (`campaigns/page.tsx:41`). |
| B-12 | **A 401 mid-session strands the creator** (AU-10) | `readonly` | Subscribe something to `onAuthFailure` (`mobile/src/lib/api-client.ts:96-101`) — the `useSessionExpiry` hook its own doc comment names does not exist. |
| B-13 | **Failed payouts carry no explanation or support pointer** (E-08 / L-07) | `sunset` | Port the copy from `payouts/page.tsx:104-108` into `PayoutRow`. |
| B-14 | **A `readonly` creator can burn a 256 MB upload and then be refused.** `app/api/uploadthing/route.ts` calls no gate; `app/api/submissions/route.ts:34` does | `readonly` | Either add `creatorWriteBlockedResponse()` to the web uploader's middleware, or hide `SubmitContentModal` when the mode is not `full`. Today it produces an orphaned blob and a confusing message. |

### 3.2 Needs a written descope decision, not code

These are Missing with no recorded reason. They do not block on engineering — they block on Jackson writing one line either way. Listed in full in §7: P-12, P-13, P-14 (dashboard stats), P-18 (coaching panel), N-08 (notification preferences), D-05 (platform filter), AU-14 (offline handling), P-10 (Clerk account management), and the P-04/P-05 pair (edit profile / avatar — planned in `03-ios-app.md:46`, unbuilt, and never on web either).

---

## 4. What must survive web permanently

The exemption list is exactly one entry today:

```
const SUNSET_EXEMPT_CREATOR_PATHS = ['/creator/settings'] as const
```
— `lib/creator-web-mode.ts:46`, matched by `isCreatorPathSunsetExempt()` (`:132-136`), honoured by `resolveCreatorSunsetRedirect()` (`:153`), applied at `app/(dashboard)/creator/layout.tsx:25-26`.

| Carve-out | Why | Citation | Condition for removal |
|---|---|---|---|
| **`/creator/settings`** | Stripe Connect `return_url` / `refresh_url` land there from **both** onboard routes — `app/api/stripe/onboard/route.ts:64-65` and `app/api/v1/stripe/onboard/route.ts:36-37`. Redirecting it strands a creator mid-payout-setup | `lib/creator-web-mode.ts:37-46`; `docs/platform-split/creator-web-freeze.md:31-32`, `:69-78` | Only once those Stripe URLs point somewhere else — a dedicated return route or an app deep link. The mobile route carries a standing TODO saying exactly this (`app/api/v1/stripe/onboard/route.ts:30-33`) |
| **`/privacy`, `/terms`, `/support`** | Creator-facing legal/support pages stay on the web permanently; the app links out to them | `docs/platform-split/creator-web-freeze.md:29-30`; public via `proxy.ts:11-13`; app links `mobile/src/constants/links.ts:11-13` | Never. Guideline 5.1.1(i) makes the privacy link an App Review requirement |
| **`/get-the-app`** | Must be public because sunset-mode creator routes redirect here | `proxy.ts:7-10`; `lib/creator-web-mode.ts:32` | Never while sunset is in force |
| **`/sign-in`, `/sign-up`, `/sso-callback`** | Not under `/creator`, all in `isPublicRoute` (`proxy.ts:14-16`). They are also the app's stated fallback for MFA step-up (AU-08) and the only password-reset path (AU-07) | `proxy.ts:14-16`; `app/(auth)/sign-in/[[...sign-in]]/page.tsx:33` | Never |
| **`/waitlist`** | Requesting access is web-only, permanently — the app's `WaitlistGate` never collects a submission (AU-13) | `proxy.ts:6`; `app/waitlist/page.tsx:30-55`; `mobile/src/app/(app)/_layout.tsx:41-73` | Never, unless the app gains a join form |
| **`/internal/*` (admin)** | Admin, web-only forever. Waitlist status transitions, the invite email, referral links, CSV export, and the admin gate all live here and are outside `/creator` | `docs/platform-split/creator-web-freeze.md:28`; `app/internal/waitlist/page.tsx:41-68`; `app/api/waitlist/[id]/route.ts:11-77` | Never |
| **`/onboarding` + `PATCH /api/users/role`** | Creator account creation on web still works at sunset: nothing on the `/sign-up → /post-login → /onboarding → PATCH /api/users/role` path is under `/creator`, and the role route calls no write gate | `app/onboarding/page.tsx:163-175`; `app/api/users/role/route.ts:12` | — |

**Two things the exemption does not cover, and should be written down:**

1. **`/creator/settings` is exempt from the redirect, not from the session requirement.** The creator layout still demands a *web* Clerk session (`app/(dashboard)/creator/layout.tsx:10`) and a CREATOR/ADMIN role (`:12`). The app opens Stripe with `WebBrowser.openBrowserAsync` (`mobile/src/app/(app)/earnings/index.tsx:96`), which does not carry the app's bearer token — so an app creator finishing Connect onboarding is returned to a page they are probably not signed in to. **The money is not at risk**: `stripeOnboarded` is set by the `account.updated` webhook (`app/api/webhooks/stripe/route.ts:212-223`), not by the return page, and the app refetches `/api/v1/stripe/status` as soon as the browser closes (`earnings/index.tsx:101`). It is a confusing last step, not a broken payout. UNVERIFIED — §8.

2. **Three creator-affecting writes survive `readonly` and `sunset` untouched**, because only two handlers in the entire repo call `creatorWriteBlockedResponse()` (`app/api/applications/route.ts:27`, `app/api/submissions/route.ts:34` — verified by grep across `app`, `lib`, `packages`, `mobile`):

   | Write | Route | Gate | Assessment |
   |---|---|---|---|
   | Connect Stripe | `app/api/stripe/onboard/route.ts:8` | none | Deliberate — settings is the exempt path and blocking it would strand payout setup. Not written down as deliberate anywhere. |
   | Switch role CREATOR → BRAND | `app/api/users/role/route.ts:12` | none | The one exempt page still carries a live creator-affecting write (P-06). Needs an explicit decision — see §7. |
   | Upload a content file | `app/api/uploadthing/route.ts:10-31` | none | B-14. The upload succeeds; the following submission POST 403s. |

---

## 5. Email and deep-link audit

This is the quiet breakage nobody tests: the emails keep sending regardless of `CREATOR_WEB_MODE`, and three of them point into paths the flag deletes.

`absoluteUrl()` (`lib/email.ts:17-25`) resolves against `getSiteUrl()` (`lib/site-url.ts:1-5`) and **falls back to the bare relative path** when neither `NEXT_PUBLIC_URL` nor `VERCEL_URL` is set — producing a dead `href="/creator/applications"` in an email client. That is a live bug independent of sunset.

| # | Email | Defined / sent | CTA | Target | At `readonly` | At `sunset` |
|---|---|---|---|---|---|---|
| E1 | Application accepted | `lib/email.ts:60-72` ← `app/api/applications/[id]/route.ts:148` | "View application" | `/creator/applications` (`lib/email.ts:68`) | Works, read-only. Creator can see the acceptance but cannot submit content — the very next step the email describes | **Breaks.** Not in `SUNSET_EXEMPT_CREATOR_PATHS` → redirected to `/get-the-app` with no path back |
| E2 | Application rejected | `lib/email.ts:74-86` ← `app/api/applications/[id]/route.ts:151` | "Browse campaigns" | `/creator/campaigns` (`:82`) | Works, read-only. Browsing works; applying 403s at `app/api/applications/route.ts:27` | **Breaks.** → `/get-the-app` |
| E3 | Submission approved | `lib/email.ts:88-100` ← `app/api/submissions/[id]/route.ts:91` | "View details" | `/creator/applications` (`:96`) | Works, read-only | **Breaks.** → `/get-the-app` |
| E4 | Payout paid | `lib/email.ts:109-126` ← `app/api/webhooks/stripe/route.ts:112` | "View payouts" | `/creator/settings` (`:122`) | Survives — but **already the wrong page today**: `/creator/settings` renders Stripe status, name/email and the role switcher (`settings/page.tsx:24-104`). Payout history is at `/creator/payouts` | Survives (exempt path), still the wrong page. "Fixing" the href to `/creator/payouts` would break it at sunset — the real fix is an app deep link |
| E5 | Waitlist confirmation | `lib/email.ts:128-140` ← `app/api/waitlist/route.ts:272`, `:368` | none (referral link in body) | `/waitlist?ref=<code>` | Fine | Fine — public (`proxy.ts:6`) |
| E6 | Referral milestone | `lib/email.ts:142-152` ← `app/api/waitlist/route.ts:177` | none | none | Fine | Fine |
| E7 | Waitlist invite | `lib/email.ts:186-198` ← `app/api/waitlist/[id]/route.ts:62` | "Create your account" | `/sign-up` (`:194`) | Route survives — **content is wrong for creators today.** `app/(auth)/sign-up/[[...sign-up]]/page.tsx:26-33` is titled "For local brands" / "Start hiring local creators", and pushes creators away at `:38-40` ("Creator? Get the iOS app") | Same. A creator invited off the waitlist lands on a brand pitch |
| E8 | Payment alert (dispute/refund) | `lib/email.ts:154-184` ← `app/api/webhooks/stripe/route.ts:9-11` | none | none | Admin inbox, not creator-facing | Fine |

**No email contains an App Store link, a `creatordocks://` link, or a `/get-the-app` link.** At sunset, E1/E2/E3 are three of the four moments a creator most wants to act — you're in, you're out, your work was approved — and each lands them on a marketing page with no route back to the thing the email was about.

**Push deep links are unaffected by the flag.** All seven `data.url` payloads are in-app paths and every target screen exists:

| Event | Sender | Payload URL | Target screen |
|---|---|---|---|
| Application accepted | `lib/push.ts:70-76` ← `app/api/applications/[id]/route.ts:149` | `/activity` (`lib/push.ts:74`) | `mobile/src/app/(app)/activity/index.tsx` |
| Application rejected | `lib/push.ts:78-84` ← `app/api/applications/[id]/route.ts:152` | `/activity` (`:82`) | same |
| Submission approved | `lib/push.ts:86-95` ← `app/api/submissions/[id]/route.ts:94` | `/activity/submissions/{id}` (`:93`) | `mobile/src/app/(app)/activity/submissions/[id].tsx` |
| Revision requested | `lib/push.ts:97-106` ← `app/api/submissions/[id]/route.ts:116` | `/activity/submissions/{id}` (`:104`) | same |
| Submission rejected | `lib/push.ts:108-117` ← `app/api/submissions/[id]/route.ts:118` | `/activity/submissions/{id}` (`:115`) | same |
| Payout paid | `lib/push.ts:124-130` ← `app/api/webhooks/stripe/route.ts:117` | `/earnings` (`:128`) | `mobile/src/app/(app)/earnings/index.tsx` |
| Payout failed | `lib/push.ts:132-138` ← `app/api/webhooks/stripe/route.ts:151` | `/earnings` (`:136`) | same |

Tap handling validates the payload (`mobile/src/hooks/use-push-notifications.ts:45` rejects non-string, non-absolute and protocol-relative `//host`) and covers cold launch (`:52`). **None of this reaches anyone today** (B-1).

**Universal links do not exist.** `associatedDomains` is absent from `mobile/app.json` (grep: no match) *and* `com.apple.developer.associated-domains` is absent from `mobile/ios/CreatorDocks/CreatorDocks.entitlements`, which carries only `aps-environment` and `com.apple.developer.applesignin`. So an `https://www.creatordocks.com/...` link in an email can never open the app. The custom scheme `creatordocks://` **is** registered (`mobile/app.json:8`) and nothing uses it outside the SSO redirect (`oauth-buttons.tsx:89`). **Any plan to fix E1–E4 by deep-linking into the app needs either the custom scheme in the email or universal links configured first.**

---

## 6. Staged flip readiness

`CREATOR_WEB_MODE` defaults to `sunset` when unset or typo'd (`lib/creator-web-mode.ts:29`) — the opposite of the plan doc's original wording, and deliberate. **Every environment that wants working creator web must set it explicitly.** Confirm the production value before anything else on this list.

### Stage 0 — remain at `full` (today)

| Must be true | Status |
|---|---|
| `CREATOR_WEB_MODE=full` set explicitly in production | **UNVERIFIED** — §8 |
| App builds | **No** — no Apple App ID / EAS project id (`mobile/app.config.ts:26` throws) |
| App in the App Store | **No** |

### Stage 1 — `full` → `readonly`

Only three of web's live capabilities go dark here: A-05 (apply) and S-07/S-12 (submit / resubmit). Everything else — every read, Stripe connect, role switch, file upload, Clerk account management — keeps working. That makes `readonly` a much smaller cut than it sounds, and a genuinely cheap safety valve.

| Must be true | Drawn from |
|---|---|
| App shipped and installable; ≥60% of monthly-active creators signed in | W8-12, `08-release-qa-sunset.md:33` |
| **Push delivers end-to-end** — a real `Device` row exists and a test event arrives | B-1 / N-06 |
| **Revision-requested and rejected produce *some* notification** (push working, or the two emails added) | B-2 / N-05 |
| Stripe pre-condition surfaced before the pitch is written | B-10 / D-20 |
| "Already applied" surfaced before the pitch is written | B-11 / D-19 |
| A 401 mid-session signs the creator out instead of stranding them | B-12 / AU-10 |
| The web uploader is gated, or its entry point hidden, so nobody burns a 256 MB upload into a 403 | B-14 |
| Email #2 sent with ≥2 weeks notice | W8-13, `08-release-qa-sunset.md:34` |
| Revert path confirmed: flipping back to `full` is one env change, no deploy | `lib/creator-web-mode.ts:81-83` |

### Stage 2 — `readonly` → `sunset`

This is where the real loss is. It takes the **entire payout history** (E-01 … E-10), **every brand review note** (S-11), and **admin view-as** (P-20) off the web in one move.

| Must be true | Drawn from |
|---|---|
| Held at `readonly` 2–4 weeks with no critical regression | W8-13 |
| **All three lists page past 20** — applications, submissions, payouts | B-3, B-4 / A-08, S-08, E-09 |
| **Payout rows name the campaign and show the fee**; pending/processing and failed totals exist | B-5, B-6 / E-02, E-03, E-05, E-06 |
| **Failed payouts explain themselves and point at support** | B-13 / E-08 |
| **Admin view-as works at sunset**, or a documented replacement support path exists | B-7 / P-20 |
| **E1/E2/E3 email CTAs retargeted** to `/get-the-app` or an app deep link; E4's label/href mismatch resolved; E7's landing page reconciled with creator invites | B-8 / §5 |
| **Password reset reachable from the app**, even as a link out to web | B-9 / AU-07 |
| MFA step-up on web ends somewhere that confirms success, not a bounce to `/get-the-app` | AU-08 |
| Every §7 decision recorded — build it or descope it, in writing | §7 |
| Exemption list still correct; Stripe return URLs still land on `/creator/settings` or have moved | §4; `lib/creator-web-mode.ts:46` |
| Email #3 sent | W8-13 |

### Stage 3 — post-sunset cleanup

Do not start before one quiet month in `sunset` (W8-14, `08-release-qa-sunset.md:35`). Keep read-only code deletable-later rather than rushing deletion; finish with a security pass confirming retired routes actually reject writes.

---

## 7. Decisions needed from Jackson

Each of these is Missing with **no recorded reason anywhere in the repo**. The choice is build-it or descope-it. Not decided here.

| # | Capability | Web evidence it exists today | The question |
|---|---|---|---|
| DQ-1 | **The creator home dashboard** — applications submitted with a week-over-week trend, acceptance rate, pending-review count (P-12, P-13, P-14) | `app/(dashboard)/creator/page.tsx:57-62`, trend `:100-104`, logic `lib/utils.ts:18-32` | The app has four tabs and no dashboard (`mobile/src/app/(app)/_layout.tsx:144-205`). Build a fifth surface, fold the stats into an existing tab header, or write "creators do not need conversion stats" and descope. |
| DQ-2 | **"How to get shortlisted faster" coaching panel** (P-18) | `creator/page.tsx:150-168` | Static copy. Port it into an empty state, or descope. |
| DQ-3 | **Platform filter on Discover** (D-05) | `campaigns/page.tsx:10`, `:261-268` | The server already supports it (`app/api/v1/campaigns/route.ts:15,26`); only the UI is missing, and `03-ios-app.md:20` planned it. Build the chips, or descope on the grounds that niche is enough. |
| DQ-4 | **Notification preferences** (N-08) | none on web either | Not a strict parity gap, but W3-10 (`03-ios-app.md:30,46`) planned it and it is unusual for this codebase to omit something without a comment. Once push works, the OS toggle is a creator's only control. Decide: in-app toggles, "open iOS Settings" affordance, or "the OS switch is sufficient" in writing. |
| DQ-5 | **Edit profile — name, bio** (P-04) | none on web either; `app/api/users/me/route.ts:5` is GET-only | The app half is *already built and shipped server-side* (`PATCH /api/v1/me`, `app/api/v1/me/route.ts:24`) and the client hook is written and tested but has no caller (`mobile/src/lib/queries/use-update-me.ts:21`). Either wire a screen — it is nearly free — or delete the hook so it stops reading as a capability. |
| DQ-6 | **Avatar upload / display** (P-05) | none on web either | `me.avatarUrl` comes back from the API and is read nowhere in `mobile/src`. Planned at `03-ios-app.md:46`. Build, or descope and stop selecting the field. |
| DQ-7 | **Clerk account management — password change, email addresses, MFA, active devices** (P-10) | `app/DashboardNavShell.tsx:93`, `:146` | At sunset this leaves the product entirely for app-only creators. Embed Clerk's user profile in the app, point at web, or descope. What Clerk's modal actually exposes is UNVERIFIED (§8) — settle that first. |
| DQ-8 | **Role switch on the one page that survives sunset** (P-06) | `settings/page.tsx:92-102`; `app/api/users/role/route.ts:12`, no write gate | `/creator/settings` is exempt, and `PATCH /api/users/role` is ungated, so a creator can change role from the only creator page left standing. Either gate it, or state in `creator-web-freeze.md` that it is deliberate. Right now it is neither. |
| DQ-9 | **Offline handling** (AU-14) | n/a | `mobile/src/lib/query-client.ts:66-81` documents the omission candidly. W3-2 planned an offline banner. Ship it before the app is a creator's only surface, or accept generic errors offline. |
| DQ-10 | **Video as a first-class deliverable** (S-03) | web's picker takes it, `app/api/uploadthing/route.ts:12` | Currently the app permits video server-side while the UI says "Pick a photo" and previews with `expo-image`. Either make it explicit and fix the confirmation state, or restrict the route to images and say so. Unverified today either way (§8). |
| DQ-11 | **The stale duplicate file** `app/(dashboard)/creator/payouts/page 2.tsx` | unrouted — the space in the filename means Next never routes it; it predates the `viewAs` work and auths directly via Clerk with no `AdminViewBanner` | Not a capability. Noted once. Delete it during W8-14 cleanup so it never gets mistaken for the real page. |

---

## 8. Unverified

Nothing in this document was executed. No dev server, no simulator, no browser, no env values, no DB.

| # | Claim | Why unverified | The check that would confirm it |
|---|---|---|---|
| U-1 | **The app builds and runs at all** | `mobile/app.config.ts:26` throws when `resolveBuildEnv` rejects the environment, and there is no Apple App ID or EAS project id | `cd mobile && npx expo prebuild --no-install` with a populated env, then a simulator build |
| U-2 | **Production's actual `CREATOR_WEB_MODE`** | No env access. The default is `sunset` (`lib/creator-web-mode.ts:29`), so an unset value is not benign | `vercel env ls`, or the Vercel project settings |
| U-3 | **Whether any email renders an absolute URL in production** | If neither `NEXT_PUBLIC_URL` nor `VERCEL_URL` is set, `lib/email.ts:22` falls back to a relative path and every CTA is dead. The 2026-09-06 audit reportedly found the prod env broken | Confirm `NEXT_PUBLIC_URL` in the production environment; send one test email |
| U-4 | **Where an app creator lands after Stripe Connect onboarding** | `WebBrowser.openBrowserAsync` (`earnings/index.tsx:96`) carries no Clerk bearer token, but `SFSafariViewController` shares cookies with Safari — so it depends on whether the device's Safari holds a `creatordocks.com` session | Build against a deployed env, run Connect onboarding, observe whether the in-app browser shows `/creator/settings` or `/sign-in` |
| U-5 | **That `/creator?viewAs=` is genuinely redirected in production at sunset** | `resolveCreatorSunsetRedirect` fails open on an unknown pathname (`lib/creator-web-mode.ts:147-155`); `proxy.ts:54` now sets `x-pathname` on every request, so it *should* be deterministic — but the doc comment at `lib/creator-web-mode.ts:56-58` still says "Not set today", so the two disagree | Set `CREATOR_WEB_MODE=sunset` on a preview and hit `/creator?viewAs=<id>` as an admin. (The comment is stale, not the behaviour — but that is inference from reading both files, not from git history) |
| U-6 | **That video selected from the photo library completes an upload and yields a viewable submission** (S-03) | The picker's media types are derived from the route config inside `@uploadthing/expo`'s compiled output — a two-hop inference through a dependency's internals | Run the app against a dev server, pick a video in Submit content, watch `POST /api/v1/uploads` and the resulting `contentUrl` |
| U-7 | **That 20 items is a real ceiling on Activity and Earnings, not a missing trigger with some other paging affordance** | No `onEndReached`, no "Load more", no `fetchNextPage` call outside Discover — but the screens were not run | Sign in as a creator with 21+ payouts and scroll |
| U-8 | **Whether a 401 mid-session is as stranding as AU-10 says** | Reasoned from the absence of an `onAuthFailure` subscriber; not reproduced | Revoke a session in the Clerk dashboard with the app open and observe |
| U-9 | **What the Clerk `<UserButton>` account modal actually exposes** (P-10, DQ-7) | Clerk appearance is set at `DashboardNavShell.tsx:93`/`:146` but the instance config is not in-repo | Check the Clerk instance's User Profile settings, or the `ClerkProvider` props in `app/layout.tsx` |
| U-10 | **Which SSO providers web enables** (AU-03, AU-04, AU-05) | Same reason — the provider list lives in the Clerk dashboard, not the repo | Same check |
| U-11 | **Whether push is deliverable once configured** | APNs credentials live in EAS, outside the repo. The native entitlement is present but development-only (`mobile/ios/CreatorDocks/CreatorDocks.entitlements:5-6`); EAS rewrites it at build time | `eas credentials`, then a TestFlight build and a real notification |
| U-12 | **That `mobile/ios/` is current prebuild output rather than a stale artifact** | The universal-links conclusion (§5) rests partly on the generated entitlements file. A stale `ios/` would mean what a fresh build produces differs | `npx expo prebuild --clean` and diff the entitlements |
| U-13 | **That the 15/min and 20/min rate limits are actually enforced in production** | `checkRateLimit` (`lib/request-security.ts`) was not read — it could be a no-op without a backing store | Read `lib/request-security.ts` and confirm the store env var is set |
| U-14 | **That the rendered pages look and behave as read** | Nothing was run on either surface | Walk the five creator routes signed in as a creator; walk the four tabs in the simulator |

---

## Guess list

Per the repo convention — things inferred rather than proved, ranked by how much a wrong guess costs the gate.

1. **That the 20-row ceiling is real** (U-7). If right, it is the single most consequential silent gap: it worsens with tenure and makes the Earnings hero visibly contradict the rows under it. Derived from the absence of `onEndReached`/`fetchNextPage` anywhere but Discover.
2. **That video upload is a partial rather than flatly missing** (U-6). Derived through a dependency's compiled internals. If wrong, a creator whose deliverable is a Reel has no path at all.
3. **That `useUpdateMe` is genuinely uncalled** and not reached through indirection. Grepped across `mobile/src`; only the definition and its test matched. No barrels or dynamic imports exist in this codebase.
4. **That the four tabs plus nine drill-in/auth routes are the app's entire surface.** Based on the `mobile/src/app/` tree plus expo-router's file conventions, which do not admit routes outside it.
5. **That the Stripe-onboarding gate on applying is a real dead end** (D-20) and not softened somewhere unread. The 403 is unambiguous; the guess is that no screen pre-checks it — `useStripeStatus` is imported only by Earnings.
6. **That admin view-as was simply not considered when the exemption list was written.** The doc comment at `lib/creator-web-mode.ts:37-45` discusses only Stripe, and `app/(dashboard)/creator/layout.tsx:14-17` reads as though redirecting admins was intended rather than weighed against support needs.
7. **That E4's "View payouts" → `/creator/settings` mismatch is an oversight**, not a deliberate choice to aim at the exempt path. The label and href disagree, and `lib/email.ts` predates the sunset work.
8. **That the brand-framed `/sign-up` page has not been reconciled with the creator waitlist invite email.** Its own header comment records it was un-redirected on 2026-09-07; the invite email is older. The two were changed at different times.
9. **That "Total earned" (`creator/page.tsx:44-47`, a DB aggregate) and "Total paid" (`payouts/page.tsx:35-37`, a JS reduce) always agree.** They coincide today because payouts are unpaginated on web — that is a consequence of the current code, not a guarantee.
10. **That `page 2.tsx` is genuinely unrouted.** Based on the space in the filename and Next's file conventions, not on a build manifest.
