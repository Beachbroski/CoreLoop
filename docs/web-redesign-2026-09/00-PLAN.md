# CreatorDocks Web Redesign — Master Plan

**Written 2026-09-08** by the planning session, from three Opus drafts and two adversarial reviews (`09-panel-critiques.md`). **Status: awaiting Jackson's go on Phase 1.** Nothing in the source tree has been touched; this directory is the only output so far.

**Authority order.** Jackson's words → this file → `01-design-brief.md` (appearance) / `02-engineering.md` (code) / `03-risk-verification.md` (checks). Where a section doc and this file disagree, this file wins; the section docs carry a banner saying so.

**Who reads what.**
- Jackson: this file, then the Phase 1 canvas.
- The orchestrating session: this file end to end, then `03` §2 before every wave.
- A build agent: §5 of this file (the standing rules), its own package in `02` §3, and the pages of `01` its package touches. Nothing else.

---

## 1. Decisions (locked by Jackson, 2026-09-07)

| # | Decision | Consequence |
|---|---|---|
| D1 | **Scope = the full brand journey.** Marketing (`/`, `/get-the-app`, `/waitlist`, `/privacy`, `/terms`, `/support`, 404), auth (`/sign-in`, `/sign-up`, `/sso-callback`, `/onboarding`, `/post-login`), every `/brand/*` page, the public and dashboard shells, icon and OG images. | **Untouched:** `app/(dashboard)/creator/**` (frozen), `app/internal/**` (admin), `app/globals.css` (until the last wave), API routes, `lib/` business logic, `prisma/`, `mobile/`. The gate `git diff --stat -- 'app/(dashboard)/creator' 'app/internal'` must stay empty for the whole project. |
| D2 | **Dark, coral-led, cinematic. One identity with iOS.** | Tokens derive from `mobile/src/constants/theme.ts`; cover art is a line-for-line port of `mobile/src/lib/cover-art.ts` with a parity test. Marketing and auth are always dark; the dashboard is dark by default with a working light mode and a System/Light/Dark control. |
| D3 | **Mockups first.** | Phase 1 produces a design canvas of seven artboards. No build wave starts on a page whose artboard Jackson has not approved. |
| D4 | **Branch `feat/web-redesign` in a separate worktree, cut from a clean commit.** | The other sessions committed on 2026-09-08 (tip `126e86b`). The cut happens at Phase 0. The redesign is **never merged to `main` by this project** — `main` is 47 commits ahead of production and a push is a deploy. |
| D5 | **Execution agents are Opus 5**, run through the Workflow tool. | `agent(..., { model: 'opus' })` resolves to the current Opus (Claude Opus 5, `claude-opus-5`). Waves of ≤ 6 packages, disjoint file ownership, one verifier per package, the orchestrator runs every gate itself. |

Open self-serve is decided (`MARKETPLACE_ACCESS=open` after Stripe), so every CTA is flag-aware: `invite` → `/waitlist`, `open` → `/sign-up`, resolved on the server.

---

## 2. What the panel changed (the critique, resolved)

Twenty-six findings; the ones that would have broken the build, and what the plan now says. Full list in `09-panel-critiques.md`.

| Finding | Resolution |
|---|---|
| Three drafts used three token vocabularies, and the unprefixed names collided with live legacy variables (`--text`, `--accent`) that creator/admin still resolve. | **One vocabulary, `--cd-` prefixed**, colour names mirroring mobile 1:1 (`--cd-bg`, `--cd-bg-element`, `--cd-bg-raised`, `--cd-bg-selected`, `--cd-text-faint`, `--cd-art-scrim` …). Fixed in `02` §2.1; `01` rewritten to match. |
| Two incompatible theme mechanisms (inline script + localStorage vs cookie + wrapper div), and the design draft stamped `<html>` from layouts that do not exist. | **Cookie read by the already-dynamic brand layout, stamped on a `.cd-app` div.** Dark on the bare `:root`, light as an override, `prefers-color-scheme` for the unstamped state. No inline script, no flash, marketing stays static. Theme toggle ships. |
| `app/styles/index.css` was a same-wave shared file (seven packages would have edited it) and it `@import`ed sheets that did not exist yet. | **Each component imports its own colocated CSS.** `index.css` holds four imports and is owned by one package. |
| A package restyled `DashboardNavShell`, `AdminViewBanner` and `ChangeRoleControl`, which the frozen creator pages also render. | **Fork, never restyle:** `components/brand/brand-nav-shell.tsx` and brand-scoped copies of the two others. The three shared files stay byte-identical. |
| The legacy-CSS isolation edited `globals.css` and two out-of-scope layouts. | **Zero touches.** `body:has(.cd-app)` in the new `base.css` out-cascades the legacy body gradient without editing it; `globals.css` is edited by exactly one package, alone, in the last wave. |
| Contrast pair #10 asserted something arithmetically false (one lighter cover-art stop clears 4.5:1). | Restated as "at least six of eight are below 4.5"; explicit rule that no agent may edit `COVER_ART_PALETTES` to satisfy a test. |
| `@testing-library/react` was claimed present; it is absent (only mobile's hoisted `dom`/`jest-dom`/`user-event`). | WP-02 declares every UI-test dependency in `marketplace/package.json`. |
| Fonts contradicted three ways; a variable was named as a mobile contract that nothing reads. | **Archivo (display, `wdth` axis) + Schibsted Grotesk (body)**, variables `--cd-font-display` / `--cd-font-body`, no mono token, Clerk uses the body face. `Fonts.web` in mobile is dead code. |
| `getAccessCta()` had two signatures. | `getAccessCta(slot)` with four slots and eight frozen strings (`02` §2.11), one test per slot per mode. |
| Phase 1 had no package, no output path, no gate; the proposed gate would have failed every artboard (static HTML is inline styles and hex by nature). | **WP-00** below; artboards live in `docs/web-redesign-2026-09/mockups/*.dc.html`; a reduced visual-tell gate applies to them, not the source gate. |
| The engineering runbook merged to `main`. | Deleted. The branch and its Vercel Preview are the deliverable. |
| Anti-template greps demanded zero hits repo-wide, which frozen files can never satisfy. | `scripts/design-gate.sh` runs over an allowlist of redesign-owned paths, absolute zero for new files, a ratchet from the Wave-0 baseline for pre-existing ones. |
| The dashboard fixture labelled a gross figure "Paid to creators" — the exact net-vs-gross ambiguity that is still an open owner decision. | Money strip is `Committed · Still owed · Charged (incl. fees) · To creators`. The plan assumes gross-with-explicit-fee-line; approving artboard 3 settles `docs/BLOCKED-ON-JACKSON.md` #18. |
| Design defaults still present: an ambient art canvas behind the hero, the 7/5 hero split, a centered closing band, a staggered load sequence. | Ambient deleted (the art becomes a full-bleed content strip); hero shipped as two variants on the canvas for Jackson to pick; closing band left-aligned at the measure; load sequence cut to the slip's ledger rules printing. |
| Viewport 820 missing from the matrix while a legacy `max-width: 820px` block stays live during migration. | 820 is a mandatory screenshot viewport; the 768–1023 band is specified in `01` §4. |

---

## 3. The design in one screen

Read `01-design-brief.md` for everything; this is the shape.

**Thesis.** A cafe owner deciding whether to spend $400 on a stranger. Two materials in tension: **the slip** (money surfaces built like a card-terminal receipt: hairline rules, sharp corners, condensed tabular figures, every number named) and **the wall** (the only saturated colour is real campaign artwork, the same deterministic cover art the iOS app draws). One aesthetic risk: **shopfront-scale expanded display type** (Archivo at width 118, up to 88px, left-aligned, no accented word, no gradient). Everything else stays quiet.

**Tokens (dark, from mobile).** canvas `#07080b` · element `#12141b` · raised `#171a22` (web-only) · selected `#1b1e27` · text `#f7f8fa` / `#9ba1ae` / faint `#7d8492` (non-text only) · accent `#ff503d` (foreground) · accent-fill `#d64131` (white-text surfaces) · secondary `#5895f7` (informational, never a button) · success `#2dd4a8` · warning `#f0a93a` · danger `#f55b7f`. Light set from `Colors.light`. Every pair enforced by `lib/design-tokens.contrast.test.ts`.

**Type.** Archivo Expanded for headlines, Archivo Condensed with tabular figures for money and data, Schibsted Grotesk for everything read. No Inter, Space Grotesk, Plus Jakarta, mono.

**Grammar.** Radii 0/4/6/10/14 (buttons are 6px rectangles, not pills). No `backdrop-filter`, no blur, no orbs, no bento, no eyebrows, no uppercase labels, no `01/02/03` chips, no scroll reveals, no hover levitation, no shimmer. Tables and definition lists instead of card grids. One coral surface per page.

**Pages.** Landing = hero + slip → "what it costs you" ledger band → "how it runs" → art strip + mosaic → agency comparison table → creators/iPhone row → FAQ list → left-aligned coral band. Dashboard = "what is waiting on you and what it will cost": money strip as one object, "Needs you" list, campaigns **table**, pipeline bars; no marketing headline. Campaign builder gets a live brief preview showing the exact tile a creator sees plus the money line.

---

## 4. Phases and gates

### Phase 0 — Worktree and harness (orchestrator only, ~1 hour)

1. Source tree: `git status --short` shows only docs and the two known untracked files (`app/(dashboard)/creator/payouts/page 2.tsx`, `prisma/set-role.mjs`). Record the base SHA.
2. `git worktree add -b feat/web-redesign ../marketplace-redesign <sha>` — **outside iCloud if at all possible** (`~/dev/creatordocks-redesign` is the recommended path; the `..` form is the fallback).
3. Copy `.env.local` and `.env` in (never `.env.production.local`); append `CREATOR_WEB_MODE=full`. Install (`cp -Rc node_modules` then verify, else `npm ci`), `npx prisma generate`.
4. Node 24 (`nvm use` reads `.nvmrc`); paste `node -v`.
5. Green baseline pasted from the worktree: `npm run typecheck && npm run lint && npm run test && npm run test --workspace=packages/shared`, with the test count.
6. Re-measure every baseline in `03` §0 in the worktree (class census, inline-style counts per directory, hex counts, `globals.css` bytes). The earlier numbers were taken on a dirty tree.
7. Start the **single** dev server on port **3100** (3000 and 8081 belong to other sessions). Capture Wave-0 "before" screenshots (390/820/1440) and a Lighthouse baseline for `/`, `/get-the-app`, `/sign-in`.

**Gate 0:** all of the above pasted; nothing edited.

### Phase 1 — Mockups (WP-00, one Opus agent + two reviewers, then Jackson)

`workflows/phase1-mockups.js` drafts the seven artboards of `01` §10 into `docs/web-redesign-2026-09/mockups/` as `.dc.html` files plus `canvas.json`, has two reviewers (fidelity to the brief; creative director) score them, applies the fixes, and returns. The orchestrator then seeds and publishes the canvas with the `design` skill and hands Jackson the link.

What Jackson approves, per artboard: the hero risk and **which hero variant (A or B)**; tables over cards; the single coral band; the dashboard money strip and the campaigns table; light mode as real; the Clerk retokenization; the two typefaces; the two new tokens and the two alpha divergences; the `--cd-text-faint` demotion to non-text; the money microcopy; **the brand mark (Option A: coral tile with "D" in Archivo; Option B: a drawn mark with no font dependency)**; the net-vs-gross assumption.

**Gate 1:** Jackson's written approval per artboard, comments resolved. Unapproved pages are out of Phase 2.

### Phase 2 — Build (five waves, `workflows/run-wave.js`)

| Wave | Packages | What exists after it |
|---|---|---|
| 1 Foundation | WP-01 tokens · WP-02 test infra · WP-03 contract guard + gates · WP-04 fonts/layout/theme · WP-05 cover art · WP-06 access CTA | `--cd-*` tokens proven against mobile; jsdom tests run; the frozen-surface and design gates exist; the app boots dark on Archivo/Schibsted; cover art renders identically to iOS; CTAs follow the flag |
| 2 Components + public chrome | WP-07 primitives · WP-08 surfaces · WP-09 forms · WP-10 data display · WP-11 chrome · WP-13 public shell + brand mark | `components/ui/*` with a test each; the new nav and footer |
| 3 Marketing + auth | WP-12 Clerk/Stripe appearance · WP-14 landing · WP-15 get-the-app · WP-16 waitlist · WP-17 legal/404 · WP-18 auth/onboarding | The public site and sign-in in the new identity |
| 4 Dashboard | WP-19 brand shell (forked) · WP-20 home · WP-21 metrics · WP-22 campaigns · WP-23 lists · WP-24 settings | The brand workspace, dark and light |
| 5 Identity, cleanup, guards | WP-25 icon + OG · WP-26 dead legacy CSS (alone) · WP-27 discipline guards · WP-28 design-system doc + coverage | Social cards in the real face; `globals.css` shrunk; inline-style and hex guards on |

**Gate per wave** (`scripts/wave-gate.sh`, run by the orchestrator, never delegated): `node -v` → the four gates → `git status --short` shows only the wave's declared files → empty diff under creator/internal → iCloud `* 2.*` sweep empty → frozen-class hashes unchanged → design-gate ratchet moved the right way → test count rose if tests were claimed → screenshots at 390/820/1440 (both themes for dashboard) → one conventional commit per package. A failed package is reverted (`git checkout -- <its files>`) and re-dispatched, never patched forward. `npx next build` from wave 3 on.

### Phase 3 — Verify and hand off

Full screenshot matrix (`03` §2.4, ~94 shots) from the single server, each passing the build-marker and font-loaded checks; rendered contrast probe including Clerk surfaces; keyboard walkthrough of `/sign-in`, `/brand`, `/brand/campaigns/new`; reduced-motion pass; Lighthouse budget (`03` §2.7); the copy-vs-code checklist (`03` §2.6) re-verified by the orchestrator against `path:line`; `git log <base>..origin/main -- app/ lib/ proxy.ts` empty or a reviewed rebase. Then `git push -u origin feat/web-redesign` → Vercel Preview (marketing + auth reviewable there; the dashboard only locally, because Preview has no `DATABASE_URL` and carries live Clerk keys). **Stop at the branch.**

---

## 5. Standing rules for every build agent (paste into every brief)

1. **You own exactly the files named in your package. Create or edit nothing else.** If you believe you need another file, stop and report — do not touch it.
2. **Never** edit `app/globals.css` (unless you are WP-26), anything under `app/(dashboard)/creator/`, `app/internal/`, `app/DashboardNavShell.tsx`, `app/(dashboard)/AdminViewBanner.tsx`, `app/(dashboard)/ChangeRoleControl.tsx`, `prisma/`, `proxy.ts`, or any flag default in `lib/creator-web-mode.ts` / `lib/admin-config.ts`.
3. **There is one database and it is production.** Never submit a form, click a mutating control, or send `POST`/`PATCH`/`DELETE` to a running server. Never run `prisma migrate`, `db push`, or `set-role.mjs`. Mutating states are verified from fixture-rendered component tests.
4. **Never start a dev server.** The orchestrator owns port 3100; you are given a URL if you need one. Never touch 3000 or 8081.
5. **Read before you write:** `AGENTS.md` (this Next.js differs from your training data — read `node_modules/next/dist/docs/` for any API you touch), `00-PLAN.md` §3, your package in `02-engineering.md` §3, and the `01-design-brief.md` sections for the pages you own.
6. **TDD.** Write the test file first, show it red, then implement. Component tests use the `ui` vitest project; pure logic uses `node`.
7. **House rules:** files 200–400 lines (800 max), functions under 50 lines, no mutation, explicit error handling, no hardcoded colours or sizes outside `lib/design-tokens.ts`, no `style={{}}` except to set a `--cd-*` custom property with a genuinely dynamic value, no `!important`, no new `NEXT_PUBLIC_*` variable, no `process.env` in any `'use client'` file.
8. **Anti-template rules are gates, not taste** (`01` §9): no `backdrop-filter`, no `filter: blur`, no `radial-gradient`, no radius 18–40px, no pill buttons, no eyebrows, no uppercase labels, no `01/02/03`, no emoji, no arrows in labels, no scroll reveals, no hover transforms, no shimmer, no mono.
9. **Money copy is derived, never typed:** the fee percentage comes from `PLATFORM_FEE_RATE()`; the fee is "out of" the rate, never "plus"; money buttons carry the number; always show the brand's charge and the creator's net as a pair.
10. **Finish with the nine-item paste** (`03` §2.1): `node -v`, typecheck, lint, test with count, shared-package test, `git status --short`, `git diff --stat`, the design-gate output for your files, and screenshots if you were given a URL. Then the guess list: what was unclear, what you guessed. Silence is not acceptable; "nothing" is.
11. **Work file by file.** Run `npx tsc --noEmit` after each file. Never leave a file unparseable across a tool-call boundary — an agent that dies mid-file breaks the whole wave.

---

## 6. Work package index

Details, owned files and acceptance criteria are in `02-engineering.md` §3 (corrected). This index is the dispatch list.

| WP | Title | Wave | Size | Owns (summary) |
|---|---|---|---|---|
| 00 | Phase 1 mockup canvas | P1 | L | `docs/web-redesign-2026-09/mockups/**` |
| 01 | Design tokens + contrast contract + mobile parity fixture | 1 | M | `lib/design-tokens.ts`, `lib/design-tokens.{contrast,css,parity}.test.ts`, `app/styles/tokens.css`, `lib/__fixtures__/mobile-colors.json`, `scripts/extract-mobile-colors.mjs` |
| 02 | Test infrastructure (jsdom project, coverage, deps) | 1 | S | `vitest.config.ts`, `tests/setup-ui.ts`, `package.json` devDeps, lockfile |
| 03 | Frozen-surface contract guard + design gate + wave gate | 1 | S | `tests/legacy-css-contract.test.ts`, `scripts/{frozen-classes.sh,frozen-classes.sha256,design-gate.sh,wave-gate.sh}` |
| 04 | Fonts, root layout, `index.css`, `base.css`, theme plumbing | 1 | M | `app/fonts.ts`, `app/layout.tsx`, `app/styles/{index,base}.css`, `lib/theme.ts` + test |
| 05 | Cover-art port + parity test + component | 1 | M | `lib/cover-art/**`, `components/ui/cover-art.*` |
| 06 | Flag-aware access CTA (slot-keyed) | 1 | S | `lib/access-cta.ts` + test, `components/ui/{access-cta,query-preserving-link}.*` |
| 07 | Primitives: Button, IconButton, Pill, StatusPill | 2 | M | `components/ui/{button,icon-button,pill}.*` |
| 08 | Surfaces: Surface, Section, PageHeader, SectionHeader, Banner, EmptyState, Skeleton, ListRow | 2 | L | `components/ui/{surface,section,page-header,section-header,banner,empty-state,skeleton,list-row}.*` |
| 09 | Forms: Field, Input, Textarea, Select, CheckboxChip | 2 | M | `components/ui/{field,input,textarea,select,checkbox-chip}.*` |
| 10 | Data display: MetricCard, Trend, MeterBar | 2 | M | `components/ui/{metric-card,trend,meter-bar}.*` |
| 11 | Chrome: ThemeToggle, NavItem, Drawer | 2 | M | `components/ui/{theme-toggle,nav-item,drawer}.*` |
| 13 | Public shell, nav, footer, BrandMark, admin preview banner | 2 | M | `app/PublicPageShell.tsx`, `app/PublicWaitlistLink.tsx`, `app/AdminPreviewBanner.tsx`, `components/ui/brand-mark.*` |
| 12 | Clerk + Stripe appearance from tokens | 3 | S | `lib/clerk-appearance.ts`, `lib/stripe-appearance.ts` + tests |
| 14 | Landing page | 3 | L | `app/page.tsx`, `app/(marketing)/_sections/**` |
| 15 | `/get-the-app` | 3 | M | `app/get-the-app/page.tsx`, `_sections/**` |
| 16 | Waitlist page + form (split ≤ 400 lines each) | 3 | L | `app/waitlist/**` |
| 17 | Legal, support, 404 (copy byte-identical) | 3 | S | `app/{privacy,terms,support}/page.tsx`, `app/not-found.tsx` |
| 18 | Auth pages, onboarding, sso-callback | 3 | M | `app/(auth)/**`, `app/sso-callback/**`, `app/onboarding/**` |
| 19 | Brand dashboard shell (forked) + theme stamp | 4 | M | `components/brand/{brand-nav-shell,admin-view-banner,change-role-control}.*`, `app/(dashboard)/brand/layout.tsx` |
| 20 | Brand home | 4 | M | `app/(dashboard)/brand/page.tsx`, `_home/**` |
| 21 | Metrics (split, `admin-*` classes removed) | 4 | L | `app/(dashboard)/brand/metrics/**` |
| 22 | Campaigns: detail, edit, new (+ live brief preview) | 4 | L | `app/(dashboard)/brand/campaigns/{[id],new}/**` except `[id]/applications/**` |
| 23 | Applications + submissions lists + review workspace | 4 | M | `app/(dashboard)/brand/{applications,submissions}/**`, `campaigns/[id]/applications/**` |
| 24 | Settings + appearance control | 4 | S | `app/(dashboard)/brand/settings/**` |
| 25 | Icon + OG images (real font buffers) | 5 | M | `app/icon.tsx`, `app/**/opengraph-image.tsx`, `app/_og/**`, `assets/fonts/**` |
| 26 | Dead legacy CSS removal (alone) | 5 | S | `app/globals.css`, contract snapshot |
| 27 | Discipline guards (no inline styles, no hex) | 5 | S | `tests/{no-inline-styles,no-hardcoded-colors}.test.ts`, `eslint.config.mjs` |
| 28 | Design-system doc + coverage threshold | 5 | S | `docs/design/web-design-system.md`, `package.json` scripts |

Collision audit after the fixes: no two packages in a wave share a file; `globals.css` belongs to WP-26 alone; `index.css` to WP-04 alone; the three shared dashboard components to nobody. The orchestrator re-runs the audit over the final owned-file lists before each wave.

---

## 7. How agents are dispatched

- **Model.** Every `agent()` call passes `model: 'opus'` (Claude Opus 5). Build agents run at `effort: 'high'`; verifiers at `effort: 'high'`; the mockup agent at `effort: 'max'`. The first agent of Phase 0 is asked to report its model id in its result so the alias is confirmed once.
- **Scripts.** `workflows/phase1-mockups.js` (Phase 1) and `workflows/run-wave.js` (one wave of Phase 2, parameterised by `args`). Both are inlined into the Workflow tool by the orchestrating session; the copies here are the source of truth.
- **Shape of a wave.** `pipeline(packages, build, verify)`: each package's build agent works in the shared worktree on its owned files only; its verifier (read-only, fresh context) re-runs the gates, checks `git status` against the owned-file list, checks every acceptance criterion, runs `design-gate.sh` on the package's files, and returns a verdict. The orchestrator then runs `wave-gate.sh` itself, commits package by package, screenshots, and only then dispatches the next wave.
- **Concurrency.** ≤ 6 packages per wave. Agents never commit; the orchestrator does.
- **Recovery.** A missing final paste or a failed verdict means `git checkout -- <owned files>` and a fresh dispatch of that one package. Nobody hand-patches a dead agent's file.
- **Between waves the orchestrator also checks:** `git log <base>..origin/main -- app/ lib/ proxy.ts` (another session landed something → rebase now, while it is small); `find . -name "* 2.*"` (iCloud duplicate → delete, never edit); `git diff` under `prisma/` is empty.

---

## 8. Definition of done

**Phase 1:** canvas published; seven artboards; reduced visual-tell gate passes on the artboard source; every money claim on the landing artboard maps to a row of `03` §2.6; both CTA modes shown; **Jackson's written approval with comments resolved.**

**Phase 2:** inline `style={{` in in-scope files = 0 (from 384); hardcoded hex in in-scope `.tsx` = 0 outside tokens and the OG exemption; `design-gate.sh` all zero on owned files; contrast test green for both palettes and mutation-proven; mobile colour parity and cover-art parity green; CTA test green for all slots and modes; zero hydration warnings; reduced motion neutralises every animation; `:focus-visible` on every control at ≥ 3:1; four OG/icon PNGs reviewed in the real face; `next build` green on Node 24; zero changed lines under creator/internal; the three shared dashboard components byte-identical; `globals.css` shrunk in the last wave with the contract snapshot only smaller.

**Phase 3:** full matrix captured and passing the marker/font checks; rendered contrast probe zero failures including Clerk; keyboard and reduced-motion passes recorded; Lighthouse budget met (`03` §2.7); copy checklist ticked by the orchestrator with `path:line`; pushed as `feat/web-redesign`, Preview green; a written statement of what was not covered (dashboard states unreachable without mutating production); **Jackson approves on Preview.** The merge to `main` is not part of this project.

---

## 9. What Jackson does, and what the plan assumes if he does not

| # | Ask | Type | Assumed if unanswered |
|---|---|---|---|
| 1 | **Say "go" for Phase 1.** Nothing in the source tree changes; the output is a canvas link. | DECIDE | Nothing starts. |
| 2 | **Approve or comment on the seven artboards**, including the hero variant and the brand-mark option. | DECIDE | No build wave runs. |
| 3 | **Sign in once in the Claude browser pane on `http://localhost:3100`** at each phase gate so dashboard, `/creator` and `/internal` screenshots can be taken. The orchestrator never handles credentials. | DO | Dashboard verification falls back to fixture-rendered component tests + `next build`; the DoD says so explicitly. |
| 4 | Real logo, wordmark or photography? | DO | None: typographic wordmark, drawn mark per artboard 6, zero photography. Generated cover art is the imagery. If real local-business photos exist, they are the single highest-leverage asset — say so. |
| 5 | Net vs gross (`BLOCKED-ON-JACKSON.md` #18). | DECIDE | Gross with an explicit fee line, as artboard 3 shows. Approving it decides it. |
| 6 | Does `/waitlist` stay? | DECIDE | Stays and is redesigned; it is the `invite`-mode destination and works live. |
| 7 | Node 24 canonical? | DECIDE | Yes (Vercel, `.nvmrc`, `engines`). |
| 8 | Delete `app/(dashboard)/creator/payouts/page 2.tsx`? | DO | Stays; agents ignore it and never edit it. |
| 9 | Legal-page copy (entity, venue, age, dates). | DO | Restyled only; content byte-identical including every `[PLACEHOLDER]`. |
| 10 | `MARKETPLACE_ACCESS` at launch. | DECIDE | Stays `invite`; both modes are built, tested and screenshotted. |
| 11 | Support response-time promise? | DECIDE | None invented; `support@creatordocks.com` as today. |

---

## 10. Guess list

What was unclear or had to be guessed while writing this plan:

1. **`model: 'opus'` resolves to Claude Opus 5.** That is the documented alias behaviour in this environment; the first Phase 0 agent reports its model id so it is confirmed rather than assumed.
2. **Clerk's development instance and port 3100.** Clerk dev instances usually accept any localhost port, but this was not verified. If sign-in on 3100 bounces, the fallback is to review auth pages signed out and ask Jackson to allow the origin — no agent changes Clerk configuration.
3. **`:has()` support** is assumed acceptable for the target audience (Safari 15.4+, Chrome 105+, Firefox 121+). Older browsers would see the legacy gradient behind the dark canvas on overscroll only; nothing breaks.
4. **The reviewers' design opinions** (delete the ambient, try the full-measure hero, left-align the closing band, cut the load stagger) were adopted as the default and the alternative hero is on the canvas. Jackson may prefer the original; the artboards exist to settle that, not this document.
5. **Whether the other sessions will edit brand-facing web files again.** They have committed and appear idle on web; the between-wave `origin/main` check catches it if not.
6. **Class census, inline-style counts, and the 50-class collision set** were measured on a dirty tree and once more by a reviewer; Phase 0 re-measures everything in the worktree and the package briefs are regenerated from those numbers, not these.
7. **Coverage.** No provider is installed, so the 80% house target is currently unmeasured; WP-02 installs it and WP-28 turns a threshold on over the scoped include list in `02` §5.3. Async server pages cannot be unit-tested under vitest (`vitest.md` says so) and are covered by `next build` plus screenshots — stated in the DoD rather than hidden.
