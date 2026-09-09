> **Resolutions applied 2026-09-08.** This section was drafted by an Opus panel on 2026-09-07 and then corrected against two adversarial reviews (see `09-panel-critiques.md`). Where this document and `00-PLAN.md` disagree, **`00-PLAN.md` wins.**

# RISK & VERIFICATION

**Role:** adversarial risk & verification lead. Everything below assumes the redesign fails and works backwards to the check that catches it first. Evidence is from the working tree at `/Users/jsteele/Desktop/CreatorDocks/marketplace` on branch `fix/ios-design-audit`, read 2026-09-07.

---

## 0. Baselines measured today (capture these again in Wave 0; they are the denominators for every check below)

| Fact | Value | Command / path |
|---|---|---|
| `app/globals.css` | 1,760 lines · 31,677 B · 6,553 B gzip | `wc -lc app/globals.css` |
| Class selectors defined in it | 143 unique top-level `.class` | `grep -oE "^\.[a-zA-Z0-9_-]+" app/globals.css \| sort -u` |
| **Classes used by BOTH in-scope and frozen (creator/internal) markup** | **50** | intersection census, §1.2 |
| Classes used only by frozen surfaces | 22 | same |
| Breakpoints | 3, all `max-width` (desktop-first): 1080 / 820 / 640 | `app/globals.css:1315,1429,1575` |
| `prefers-color-scheme` / `prefers-reduced-motion` / `focus-visible` / `data-theme` / `color-scheme` | **0 / 0 / 0 / 0 / 0** | `grep -c` on `app/globals.css` |
| `backdrop-filter` / `radial-gradient` / `@keyframes` | 9 / 5 / 4 | `app/globals.css` |
| Inline `style={{` in scope | brand 245, root `app/*.tsx` 64, get-the-app 33, waitlist 17, onboarding 17, support 3, auth 3, privacy 1, terms 1 = **384** | `grep -rho 'style={{'` — re-measure per directory in the worktree |
| Inline `style={{` in frozen | creator 176, internal 54 | same |
| In-scope `.tsx` | 27 files / 3,648 lines (+ `app/page.tsx` 247, + 5 shells 322) | `find … -name '*.tsx'` |
| Hardcoded hex | 33 in `globals.css`, 30 in in-scope `.tsx` | `grep -oE '#[0-9a-fA-F]{3,8}'` |
| Node on this laptop | **v25.9.0** vs `package.json` `engines: ">=24.0.0 <25.0.0"`, `.nvmrc` `24` | `node -v` |
| Port 8081 | **occupied** by a live `node` process (Metro/Expo, other session) | `lsof -nP -iTCP -sTCP:LISTEN` |
| Vitest | `environment: 'node'`, `include: ['tests/**/*.test.ts','lib/**/*.test.ts','app/**/*.test.ts']` — **`.tsx` is not matched** | `vitest.config.ts:7-8` |
| `.test.tsx` files in web today | **0** | `find app lib tests -name '*.test.tsx'` |
| In-flight uncommitted work | 41 files in `git diff --stat`, +1,529/−267, plus 19 untracked | `git status --short` |

---

## 1. Failure modes

Likelihood: **H** = expect it, **M** = even odds, **L** = tail risk but expensive.
Blast radius: what is broken and who sees it.

---

### F1 — An execution agent dies mid-file and leaves the tree uncompilable
**Breaks:** A package agent is killed by a usage limit partway through rewriting `app/globals.css` or a brand page. The file is left half-migrated: a dangling `@media` block, a component referencing a token that was never defined, or a `.tsx` with an unclosed JSX tree. The next wave's agents inherit a red `tsc` and cannot tell whose fault it is.
**Evidence:** `docs/PROJECT-STATE.md` §10 — *"assigned to subagents that usage limits killed mid-run."* `docs/production-readiness-2026-09-06.md:3` — *"the adversarial verification pass was cut short by usage limits."* This has already happened twice on this repo.
**Likelihood:** **H** (has occurred; ~1,760-line CSS file is the single most likely victim).
**Blast radius:** Whole wave. Every parallel agent's gate run fails, and each one may "fix" the corpse differently, producing merge chaos.
**Mitigation:**
- **Orchestrator:** never let two packages touch one file (§1.2 rule). Cap concurrency at **6**. After every wave, run gates *itself* and `git status --short` — never trust an agent's summary. Commit each package's work as its own conventional commit **before** starting the next wave, so a death costs one package, not one wave.
- **Build agent:** work file-by-file, not repo-wide; run `npx tsc --noEmit` after each file, not only at the end; never leave a file in a state where it does not parse across a tool-call boundary.
- **Orchestrator recovery rule:** if a package's final gate paste is missing, `git checkout -- <that package's files>` and re-dispatch. Do not hand-patch a dead agent's work.

---

### F2 — The new design system and the 1,760-line legacy stylesheet fight in the cascade
**Breaks:** New token/component CSS is appended to `globals.css` (or added as a new file imported after it). Legacy rules like `.glass-card`, `.apple-btn`, `.metric-card` are plain single-class selectors at equal specificity, so **source order decides** — and Tailwind v4's `@import "tailwindcss"` sits at line 1, meaning utility classes lose to every handwritten rule below them. An agent adds `bg-[--surface]` to a `.glass-card` and nothing happens; the next agent "fixes" it with `!important`; by Wave 3 the stylesheet has a specificity war and light mode is unreproducible.
**Evidence:** `app/globals.css:1` `@import "tailwindcss";` followed by 1,759 lines of handwritten rules. 143 class selectors, all low-specificity. 367 inline `style={{}}` props in scope, which beat *every* stylesheet rule regardless of order.
**Likelihood:** **H**.
**Blast radius:** Every visual surface. Non-deterministic — appears as "it looks right on my machine" and wrong after a rebuild.
**Mitigation:**
- **Owner-level architectural rule (orchestrator enforces):** the legacy stylesheet is **frozen and additive-only**. No agent edits or deletes an existing rule in `app/globals.css` during Waves 1–N. New system lives in new files (`app/styles/tokens.css`, `app/styles/base.css`, `app/styles/components/*.css`) imported *after* `globals.css`, with a distinct namespace prefix so a legacy and a new rule can never collide by name.
- Migration is **by replacement in markup**, not by editing CSS: an in-scope file stops emitting `glass-card` and starts emitting the new class. The legacy rule is then dead for that file but still alive for creator/internal.
- **Zero `!important`** in new files — grep gate (§2.3).
- A dedicated **final** package (own wave, alone) does the orphan sweep: delete only legacy rules whose class name has **zero** references repo-wide, proven by a checked-in reference census.

---

### F3 — Creator and admin pages are silently restyled (the single highest-probability owner-visible failure)
**Breaks:** `app/(dashboard)/brand/layout.tsx:13` and `app/(dashboard)/creator/layout.tsx:29` both render `<div className="dashboard-layout">` and both import **the same `DashboardNavShell`**. `DashboardNavShell.tsx` is explicitly **in scope**. The moment an agent restyles it, the frozen creator dashboard gets the new dark coral chrome bolted onto its untouched light-blue body — and `app/internal/waitlist/page.tsx` inherits `apple-shell`, `apple-nav`, `apple-btn`, `page-header`, `page-title`, `brand-lockup`, `pill`, `subtle-grid` and 11 more.
**Evidence:** `grep -rln DashboardNavShell app` → `brand/layout.tsx`, `creator/layout.tsx`. Class intersection census: **50 of 143 classes are used by both in-scope and frozen markup**, including `dashboard-layout`, `main-shell`, `nav-link`, `nav-links`, `apple-shell`, `apple-nav`, `apple-btn`, `apple-btn-ghost`, `apple-input`, `apple-select`, `apple-link`, `brand-lockup`, `brand-mark`, `brand-wordmark`, `page-header`, `page-title`, `page-copy`, `section-header`, `metric-card`, `metric-value`, `glass-card`, `empty-state`, `status-pill`, `list-row`, `two-col`, `four-col`, `eyebrow`, `pill`, `shimmer`, `subtle-grid`, plus the seven `admin-*` chart classes.
**Likelihood:** **H** — it is the default outcome unless explicitly designed against.
**Blast radius:** The frozen creator dashboard (bug-fixes-only, sunset pending) and admin (out of scope forever) become half-redesigned. Jackson opens `/internal/waitlist` and sees a broken hybrid. Worse, it is *invisible* to the in-scope screenshot matrix.
**Mitigation:**
- **Build agent:** `DashboardNavShell` must be **forked, not restyled** — introduce `BrandNavShell` (new file, new classes) used only by `app/(dashboard)/brand/layout.tsx`; leave `DashboardNavShell.tsx` byte-identical for the creator layout. Same for `dashboard-layout`/`main-shell`: brand layout emits new class names. This converts a shared-mutation problem into a disjoint-file problem, which is the only kind this plan can verify.
- **Orchestrator:** run the **frozen-surface contract check** (§2.3) after every wave. Three parts: (a) `git diff --stat` shows **zero** changed lines under `app/(dashboard)/creator/` and `app/internal/`; (b) the declaration block for each of the 50 shared classes hashes identically to the Wave-0 baseline; (c) the reference census shows the class count used by frozen markup is unchanged.

---

### F4 — Clerk's rendered components ignore the theme and ship a white card in a dark page
**Breaks:** `<SignIn>`/`<SignUp>`/`<UserButton>` render inside Clerk's own DOM, styled by `lib/clerk-appearance.ts`, which hardcodes `colorBackground: '#ffffff'`, `colorInputBackground: '#f5f5f7'`, `colorText: '#1d1d1f'`, `colorPrimary: '#0071e3'` and `card: '… backdrop-blur-xl'`. Restyle `/sign-in`'s page chrome to dark and the auth form stays a blinding white blue-buttoned card in the middle of it. The `UserButton` popover in the brand dashboard does the same.
**Evidence:** `lib/clerk-appearance.ts:3-11` (light hexes), `:15` (`rounded-[28px] backdrop-blur-xl` — also two anti-template violations), `:36-49` (`#0f1728`, `#667085`, `#f5f5f7`, `#0071e3` hardcoded in `authClerkAppearance`). `app/layout.tsx:48` passes `baseClerkAppearance` at the root, so it affects every Clerk element on every page.
**Likelihood:** **H** — `clerk-appearance.ts` is a `lib/` file and the scope statement says "NOT in scope: … lib business logic." An agent reading the scope literally will not touch it.
**Blast radius:** `/sign-in`, `/sign-up`, `/sso-callback`, and the account menu on every brand dashboard page. This is the first screen a new brand sees.
**Mitigation:**
- **Orchestrator:** issue an explicit scope amendment — `lib/clerk-appearance.ts` **is** in scope as a presentation file, and is its own package owning that one file. Clerk `appearance` variables cannot read CSS custom properties reliably across all elements, so the theme must be resolved and passed per-tree.
- **Build agent:** ship two appearance objects (dark/light), select in the layout that knows the theme, and verify by *rendered screenshot*, not by reading the config. Clerk ships new element keys between minor versions — assume the class map is incomplete and screenshot every state: signed-out form, OTP step, error state, social buttons, `UserButton` open popover.
- **Verification:** Clerk internals are third-party DOM. The only honest check is the screenshot matrix (§2.4) plus an automated contrast probe against the *rendered* page, not the token file (§2.3).

---

### F5 — Flash of wrong theme on first paint (App Router)
**Breaks:** The dashboard must support `data-theme=dark` / `data-theme=light` / unstamped-with-`prefers-color-scheme`. A stored preference lives in `localStorage`, which the server cannot read, so the server renders one theme and the client corrects it after hydration: a white flash on a dark site, or a React hydration mismatch error in console (which will also fail any strict-mode check).
**Evidence:** `app/layout.tsx:49-53` — `<html lang="en" className={...}>` with **no** `suppressHydrationWarning` (`grep -c` → 0), no `data-theme`, no `color-scheme`. `app/globals.css` has **0** occurrences of `color-scheme` and **0** of `prefers-color-scheme`, so there is no baseline behavior to inherit.
**Likelihood:** **H** if a toggle ships; **M** if theme is CSS-media-only.
**Blast radius:** Every page load. Reads as "cheap" and is the single most template-looking defect a visitor can perceive.
**Mitigation (final mechanism, `02-engineering.md` §2.2–2.3):**
- The preference lives in a **cookie** (`cd-theme`), not `localStorage`. The brand layout is already dynamic, reads it with `await cookies()`, and server-renders `data-theme` on the `.cd-app` wrapper. There is nothing for the client to correct, so **no inline script, no `suppressHydrationWarning`, no flash by construction.** Marketing and auth hard-code `data-theme="dark"`.
- `color-scheme` is declared in every theme block so form controls and scrollbars paint correctly before any component CSS.
- Dark is the bare `:root`, so the unstamped path is the intended look, not an accident.
- **Verification:** for each dashboard page, with the cookie set to `light`, `dark` and absent: assert the server HTML (`curl` or view-source) already carries the expected `data-theme` (or none), assert **zero** console messages matching `hydrat`, and sample the background at ~100 ms and at load-complete — they must match.

---

### F6 — The git worktree has no `.env`, no `node_modules`, and no generated Prisma client
**Breaks:** `git worktree add` creates a clean checkout containing only tracked files. `.env*` is gitignored; `node_modules/` is gitignored; `@prisma/client` is generated by `postinstall`. The first agent to run `npm run typecheck` gets *hundreds* of "Cannot find module" errors, concludes the redesign broke the build, and starts "fixing" imports. The first agent to run `npm run dev` gets a Prisma initialization crash.
**Evidence:** `package.json` `"postinstall": "prisma generate"`, `"build": "prisma generate && next build"`. `docs/PROJECT-STATE.md` §8: `.env`, `.env.local`, `.env.production.local` all exist locally and all point at one Neon instance. Nothing in the repo bootstraps a worktree.
**Likelihood:** **H** — this is the default behavior of `git worktree`.
**Blast radius:** Wave 1 stalls entirely; risk of spurious "fixes" to unrelated code.
**Mitigation:**
- **Orchestrator, before dispatching any agent:** `npm ci` in the worktree, `npx prisma generate`, and copy `.env.local` in — then run all three gates **itself** and record the green baseline. No agent starts until the orchestrator has pasted a green `typecheck`/`lint`/`test` from *the worktree*.
- Because it is an npm **workspace** root (`workspaces: ["packages/*","mobile"]`), `npm ci` in the worktree also installs `mobile/`. Budget the time and disk; do not let an agent decide to `npm install --omit` anything.
- **Never** copy `.env.production.local` into the worktree — `docs/BLOCKED-ON-JACKSON.md` records that it holds a live Stripe secret key in plaintext.

---

### F7 — Agents mutate PRODUCTION data through a "local" dashboard page
**Breaks:** There is **one** Neon database. `npm run dev` on the brand dashboard is pointed at production. An agent verifying a redesigned `/brand/campaigns/new` submits the form to see the success state and creates a real campaign row. An agent verifying `/brand/submissions` clicks "Approve & Pay" and **captures a live Stripe authorization**. An agent verifying the waitlist form writes another junk row.
**Evidence:** `docs/PROJECT-STATE.md` §8: *"There is ONE database. `.env`, `.env.local` and `.env.production.local` all point at the same Neon instance."* `docs/BLOCKED-ON-JACKSON.md` ground rule 2. Audit N3 already records two junk waitlist rows created this way on 2026-09-07. `docs/BLOCKED-ON-JACKSON.md` #1: `STRIPE_SECRET_KEY` is now a **live-mode** key.
**Likelihood:** **M** for a write; **L** for a capture — but the capture is catastrophic.
**Blast radius:** Real money, real rows in the launch dataset, contaminated waitlist counts and referral leaderboard.
**Mitigation — this is a hard prohibition, stated in every package brief:**
- Agents **never** submit a form, click a mutating control, or run any `POST`/`PATCH`/`DELETE` against a running dev server. Not "Approve & Pay", not "Create campaign", not "Join the waitlist".
- Agents **never** run `prisma migrate dev`, `prisma db push`, `prisma migrate reset`, or `prisma/set-role.mjs`.
- Mutating states (success screens, error screens, filled tables, "payment authorized") are verified from **fixture-rendered component tests and static mockups**, never from live data.
- **Orchestrator:** after every wave, `git diff` the schema directory and assert empty; spot-check that no agent transcript contains a mutating HTTP verb against `localhost:3000`.
- **Owner:** the one person who may exercise a real payment flow is Jackson, once, at the Phase-3 gate.

---

### F8 — Port collisions with the two live sessions
**Breaks:** Two other Claude sessions are working in the same tree right now. Port **8081 is already listening** (Metro/Expo). If a redesign agent runs `npm run dev`, it either binds 3000 and steals it from the other session mid-verification, or Next falls back to 3001 and the agent screenshots a *stale* server that another session is running from the *other* branch — producing screenshots of the old design that get pasted as "after" evidence.
**Evidence:** `lsof -nP -iTCP -sTCP:LISTEN` → `node 54997 … TCP *:8081 (LISTEN)`. Port 3000 free at time of writing but claimed by `npm run dev` in `package.json` and by `docs/PROJECT-STATE.md` §9.
**Likelihood:** **H** for contention; **M** for the silently-wrong-screenshot variant, which is the dangerous one.
**Blast radius:** False verification evidence — the worst class of failure, because it *passes*.
**Mitigation:**
- **Orchestrator** owns the dev server. **Exactly one** server, started by the orchestrator in the worktree on a reserved non-default port (e.g. `next dev -p 3100`), never by an agent. Agents that need a URL are given it.
- Before starting it, assert the port is free and, after starting, assert the served HTML contains a **build marker** the redesign introduces (e.g. a `data-build` attribute or a known new class). A screenshot run that cannot find the marker is discarded, not interpreted.
- Never touch 8081.

---

### F9 — Node 25 locally vs `engines` 24 vs Vercel 24
**Breaks:** The laptop runs **v25.9.0**; `package.json` declares `">=24.0.0 <25.0.0"`; `.nvmrc` says `24`; CI reads `.nvmrc` via `node-version-file`; Vercel runs 24. So the whole redesign is developed and gated on a Node version the project forbids. An `npm ci` with a strict engine check fails outright; more insidiously, a CSS/build behavior difference (Turbopack, `next/font`, `ImageResponse`/Satori in the OG routes) produces "works locally, breaks in CI/Vercel."
**Evidence:** `node -v` → `v25.9.0`; `package.json` `engines`; `.nvmrc` (untracked, `?? .nvmrc` in `git status`); `docs/BLOCKED-ON-JACKSON.md` "Smaller decisions": *"canonical is 24 (matches Vercel). CI said 22, your laptop runs 25. Confirm 24."*
**Likelihood:** **H** that it bites at least once.
**Blast radius:** Every gate result is measured on the wrong runtime. Bugs surface only at the merge-to-main deploy — the single riskiest moment.
**Mitigation:**
- **Orchestrator, Wave 0:** switch the worktree shell to Node 24 (`nvm use` reads `.nvmrc`) and paste `node -v` proving `v24.x` **in the same message** as the green baseline gates. Every package's gate paste must include `node -v`.
- Note `.nvmrc` is currently **untracked** — it must be committed by the other sessions before the branch is cut, or the worktree will not have it. Orchestrator verifies its presence in the worktree.
- **Owner:** confirm 24 is canonical (it is a listed open decision).

---

### F10 — iCloud sync corrupts files, duplicates them, or stamps xattrs mid-build
**Breaks:** The repo lives in `~/Desktop`, iCloud-synced. Source files already carry `com.apple.provenance` xattrs. iCloud creates `" 2"` duplicates of files and directories under contention — `app/(dashboard)/creator/payouts/page 2.tsx` and `.next/dev 2` exist **right now**. A worktree created next to it doubles the write pressure with three sessions running builds. A duplicated `page 2.tsx` is not routable by Next but **is** compiled by `tsc --noEmit`, so a stale copy of a redesigned file will fail typecheck with errors in a file nobody edited.
**Evidence:** `xattr app/globals.css` → `com.apple.provenance`. `find . -name "* 2.*"` → `./app/(dashboard)/creator/payouts/page 2.tsx`. `find . -type d -name "* 2"` → `./.next/dev 2`. `mobile/README.md:42,64` — `xattr -cr mobile/ios` required before every clean native build. `docs/PROJECT-STATE.md` §8 documents `Pods 2/`, `build 2/`, `page 2.tsx` as iCloud artifacts.
**Likelihood:** **M** for a new duplicate during the project; **H** that the *existing* one confuses an agent.
**Blast radius:** Phantom typecheck failures attributed to the redesign; wasted agent budget chasing a ghost.
**Mitigation:**
- **Orchestrator, Wave 0:** create the worktree **outside** the iCloud-synced path (e.g. `~/dev/creatordocks-redesign`) if at all possible. This is the single cheapest risk elimination in the plan.
- If it must stay on Desktop: run `find . -path ./node_modules -prune -o -name "* 2.*" -print` at the start of **every** wave and treat a new hit as a wave-blocking incident. Never let an agent "fix" a `* 2.*` file — delete it.
- **Owner:** confirm deletion of `app/(dashboard)/creator/payouts/page 2.tsx` (already a listed open decision) *before* the branch is cut.
- Nothing in scope touches `mobile/ios`, so the codesign xattr issue does not apply — but agents must not run `expo prebuild` "to check the theme port."

---

### F11 — `next/font` fetches Google Fonts at build time and the build fails or the design silently changes
**Breaks:** `Plus_Jakarta_Sans` is loaded via `next/font/google` (`app/layout.tsx:4,9-12`), which downloads the font files **at build time**. In a fresh worktree with a cold Next cache, on a network hiccup, or in a sandbox without egress, the build fails or Next falls back to a system face — and a redesign judged on typography is screenshotted in the wrong font. If the redesign adds a second family or weights/subsets, each new axis is another build-time fetch.
**Evidence:** `app/layout.tsx:9-12` `Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-display' })` — no explicit `weight`, no `display`, no `fallback`, no `adjustFontFallback`. `app/layout.tsx:52` sets the family via an inline `style={{ fontFamily: 'var(--font-display), sans-serif' }}` — a raw `sans-serif` fallback with no metric matching.
**Likelihood:** **M** for a hard failure, **H** for a silent fallback in at least one screenshot run.
**Blast radius:** Mockup and verification screenshots that are not the real design; a Vercel build failure at merge time.
**Mitigation:**
- **Build agent:** declare `display: 'swap'` and an explicit metric-compatible `fallback` stack. There are exactly **two families** (Archivo with the `wdth` axis, Schibsted Grotesk) declared in one file (`app/fonts.ts`); no third face, ever — every added family multiplies this risk and the CLS risk in F16.
- **Verification:** in the screenshot harness, assert the computed `font-family` of the hero headline resolves to Archivo and of a body paragraph to Schibsted Grotesk, not the fallbacks. A screenshot run where either font did not load is **discarded**, not interpreted.
- **Orchestrator:** run one `next build` in the worktree at the Phase-2 gate. (Note CI deliberately does **not** run `next build` — `docs/PROJECT-STATE.md` §10 explains why — so this is the *only* place a build failure is caught before Vercel.)

---

### F12 — The OG image / icon routes break when given the new typeface
**Breaks:** `app/opengraph-image.tsx`, `app/get-the-app/opengraph-image.tsx`, `app/waitlist/opengraph-image.tsx` and `app/icon.tsx` all currently render with `fontFamily: 'Arial'` — no font is fetched. They are explicitly in scope, so the redesign will restyle them. `ImageResponse` (Satori) does **not** use `next/font`; it needs raw font `ArrayBuffer`s passed in `fonts: []`. An agent that simply writes `fontFamily: 'Plus Jakarta Sans'` gets a **silent** fallback to a default face — the OG card looks wrong and nobody notices, because nobody looks at an OG image locally. Worse, a common "fix" is `fetch()`ing the font inside the route, which turns every social-card render into a runtime network call that can fail in production.
**Evidence:** `app/opengraph-image.tsx:23`, `app/get-the-app/opengraph-image.tsx:27`, `app/icon.tsx:23` all `fontFamily: 'Arial'`. No `fonts:` option anywhere. `app/opengraph-image.tsx:22` `background: 'linear-gradient(135deg, #eef6ff 0%, #ffffff 48%, #dbeafe 100%)'` — the pale-blue gradient the anti-template mandate names explicitly; it *must* change. Note `app/opengraph-image.tsx:35` already uses `#ff503d`, the mobile coral, so partial identity work exists.
**Likelihood:** **H** for the silent fallback.
**Blast radius:** Every link shared to Slack, iMessage, LinkedIn, Twitter — the brand's first impression, invisible to normal QA.
**Mitigation:**
- **Build agent:** pass real font buffers read from disk (a checked-in `.ttf`/`.woff` under `app/fonts/`), never a runtime `fetch`. Add `export const runtime` only if the docs for **this** Next version support it — `AGENTS.md` requires reading `node_modules/next/dist/docs/` first; `ImageResponse` options changed across 15→16.
- **Verification:** these routes are *renderable without auth* (`/opengraph-image` and `/icon` are in `proxy.ts:17-18`'s public list; `/get-the-app(.*)` and `/waitlist(.*)` cover the other two). So `curl` them against the local dev server, save the PNGs, and **include all four in the screenshot matrix as reviewed artifacts**. Assert `Content-Type: image/png` and a non-trivial byte size.
- **Trap to flag:** if the redesign adds a *new* OG route at a path not covered by `proxy.ts`'s public list (e.g. `app/(dashboard)/brand/opengraph-image.tsx`), crawlers get a 307 to `/sign-in`. Any new image route must be added to `isPublicRoute` in the same commit — and `proxy.ts` is a file the other session is **already modifying** (see F13).

---

### F13 — The two live sessions commit to the same files after the branch is cut
**Update 2026-09-08:** both sessions have committed (seven commits, tip `126e86b`; source tree clean). The risk now is only *new* edits after the cut — the mitigation stands.
**Breaks:** The redesign branch is cut from a "clean commit" — but four **in-scope, brand-facing** files are dirty right now, and one of the other sessions has stated intent to *delete dead auth CSS from `app/globals.css`*, the exact file the redesign rebuilds. If those sessions commit again after the cut, the merge back is a conflict in the two highest-value files in the project (`globals.css`, `sign-up/page.tsx`), resolved by whoever merges last, at the end of the project, under pressure.
**Evidence:** `git status --short` shows `M app/(auth)/sign-in/[[...sign-in]]/page.tsx`, `M app/(auth)/sign-up/[[...sign-up]]/page.tsx` (+59 lines), `M app/(dashboard)/brand/campaigns/[id]/applications/page.tsx`, `M app/(dashboard)/brand/submissions/page.tsx`, `M app/waitlist/WaitlistForm.tsx` (+57), `M proxy.ts` (+23) — all in scope. Plus `?? .nvmrc`, `?? lib/env.ts`, `?? docs/*` untracked. `git diff --stat` totals +1,529/−267 across 41 files.
**Likelihood:** **H** unless explicitly frozen.
**Blast radius:** A multi-hundred-line conflict in `globals.css` at merge time, plus the possibility that a security fix (the `contentUrl` validation on the brand render sites) is lost in a "take ours" resolution.
**Mitigation:**
- **Owner (hard prerequisite, gate on it):** the other two sessions **commit and stop touching web brand-facing files** before the branch is cut. Get an explicit "done" from both.
- **Orchestrator, Wave 0:** record the exact base SHA. Re-read all six in-scope files **from the worktree**, not from memory of this analysis — assume their content differs from what is described here. Diff the actual `app/globals.css` line count against 1,760 and re-run the class census; if the auth CSS deletion landed, the 50-class collision set changes and every downstream package brief must be regenerated.
- **Orchestrator, before merge:** `git fetch && git log --oneline <base>..main -- app/ lib/clerk-appearance.ts proxy.ts`. Any hit means a rebase, reviewed file-by-file, **not** a merge commit.
- If a session must land a fix mid-project, it lands on `main` and the redesign branch **rebases** onto it immediately, so the conflict is resolved while small.

---

### F14 — Marketing copy drifts from the actual money mechanics
**Breaks:** A redesign rewrites headlines. The fee is stated as "15%" in three places and the *direction* of the fee is the subtle part: it comes **out of** the accepted rate, never added on top. A designer-agent writing punchier copy produces "just 15% on top", "no fees for brands", "creators keep 100%", or invents a number. Each is a legal/consumer claim, not a style choice — and `docs/BLOCKED-ON-JACKSON.md` #18 records that net-vs-gross is an **unresolved** inconsistency, so an agent has no consistent source to copy from.
**Evidence:** `lib/utils.ts:8-9` `PLATFORM_FEE_RATE()` returns `0.15`; `:12-14` `calculatePlatformFee`. Copy claims live at `app/layout.tsx:25` (`"15% platform fee, no retainer"`), `app/page.tsx:17` (`value: '15% platform fee'`), `app/page.tsx:61` (the accurate long form: *"Accept a creator at $400 and your card is charged $400 — the fee comes out of that amount rather than being added on top."*). Mechanics: `docs/PROJECT-STATE.md` §4 — destination charge, `capture_method: manual`, `application_fee_amount`, authorize at accept, capture at approve. Open contradiction: `docs/production-readiness-2026-09-06.md` H2 — creator surfaces show gross, emails say net.
**Likelihood:** **M–H** (rewriting hero copy is the whole point of the redesign).
**Blast radius:** A false pricing claim on the public marketing site of a payments product.
**Mitigation:**
- **Build agent:** the fee number is **not** hardcoded in copy. Derive the displayed percentage from `PLATFORM_FEE_RATE()` at render, or from a single exported constant, so it cannot drift from the code. (House rule: "no hardcoded values.")
- **Every copy package** ships with the §2.6 copy-vs-code checklist filled in, citing `path:line` for each claim.
- **Orchestrator:** run the grep gate — any occurrence of a percentage adjacent to "fee" outside the derived constant fails the wave.
- **Owner:** #18 net-vs-gross is Jackson's decision. If unanswered, the plan **assumes gross-with-an-explicit-fee-line** (matching the accurate `app/page.tsx:61` copy) and states that assumption on the mockup for approval.

---

### F15 — Accessibility regresses on a dark UI: contrast, focus, motion
**Breaks:** Dark UIs fail contrast in a specific, predictable way: mid-grey secondary text on a dark card, coral used as a *fill* under white text (only 3.25:1 for `#ff503d`), and "subtle" borders that disappear. The current stylesheet has **zero** `focus-visible` rules and **zero** `prefers-reduced-motion` — it has `@keyframes float` (an oscillating translate) and `riseIn`, used 3 times. A cinematic hero animation added on top, with no reduced-motion guard, is a vestibular-trigger and an automatic Lighthouse a11y hit.
**Evidence:** `grep -c` on `app/globals.css`: `focus-visible` = **0**, `prefers-reduced-motion` = **0**, `:focus` = 3. `@keyframes` = 4 (`shimmer`, `spin`, `float`, `riseIn`). The mobile side already solved this properly: `mobile/src/constants/theme.ts` documents `accent #ff503d` (foreground, 6.17/5.66/5.13 on dark) vs `accentFill #d64131` (4.51:1 under white) — *"white on `#ff503d` is only 3.25:1"* — and `mobile/src/constants/theme.contrast.test.ts` (10,203 B) **enforces** every ratio. The web has no equivalent.
**Likelihood:** **H** — coral-as-button-fill is the single most likely mistake, and it is exactly the one the mobile codebase already documents.
**Blast radius:** Every button, every focus ring, every secondary label — and it is a *credibility* failure for a brand-facing product, not just a compliance one.
**Mitigation:**
- **Build agent (mandatory, TDD — write it first):** port `theme.contrast.test.ts` to the web as `app/styles/tokens.contrast.test.ts`. It must re-derive WCAG relative luminance from the web token values (including alpha compositing for `*Soft` fills) and fail on drift, exactly as mobile does. Enforce the `accent` vs `accentFill` split — a lint/grep rule that `--accent` is never used as a `background` under `--on-accent`.
- Ship `:focus-visible` rings on every interactive element with ≥3:1 against **both** the element and its background, and a global `@media (prefers-reduced-motion: reduce)` block that neutralises every animation and transition.
- **Verification:** §2.3 automated contrast probe on the *rendered* pages (catches Clerk's DOM, which the token test cannot see) + keyboard-only tab-order walkthrough of `/sign-in`, `/brand`, `/brand/campaigns/new` + `prefers-reduced-motion` screenshot pass.
- **Caution:** the test must live at a path vitest actually runs — see F19.

---

### F16 — Lighthouse / CLS regression from web fonts and the hero animation
**Breaks:** "Cinematic" is a performance liability. A hero with a large gradient/image, an entrance animation, and a webfont produces: CLS from the font swap (no metric-matched fallback today), LCP delay from a hero asset, TBT from animation JS, and a heavier CSS payload since the new system is **added** to the 31.7 KB / 6.5 KB-gzip legacy sheet before any orphan sweep. The marketing site is the top-of-funnel for brand acquisition; a slow, jumping hero is a conversion cost, and Vercel is on the Hobby plan with no real monitoring.
**Evidence:** `app/globals.css` = 31,677 B raw / 6,553 B gzip **today**, and F2's additive-only rule means it grows before it shrinks. `app/layout.tsx:52` inline `fontFamily: 'var(--font-display), sans-serif'` with no metric-matched fallback → guaranteed layout shift on swap. `--type-hero: clamp(2.25rem, 7vw, 4.5rem)` (`globals.css:29`) — a 72px hero line is a large CLS lever. Zero `prefers-reduced-motion`. `docs/production-readiness-2026-09-06.md` H6: Vercel Hobby, 1-hour log retention.
**Likelihood:** **M–H**.
**Blast radius:** Public marketing site; SEO; the "sexy to brand owners" goal fails on a phone.
**Mitigation:**
- **Budget (fail the wave on a breach), measured on `/` at mobile emulation:** LCP ≤ **2.0 s** · CLS ≤ **0.02** · TBT ≤ **200 ms** · Perf ≥ **90** · **A11y = 100** · Best-practices ≥ **95** · SEO ≥ **95**. Payload: total CSS gzip ≤ **12 KB** *during* migration and ≤ **8 KB** after the orphan sweep; first-load JS for `/` must not exceed the Wave-0 baseline by more than 10%.
- **Build agent:** metric-matched font fallback; hero animation is CSS-only, GPU-composited (`transform`/`opacity` only), and fully disabled under `prefers-reduced-motion`; no hero image over 150 KB; reserve hero space explicitly so nothing shifts.
- **Orchestrator:** run Lighthouse at the Phase-2 gate on `/`, `/get-the-app`, `/sign-in` and paste the numbers. Capture the Wave-0 baseline first, so "regression" is measurable rather than argued.

---

### F17 — `CREATOR_WEB_MODE` and `MARKETPLACE_ACCESS` are read wrongly by the redesign
**Breaks:** Two distinct failures.
(a) **CTA flag-awareness:** the brief requires CTAs that point to `/waitlist` in invite mode and `/sign-up` in open mode. `MARKETPLACE_ACCESS` is a **server** env var in `lib/admin-config.ts`. A redesign agent building an interactive hero will make the CTA a client component and reach for `process.env.MARKETPLACE_ACCESS` in the browser, where it is `undefined` — so the CTA silently falls into whichever branch `undefined` hits. If the agent "fixes" it by renaming to `NEXT_PUBLIC_MARKETPLACE_ACCESS`, the value is inlined at build time and can no longer be flipped without a redeploy — and `docs/production-readiness-2026-09-06.md` N4 records that a `NEXT_PUBLIC_*` variable marked Sensitive in Vercel already caused a live outage on exactly this mechanism.
(b) **Fail-closed inversion:** both flags fail *closed* by design (`lib/creator-web-mode.ts:29` `DEFAULT_CREATOR_WEB_MODE = 'sunset'`). An agent verifying the brand dashboard locally without `CREATOR_WEB_MODE=full` in the worktree's `.env.local` will find `/creator/*` redirecting to `/get-the-app` and may "fix" the default to `full` — silently reversing a deliberate product safety decision.
**Evidence:** `lib/creator-web-mode.ts:29,71-79`; `lib/admin-config.ts` (`M lib/admin-config.ts`, +32 lines uncommitted — its current shape differs from any prior reading); `docs/BLOCKED-ON-JACKSON.md` #3 (`CREATOR_WEB_MODE` set in **no** environment) and #4 (`MARKETPLACE_ACCESS` stays `invite` until Stripe is verified); audit N4; `docs/PROJECT-STATE.md` §5 flag table.
**Likelihood:** **H** for (a); **M** for (b).
**Blast radius:** (a) every acquisition CTA on the marketing site points at the wrong destination on launch day, or becomes unflippable without a redeploy. (b) a one-line change that retires creator web.
**Mitigation:**
- **Build agent:** CTA destination is resolved **on the server** and passed to any client component as a prop — never read from `process.env` in client code. Add a **unit test first** (TDD): given `invite` → href is `/waitlist`; given `open` → `/sign-up`; given unset/garbage → `/waitlist` (fails closed). This test is cheap, catches the whole class, and runs in the `node` environment vitest already uses.
- **Do not** introduce a new `NEXT_PUBLIC_*` variable for this. If one is unavoidable, the brief must carry the N4 warning: never mark it Sensitive in Vercel.
- **Orchestrator:** grep gate — `process.env` must not appear in any file carrying `'use client'` in scope. Assert `git diff` touches **no** default value in `lib/creator-web-mode.ts` or `lib/admin-config.ts`.
- Put `CREATOR_WEB_MODE=full` in the worktree `.env.local` at Wave 0 so no agent ever meets the sunset redirect and mistakes it for a bug.

---

### F18 — The merge to `main` *is* a production deploy, onto a six-week-stale, partly-broken production
**Breaks:** `git push origin main` auto-deploys Vercel production. Local `main` is **47 commits ahead** of `origin/main` and nothing has been pushed since 2026-07-25. So merging the redesign to `main` does not ship "a redesign" — it ships 47 unrelated commits *plus* the redesign, into an environment where `CREATOR_WEB_MODE` is unset (⇒ instant creator-web sunset), Turnstile and Resend keys are missing/placeholder, and `UPLOADTHING_TOKEN` does not exist. The redesign will be blamed for all of it.
**Evidence:** `docs/production-readiness-2026-09-06.md` §1 "five things to know first" #1 and #3, both marked ✔ re-verified. `docs/BLOCKED-ON-JACKSON.md` ground rule 1 and #1/#2/#3. B1: *"Do not push `main` until B2 and B3 are done."* No branch protection on `main` (`gh api …/protection` → 404).
**Likelihood:** **H** that it is attempted; **M** that it causes an outage.
**Blast radius:** Production. Creator web retired without warning; a waitlist form that fails closed; no emails.
**Mitigation:**
- **Orchestrator: the redesign never merges to `main`.** It is pushed as `feat/web-redesign`, which Vercel builds as a **Preview**. Preview is where the owner reviews and where the Phase-3 verification runs. (Caveat: `docs/production-readiness-2026-09-06.md` H14 — Preview has no `DATABASE_URL` and carries **live** Clerk keys, so Preview is good for the marketing site and auth chrome and **not** for dashboard data. Dashboard verification stays local against the shared DB, read-only.)
- **Owner:** the merge to `main` is Jackson's action, taken *after* audit blockers B1/B2/B3 are closed, following `docs/runbooks/deploy.md`. It is explicitly **not** part of this redesign project's definition of done.
- If the owner insists on shipping the redesign before B2, the honest answer is: it cannot be shipped independently, because there is no deploy path that carries only these commits.

---

### F19 — Component tests are written, never run, and reported as coverage
**Breaks:** The house rule is TDD with 80% coverage. Agents will write React component tests. `vitest.config.ts:8` includes only `'tests/**/*.test.ts'`, `'lib/**/*.test.ts'`, `'app/**/*.test.ts'` — **`.tsx` is not in any pattern**, and `environment: 'node'` has no DOM. So a `Hero.test.tsx` next to the component is **silently collected by nothing**: `npm run test` exits 0, having run zero of them. The agent pastes a green gate and claims coverage. Every one of the a11y, contrast, flag-CTA and copy tests this plan depends on can evaporate this way.
**Evidence:** `vitest.config.ts:6-9` — `environment: 'node'`, `include: [… '*.test.ts']`. `find app lib tests -name '*.test.tsx'` → **0** files. `@testing-library/react` is **absent** (`node_modules/@testing-library/` holds only `dom`, `jest-dom`, `user-event`, `react-native`, all hoisted from the mobile workspace; `@vitejs/plugin-react` and `@vitest/coverage-v8` are absent too). Nothing UI-testable is declared in `marketplace/package.json`. `docs/production-readiness-2026-09-06.md` H9 records the precedent exactly: *"every per-route test in `app/api/v1/**` opens by replacing the guard with a passthrough, which is precisely why the two worst defects in the audit survived a green suite."*
**Likelihood:** **H** — this is the default outcome.
**Blast radius:** The entire verification protocol is hollow. This is the failure that makes every other mitigation in this document unenforceable, so it is fixed **first**.
**Mitigation:**
- **Wave 0, its own package, before any design work:** add a `jsdom` projects/environment configuration and extend `include` to `.tsx`; wire `@testing-library/jest-dom` in a setup file. Then **prove it bites**: commit one deliberately-failing component test, show `npm run test` red, fix it, show green. Paste both outputs. An unproven harness is not a harness.
- **Every package's gate paste must include the test *count*,** not just "passed". The orchestrator compares counts wave over wave; a count that did not rise when tests were claimed is a failed wave.
- Keep node-environment tests (tokens, contrast math, flag resolution, copy constants) separate from jsdom tests — the contrast port is pure arithmetic and should stay in the fast `node` project, mirroring `mobile/src/constants/theme.contrast.test.ts`.

---

### F20 — 367 inline `style={{}}` props leave the migration permanently half-done
**Breaks:** In-scope files carry **367** inline style props (245 in `app/(dashboard)/brand` alone). Inline styles beat every stylesheet rule, so a token-based theme *cannot* work until they are gone — a themed dark card with `style={{ background: '#fff' }}` on it stays white in both themes. Agents will migrate the ones they see and miss the rest, producing a dashboard that is 80% dark and 20% white, which looks worse than either extreme. And light mode will appear "done" (because the inline light values happen to be correct) while dark mode is broken — hiding the defect from a light-mode-only review.
**Evidence:** `grep -rho 'style={{'` per directory: brand 245, `app/*.tsx` 64, get-the-app 33, waitlist 17, support 3, auth 3, privacy 1, terms 1. Plus 30 hardcoded hex literals in in-scope `.tsx` and 33 in `globals.css`.
**Likelihood:** **H**.
**Blast radius:** The brand dashboard — the product the redesign exists to sell.
**Mitigation:**
- **Orchestrator:** make it a **counted, ratcheting** gate, not a judgement call. Record the per-directory baseline at Wave 0. Each package declares the count it will remove; the orchestrator re-counts after the wave. The count must **only ever decrease**, and must reach **0** in in-scope files at the Phase-2 gate. Frozen-directory counts (creator 176, internal 54) must be **exactly unchanged** — a change there is an F3 breach.
- Same ratchet for hardcoded hex in in-scope `.tsx` → 0, with the only permitted hex living in the tokens file (and in the OG image routes, which cannot use CSS variables — those are an explicit, documented exemption).
- **Build agent:** always verify dark **and** light. A file is not done until both render correctly.

---

### F21 — The mobile→web token and cover-art port drifts from its source
**Breaks:** The brief requires ONE identity derived from `mobile/src/constants/theme.ts` and `mobile/src/lib/cover-art.ts`. An agent will hand-copy hex values and the gradient/pattern tables. Hand-copying produces: a transposed digit, the `accent`/`accentFill` split collapsed into one coral (→ F15), or a cover-art palette list of 7 instead of 8 — so the same campaign gets different art on web and iOS, which is worse than having no cover art at all, because it reads as a bug in a live product.
**Evidence:** `mobile/src/constants/theme.ts` documents 8+ semantic tokens with computed ratios and warns *"Seven screens hard-coded `'#ffffff'` for this, which meant the pairing was invisible to any audit."* The generated cover art is deterministic: niche → one of 8 two-stop gradient palettes, id → one of 4 patterns (orbs/rings/stripes/arc). Determinism is the whole contract — drift is silently visible to users. Note also `mobile/` is being actively modified right now (`M mobile/src/app/(app)/discover/index.tsx`, `M mobile/src/app/(app)/profile/index.tsx`, etc.), so the source may move during the project.
**Likelihood:** **M–H**.
**Blast radius:** Cross-platform identity — the stated point of the redesign.
**Mitigation:**
- **Build agent:** port the cover-art **algorithm**, then write a **parity test** (TDD, first) that asserts, for a fixed table of `(niche, id)` fixtures, the web implementation produces the identical palette index and pattern name as the mobile implementation's table. Check the fixture table into the repo. This makes drift a failing test, not a visual judgement.
- Token values: derive from a single checked-in source-of-truth file with the mobile file's ratios re-derived by the contrast test (F15), so a transposed digit fails a gate.
- **Orchestrator:** pin the mobile source SHA in the package brief. If `mobile/src/constants/theme.ts` or `mobile/src/lib/cover-art.ts` changes during the project, re-run the parity test before merge.

---

### F22 — Mobile-first rewrite silently breaks the 820px band
**Breaks:** The legacy sheet is desktop-first: three `max-width` queries at 1080 / 640 and **820**. The new system will be written mobile-first (`min-width`). During migration both systems are live, and a component whose legacy `max-width: 820px` rule still applies while its new `min-width: 768px` rule also applies gets both — producing a layout that is correct at 390 and 1440 (the two viewports in the mockup brief) and **broken only at 820**, which nobody screenshots.
**Evidence:** `app/globals.css:1315` `@media (max-width: 1080px)`, `:1429` `@media (max-width: 820px)`, `:1575` `@media (max-width: 640px)`. `grep -c "@media (min-width"` → **0**. The mockup brief specifies only 1440 and 390.
**Likelihood:** **M**.
**Blast radius:** iPad and small-laptop visitors — a real share of local-brand owners.
**Mitigation:** **820 is a mandatory third viewport in the verification matrix** (§2.4), even though the mockups only cover 1440/390. Screenshot every in-scope page at 820 in both themes. Additionally: no new `max-width` media query may be added (grep gate), so the two systems never interleave in the same direction.

---

### F23 — Anti-template regression: agents reach for the defaults under time pressure
**Breaks:** The mandate names the exact look to avoid, and the current site *is* that look. An LLM writing "a nice dark landing page" produces, by default: near-black + a lone accent, blurred orbs, glass cards with `backdrop-filter`, a purple→blue gradient, everything centered, `rounded-lg` everywhere, emoji section markers, `01/02/03` step numbers. Under a wave deadline this is what gets written — and it is a *taste* failure, which no compiler catches.
**Evidence:** the artifacts are still in the tree and will be pattern-matched by any agent reading it for context: `backdrop-filter` ×9, `radial-gradient` ×5, `@keyframes float` (the orb), border-radius 28/32/40 (`--radius-sm/md/lg` = 16/24/32px at `globals.css:26-28`), `--accent: #1371ff` blue, `app/opengraph-image.tsx:22` pale-blue gradient.
**Likelihood:** **H**.
**Blast radius:** The entire point of the project. The owner rejects the result and the budget is spent.
**Mitigation:**
- **Make taste partially mechanical.** A grep gate (§2.3) that fails on `backdrop-filter`, `radial-gradient`, `filter: blur(`, `border-radius` ≥ 24px, and emoji codepoints in in-scope source. It cannot enforce good design, but it makes the eight named defaults *impossible to ship silently*, which converts a subjective argument into a build failure.
- **Phase 1 exists precisely for the part greps cannot check.** Mockups go to the owner **before** any build wave. No build wave starts on an unapproved artboard.
- **Orchestrator:** do not let a build agent redesign anything the owner has not seen. If a screen has no approved artboard, it is out of the wave.

---

### F24 — Light mode ships broken because everyone reviews in dark
**Breaks:** The brief is dark-first, the mockups are dark, the owner will review dark. Light mode is a stated requirement for the dashboard and will be built last, tested least, and shipped broken — dark-tuned borders invisible on white, coral foreground failing on light surfaces (mobile solved this with a *different* light coral, `#bf3524`), shadows tuned for dark that vanish.
**Evidence:** `mobile/src/constants/theme.ts` explicitly documents the asymmetry: *"Light `#bf3524` scores 5.60:1 on `#ffffff` … Dark `#ff503d` is unchanged."* and `accentFill` light `#d83e2a` vs dark `#d64131`. The web has **zero** `prefers-color-scheme` rules today, so there is no light/dark discipline to inherit.
**Likelihood:** **H**.
**Blast radius:** Any brand owner whose OS is set to light — likely the majority of small-business owners.
**Mitigation:** Light is **not** an afterthought package. Every dashboard screenshot in the matrix is captured in **both** themes in the **same** wave, side by side. The contrast test (F15) runs over **both** palettes. A package is not done if only one theme is verified — the gate paste must show both.

---

## 2. Verification protocol

### 2.1 Package-level — what every build agent must run and paste, verbatim, at the end of every package

No package is accepted without all nine. A summary sentence is not evidence; **command output is**.

```
1.  node -v                                        → must print v24.x
2.  npm run typecheck                              → 0 errors
3.  npm run lint                                   → no NEW warnings (6 pre-existing <img> warnings are the baseline)
4.  npm run test && npm run test --workspace=packages/shared   → all pass, AND the test COUNT (must be ≥ previous wave)
5.  git status --short                             → only this package's declared files
6.  git diff --stat                                → line counts per file
7.  grep -c 'style={{' <each in-scope dir touched> → counts, must be ≤ the declared target
8.  the anti-template grep block (§2.3)            → all zero
9.  screenshots for this package's screens         → per §2.4, dark AND light where applicable
```

Plus, conditionally:
- Touched `lib/clerk-appearance.ts`, `app/layout.tsx`, or any theme file → the **first-paint / hydration** check (F5) and a `UserButton`-open screenshot.
- Touched an `opengraph-image.tsx` or `icon.tsx` → the four rendered PNGs (§2.5).
- Touched tokens or cover art → the contrast test and the cover-art parity test, both green, with counts.
- Touched a CTA → the flag-resolution unit test output for `invite` / `open` / unset.

**Explicitly forbidden in every package brief:** submitting any form, clicking any mutating control, any `POST`/`PATCH`/`DELETE` to `localhost`, any `prisma migrate`/`db push`/`set-role.mjs`, any edit under `app/(dashboard)/creator/` or `app/internal/`, any edit to a file another package owns, any `!important`, any new `NEXT_PUBLIC_*` variable, any change to a flag default.

### 2.2 Wave-level — what the orchestrator runs itself, never delegating

After **every** wave, in the worktree, before dispatching the next:

```bash
node -v                                    # v24.x
npm run typecheck && npm run lint && npm run test
git status --short                         # expect ONLY the wave's declared files
git diff --stat <wave-base>..HEAD
git diff --stat <wave-base>..HEAD -- 'app/(dashboard)/creator' 'app/internal'   # MUST be empty  ← F3
find . -path ./node_modules -prune -o -name "* 2.*" -print | grep -v node_modules  # MUST be empty ← F10
git log --oneline <branch-base>..origin/main -- app/ lib/ proxy.ts               # MUST be empty ← F13
```

Then:
- **Frozen-class contract check** (§2.3) — hashes match the Wave-0 baseline.
- **Ratchet check** — inline-style and hardcoded-hex counts decreased in scope, **unchanged** in frozen dirs.
- **Test-count check** — total rose if tests were claimed.
- **Screenshot delta** — new shots for this wave's screens, both themes, three viewports.
- **Commit the wave** as one conventional commit per package before the next wave starts.

A wave that fails any of these is **reverted at the package level** (`git checkout -- <files>`) and re-dispatched. It is never patched forward by the orchestrator, because that reintroduces F1's ambiguity about who owns which file.

### 2.3 Automated checks (all scriptable; all wave-level)

**(a) Anti-template grep gate** — `scripts/design-gate.sh` (WP-03) runs over an explicit **allowlist of redesign-owned paths** (`app/styles/**`, `components/**`, `app/(dashboard)/brand/**`, `app/(auth)/**`, `app/*.tsx`, `app/waitlist`, `app/get-the-app`, `app/privacy`, `app/terms`, `app/support`, `app/onboarding`, `lib/clerk-appearance.ts`, `lib/stripe-appearance.ts`) and **never** over `app/globals.css`, `app/(dashboard)/creator/**`, `app/internal/**` or the `docs/web-redesign-2026-09/mockups/` artboards. Counts are **absolute zero for files the redesign creates** and a **ratchet from the Wave-0 baseline** for pre-existing in-scope files (must only fall; must be zero at the Phase 2 gate):

| Rule | Why |
|---|---|
| `backdrop-filter` / `backdrop-blur` | glassmorphism (baseline: 9 in `globals.css`, 1 in `clerk-appearance.ts:15`) |
| `radial-gradient` | the orb / pale radial hero (baseline: 5) |
| `filter:\s*blur\(` | floating blurred orbs |
| `border-radius:\s*(1[89]\|2[0-9]\|3[0-9]\|40)px` and `rounded-\[(1[89]\|2[0-9]\|3[0-9]\|40)px\]` | the 18–40px template radius (baseline: 8 in `globals.css`, `rounded-[28px]` in `clerk-appearance.ts:15`). **Exempt:** generated cover-art decor (`components/ui/cover-art.tsx` and the mockup bake), whose stripe pill radius is algorithmic |
| `style={{` | inline styles (ratcheting to 0; baseline 367) |
| `#[0-9a-fA-F]{3,8}` outside `app/styles/tokens.css` and `**/opengraph-image.tsx` and `app/icon.tsx` | hardcoded colour (baseline 30 in scope) |
| `!important` | cascade war (F2) |
| `@media \(max-width` in new style files | breakpoint direction mixing (F22) |
| emoji codepoints in source | emoji section markers |
| `process.env` inside any file containing `'use client'` | F17(a) |
| `>0[123]<` / `"0[123]"` adjacent to a step label | `01/02/03` step markers |

Implement as one shell script committed at Wave 0 (`scripts/design-gate.sh`) so every agent and the orchestrator run the identical rules. Do **not** rely on an eslint rule for the hex check — eslint does not see CSS files, and `eslint-config-next` will not flag inline styles. A grep script covers CSS + TSX uniformly and is auditable in five lines.

**(b) Web contrast test** — `lib/design-tokens.contrast.test.ts` (one path, owned by WP-01; `02-engineering.md` §5.2), ported from `mobile/src/constants/theme.contrast.test.ts` (10,203 B). Re-derives WCAG relative luminance from the web tokens for **both** palettes, including alpha compositing for `*Soft` fills; asserts every documented ratio; asserts the `accent` (foreground) / `accentFill` (white-text surface) split is preserved. Runs in the `node` vitest project. Mutation-test it once — change one token by a digit, prove the test goes red, revert — and paste both outputs. An unproven test is not a gate (this repo's own H9 finding).

**(c) Rendered contrast probe** — the token test cannot see Clerk's DOM or the effect of a stray inline style. So, in the screenshot harness, walk every text node on each page, compute effective foreground/background, and report anything under 4.5:1 (3:1 for ≥24px and for non-text UI). Run it on `/sign-in`, `/sign-up`, `/brand`, `/brand/settings` at minimum — the pages where Clerk renders. This is the only check that catches F4.

**(d) Frozen-surface contract check** — three assertions, all cheap:
1. `git diff --stat <base>..HEAD -- 'app/(dashboard)/creator' 'app/internal'` is **empty**.
2. For each of the **50** shared class names, extract its declaration block from `app/globals.css` and compare the SHA to the Wave-0 baseline file (`scripts/frozen-classes.sha256`, committed at Wave 0). Any change fails the wave.
3. Reference census: the set of `globals.css` classes referenced by `app/(dashboard)/creator` + `app/internal` is **unchanged** (72 classes today).

**Primary check, when available:** the orchestrator cannot sign in (it never handles credentials), but **Jackson can sign in once in the Claude browser pane on the reserved port** at each phase gate; from that signed-in tab the orchestrator captures `/creator`, `/creator/settings` and `/internal/waitlist` and diffs their rendered HTML and computed styles against the Wave-0 capture. That is strictly better evidence than the hash proxy below and is the same session used for the dashboard screenshots. When no signed-in tab exists, the hash check is the fallback and the DoD says so.

**Fallback:** this is the answer to "byte-identical rendered HTML for creator/* and internal/*" without a session. Curling the routes unauthenticated is impossible — `app/(dashboard)/layout.tsx:7-10` redirects unauthenticated requests to `/sign-in`, and there is no usable test identity anywhere (`docs/production-readiness-2026-09-06.md` §1, five-things #5: *"Nobody but Jackson can use the product"*; `TESTER_ALLOWED_EMAILS` unset). Faking a session would mean minting Clerk credentials against the live production instance — prohibited. So the check moves one layer down the stack: **if the frozen markup is byte-identical and every CSS rule it resolves to is byte-identical, the rendered HTML and its computed styles are necessarily identical.** That is a stronger guarantee than an HTML diff, and it needs no auth.
   *Optional strengthening, if the Wave-0 jsdom harness is cheap enough:* render `DashboardNavShell` with fixture props under vitest+jsdom and snapshot its HTML, so the shared component is pinned structurally too. Recommended, since `DashboardNavShell` is the single highest-risk shared file (F3).

**(e) Hydration / first-paint check** — for each page: assert zero console messages matching `hydrat|Warning: Text content did not match`; and with the `cd-theme` cookie set to `light`, then `dark`, then absent, assert the server HTML already carries the matching `data-theme` (or none) on `.cd-app`, and sample the background at ~100 ms and at load-complete — they must match (F5).

**(f) Font-loaded assertion** — assert the hero headline resolves to Archivo and body text to Schibsted Grotesk, not the fallbacks. A screenshot run failing this is discarded, not interpreted (F11).

**(g) Cover-art parity test** — fixed `(niche, id)` fixture table; web output must equal the mobile table's palette index and pattern name (F21).

**(h) Flag-resolution test** — CTA href for `MARKETPLACE_ACCESS` ∈ {`invite`, `open`, unset, `"OPEN "`, garbage}; fails closed to `/waitlist` (F17).

### 2.4 Screenshot matrix

Viewports: **390** (iPhone), **820** (tablet / small laptop — mandatory, see F22), **1440** (desktop).
Themes: **dark** and **light**.

| Surface | Pages | Viewports | Themes | Shots |
|---|---|---|---|---|
| Marketing | `/`, `/get-the-app`, `/waitlist`, `/privacy`, `/terms`, `/support`, `not-found` | 3 | dark (+ **light spot-check at 1440 only**, to prove nothing is unreadable if a user forces light) | 7×3 = 21 (+7) |
| Auth | `/sign-in`, `/sign-up`, `/onboarding` | 3 | dark + light | 3×3×2 = 18 |
| Brand dashboard | `/brand`, `/brand/metrics`, `/brand/campaigns/new`, `/brand/campaigns/[id]`, `/brand/campaigns/[id]/applications`, `/brand/applications`, `/brand/submissions`, `/brand/settings` | 3 | dark + light | 8×3×2 = 48 |
| **Total** | | | | **~94** |

Plus these non-page artifacts, reviewed once each:
- 4 rendered images: `/opengraph-image`, `/get-the-app/opengraph-image`, `/waitlist/opengraph-image`, `/icon` (§2.5).
- **`prefers-reduced-motion: reduce`** pass on `/` and `/brand` (2 shots) — proves animation is neutralised, not just present.
- **Keyboard-focus** pass: `/sign-in`, `/brand`, `/brand/campaigns/new` with focus rings visible on the first three tab stops (3 shots).
- **`UserButton` popover open** on `/brand`, dark and light (2 shots) — the Clerk surface most likely to be missed (F4).
- **Empty and error states** for `/brand/applications` and `/brand/submissions`, rendered from fixtures under jsdom — **never** by mutating the shared production database (F7).

**Marketing is dark-only by decision; the dashboard is dark + light.** Auth is dark-first but gets both, because it is the boundary where Clerk's light defaults leak (F4).

Every screenshot must be captured from the orchestrator's single reserved-port dev server, and must pass the build-marker check (F8) and the font-loaded check (F11) or be discarded.

### 2.5 OG / icon route verification

`/opengraph-image` and `/icon` are in `proxy.ts:17-18`'s public list; `/get-the-app/opengraph-image` and `/waitlist/opengraph-image` are covered by `/get-the-app(.*)` and `/waitlist(.*)`. So all four are `curl`-able without auth against the local server. For each: assert HTTP 200, `Content-Type: image/png`, non-trivial byte size, and **visually review the PNG** (the font fallback in F12 is only visible by looking). If a new image route is added anywhere in scope, it must be added to `isPublicRoute` in the same commit and re-verified — note `proxy.ts` is currently dirty (`M proxy.ts`, +23), so re-read it in the worktree.

### 2.6 Copy-vs-code claims checklist

Every marketing/dashboard copy package fills this in and cites `path:line` for the code side. The orchestrator re-verifies each line itself.

| # | Claim on the page | Code that must back it | Verified |
|---|---|---|---|
| 1 | The platform fee percentage | `lib/utils.ts:8-9` `PLATFORM_FEE_RATE() → 0.15`; the rendered number must be **derived** from it, not typed | ☐ |
| 2 | The fee is taken **out of** the accepted rate, never added on top | `lib/utils.ts:12-14` `calculatePlatformFee(amountCents)`; `docs/PROJECT-STATE.md` §4 (`application_fee_amount`, destination charge). Reference wording already correct at `app/page.tsx:61` | ☐ |
| 3 | "Your card is authorized, not charged, when you accept" | `capture_method: 'manual'` — `docs/PROJECT-STATE.md` §4 step 1 | ☐ |
| 4 | "You are charged when you approve the content" | `lib/payout.ts` capture path, idempotency key — §4 step 3 | ☐ |
| 5 | No subscription / no listing fee / no cost to post | no billing code exists; matches `app/page.tsx:61` | ☐ |
| 6 | Every primary CTA is **flag-aware** — `invite` → `/waitlist`, `open` → `/sign-up` | `lib/admin-config.ts` (`MARKETPLACE_ACCESS`), resolved server-side; unit test for all three branches | ☐ |
| 7 | No CTA hardcodes `/sign-up` or `/waitlist` | grep: zero literal hrefs to either outside the resolver | ☐ |
| 8 | App Store link **falls back** when unset | `NEXT_PUBLIC_IOS_APP_URL` unset → waitlist CTA, per `docs/platform-split/creator-web-freeze.md` "The landing page"; and `NEXT_PUBLIC_IOS_APP_ID` unset → **no** `metadata.itunes` smart banner. Both are build-time-inlined; verify **both** branches | ☐ |
| 9 | No claim that the iOS app is live / downloadable while `NEXT_PUBLIC_IOS_APP_URL` is unset | the app is not approved; `docs/BLOCKED-ON-JACKSON.md` #7-#12 | ☐ |
| 10 | No "beta" / "invite-only internal test" framing that contradicts open self-serve | App Review dossier flags this exact wording as a Guideline 2.2 problem in four places | ☐ |
| 11 | Deletion/privacy claims say **anonymize**, not "permanently delete" | `docs/PROJECT-STATE.md` §6; `LEGAL-03` was already fixed once by regression | ☐ |
| 12 | Legal pages carry no fabricated entity name, address, or effective date | `docs/BLOCKED-ON-JACKSON.md` #13 — entity is **unknown**; placeholders must remain placeholders | ☐ |
| 13 | No payout-timing or earnings promise not backed by code | no SLA exists anywhere | ☐ |
| 14 | Any creator-count / brand-count / testimonial is real or absent | **no** fabricated social proof, ever | ☐ |
| 15 | Net-vs-gross language is internally consistent across every page | `docs/BLOCKED-ON-JACKSON.md` #18 is **unresolved** — see §5; whichever the owner picks, all pages must match | ☐ |

### 2.7 Lighthouse / Core Web Vitals budget

Measured on the Preview deployment (or local production build) at mobile emulation, on `/`, `/get-the-app`, `/sign-in`:

| Metric | Budget | Fails the phase gate if |
|---|---|---|
| Performance | ≥ 90 | below |
| **Accessibility** | **= 100** | below (non-negotiable; the dark UI is the whole risk) |
| Best practices | ≥ 95 | below |
| SEO | ≥ 95 | below |
| LCP | ≤ 2.0 s | above |
| **CLS** | **≤ 0.02** | above (font swap, F16) |
| TBT | ≤ 200 ms | above |
| Total CSS (gzip) | ≤ 12 KB during migration, ≤ 8 KB after orphan sweep | above (baseline **6,553 B**) |
| First-load JS on `/` | ≤ Wave-0 baseline + 10% | above |

Capture the Wave-0 baseline for all of these **before** any design work, so "regression" is a number.

---

## 3. Definition of done

### Phase 0 — Worktree & harness (must complete before any design work)
- [ ] Both other sessions have committed and confirmed they will not touch web brand-facing files; base SHA recorded.
- [ ] Worktree created on `feat/web-redesign` from that SHA, **outside the iCloud-synced path** if possible.
- [ ] `npm ci` + `npx prisma generate` complete; `.env.local` copied in **with `CREATOR_WEB_MODE=full`**; `.env.production.local` **not** copied.
- [ ] `node -v` prints `v24.x` in the worktree shell; `.nvmrc` present.
- [ ] Green baseline pasted by the orchestrator: `typecheck`, `lint`, `test` (with test count).
- [ ] Vitest harness extended to `.tsx` + jsdom, **proven** with a deliberately-failing test shown red then green.
- [ ] `scripts/design-gate.sh` committed; baseline counts recorded (inline styles per dir, hex counts, class census, `globals.css` bytes).
- [ ] `scripts/frozen-classes.sha256` committed — the 50 shared-class declaration hashes.
- [ ] Wave-0 Lighthouse + CWV baseline captured for `/`, `/get-the-app`, `/sign-in`.
- [ ] Wave-0 "before" screenshots: full matrix at current state (this is the before/after evidence).
- [ ] Single dev server running on the reserved port; build marker in place; port 8081 untouched.

### Phase 1 — Mockups
- [ ] Design canvas (WP-00) published with the seven artboards from `01-design-brief.md` §10: landing **full length** at 1440 (hero variant B) **and** 390, the hero variant A alternative, the brand dashboard (dark **and** light), sign-in (with the Clerk form styled, not a hand-drawn stand-in), the token sheet with the brand-mark A/B.
- [ ] Token sheet on the canvas showing the derivation from `mobile/src/constants/theme.ts`, including the `accent` / `accentFill` split, with ratios stated.
- [ ] Cover-art system shown: all 8 palettes × 4 patterns.
- [ ] The **reduced mockup gate** passes on the artboard source: zero `backdrop-filter`, `radial-gradient`, `filter: blur(`, `border-radius` 18–40px, emoji, `01/02/03` markers, and no `text-align: center` on any element wider than 480px. (Inline styles and hex literals are expected in a static artboard and are not gated there.)
- [ ] Every money claim on the landing artboard maps to a row in the §2.6 checklist.
- [ ] CTA destinations shown for **both** `invite` and `open` flag states.
- [ ] **Owner has reviewed and approved, in writing, with comments resolved.** No build wave starts before this.

### Phase 2 — Build (per wave, and overall)
Per wave:
- [ ] Every package pasted all nine §2.1 items, including test counts and `node -v`.
- [ ] Orchestrator's own §2.2 run is green, including the empty creator/internal diff.
- [ ] Frozen-class hashes unchanged; frozen reference census unchanged (72).
- [ ] Ratchets moved the right way; frozen-dir counts unchanged.
- [ ] Each package committed as its own conventional commit.

Overall:
- [ ] Inline `style={{` in in-scope files = **0** (from 367).
- [ ] Hardcoded hex in in-scope `.tsx` = **0** outside tokens + the OG/icon exemption.
- [ ] Full anti-template grep gate = all zero.
- [ ] Contrast test green for **both** palettes; mutation-proven.
- [ ] Cover-art parity test green.
- [ ] Flag-resolution test green for all three branches.
- [ ] Zero hydration warnings; first-paint check passes on every page.
- [ ] `prefers-reduced-motion` neutralises every animation.
- [ ] `:focus-visible` on every interactive element, ≥3:1.
- [ ] All four OG/icon PNGs render correctly with the real typeface, visually reviewed.
- [ ] `next build` succeeds in the worktree on Node 24 (the only place this is caught).
- [ ] Orphan sweep done in its own final wave; `globals.css` reduced; frozen classes still intact.

### Phase 3 — Verify
- [ ] Full ~94-shot screenshot matrix captured, all passing the build-marker and font-loaded checks.
- [ ] Before/after pairs assembled for the owner at 390 and 1440.
- [ ] Rendered contrast probe: zero failures on all matrix pages, **including Clerk surfaces**.
- [ ] Keyboard walkthrough of `/sign-in`, `/brand`, `/brand/campaigns/new` recorded.
- [ ] Lighthouse budget met on `/`, `/get-the-app`, `/sign-in`.
- [ ] §2.6 copy checklist fully ticked with `path:line` citations, re-verified by the orchestrator.
- [ ] Pushed as `feat/web-redesign`; Vercel **Preview** builds green; marketing + auth spot-checked on Preview.
- [ ] `git log <base>..origin/main -- app/ lib/ proxy.ts` empty, or a reviewed rebase completed.
- [ ] Written statement of what was **not** covered (dashboard states unreachable without mutating production data — see F7).

### Overall
- [ ] All three gates green on Node 24, pasted by the orchestrator.
- [ ] Zero changed lines under `app/(dashboard)/creator/` and `app/internal/`.
- [ ] No flag default changed; no new `NEXT_PUBLIC_*` variable; no schema change; no production data written.
- [ ] Owner has approved the result on Preview.
- [ ] **The merge to `main` is explicitly NOT part of this project's done** (F18) — it is handed to Jackson behind audit blockers B1/B2/B3 and `docs/runbooks/deploy.md`.

---

## 4. Rollback

**Recommendation: branch-level revert. Do NOT build a feature flag.**

A theme feature flag would mean shipping both design systems simultaneously — two token sets, two component sets, doubled CSS payload, and a doubled test matrix — in a codebase whose central risk (F2) is *already* two style systems coexisting. It would also require the flag to be readable at first paint, reintroducing F5 on the critical path. The cost is high, permanent, and pointed directly at the project's biggest hazard. The `data-theme` dark/light switch is a *product* requirement and stays; a *design-version* flag does not.

**The strategy instead:**

1. **The redesign is one squash-merge commit on `main`.** Every package commits separately on `feat/web-redesign` (for wave-level revert during the project), but the merge to `main` is squashed to a single SHA. Rollback is then literally one command:
   ```bash
   git revert -m 1 <redesign-sha> && git push origin main   # == a production deploy of the old design
   ```
2. **The faster path, and the one to use first:** Vercel **instant rollback** — promote the previous production deployment in the dashboard. Seconds, no build, no git. `docs/runbooks/rollback.md` already exists; the redesign must add a "redesign rollback" section naming the pre-redesign deployment SHA and confirming that reverting the design touches **no** database state (it does not: nothing in scope writes to Prisma, changes a migration, or alters a flag default). That property is what makes a one-step revert safe, and it must be asserted at the Phase-2 gate.
3. **Why the additive-only CSS rule (F2) matters for rollback:** because the legacy stylesheet is never edited during Waves 1–N, `git revert` cannot half-restore it. The orphan sweep is deliberately the **last** package in its **own** wave, so if only the sweep is bad, reverting that one commit restores every legacy rule without touching the redesign.
4. **Partial rollback,** if only the marketing site is rejected: because packages own disjoint files, `git revert <marketing-package-sha>` restores `app/page.tsx` and the public shells while leaving the dashboard redesigned. This is the concrete payoff of the disjoint-file rule — record which SHA owns which surface in the wave log so this is executable without archaeology.
5. **Rollback trigger conditions,** decided in advance so nobody debates during an incident: any contrast failure on a live page; any creator or admin surface visibly altered; any money-claim error in copy; CLS > 0.1 or Performance < 70 on `/`; any hydration error in production logs.

---

## 5. Needs from the owner

Ordered by how much they block. Each states what the plan **assumes** if unanswered, so no agent guesses silently.

| # | Need | Type | If not provided, the plan assumes |
|---|---|---|---|
| 1 | **Both live sessions commit and stop touching web brand-facing files** (6 in-scope files are dirty; one intends to edit `globals.css`) | DO — **hard blocker** | Nothing starts. This is the one item with no workable fallback; a branch cut mid-edit guarantees F13. |
| 2 | **Approve the Phase-1 mockups**, or comment | DECIDE — hard gate | No build wave runs. |
| 3 | **Logo / wordmark / photography** — is there a real logo file, or is `brand-mark`/`brand-wordmark` a typographic lockup? Any brand photography or licensed imagery? | DO | Assume **no assets**: a typographic wordmark set in the one typeface, and **zero photography** — the design carries itself on type, colour, and the generated cover-art system (which we already have and which is genuinely distinctive). No stock photos, no AI-generated imagery, no placeholder faces. If real photos of local businesses/creators exist, say so — they would materially change the landing page and are the single highest-leverage asset. |
| 4 | **Confirm Node 24 is canonical** (already an open decision in `BLOCKED-ON-JACKSON.md`) | DECIDE | Assume **24** (matches Vercel, `.nvmrc`, `engines`) and run everything on it. |
| 5 | ~~Theme toggle?~~ **Decided:** the dashboard ships a System / Light / Dark control (`/brand/settings` + sidebar footer) backed by a server-read cookie, which removes the F5 flash class entirely (no inline script, no root-layout change). | DECIDED | — |
| 6 | **Does `/waitlist` stay?** (`BLOCKED-ON-JACKSON.md`: *"still wanted at `/waitlist` with referral codes now that `/get-the-app` is the creator funnel, or retire it?"*) | DECIDE | Assume it **stays and is redesigned**, since it is in the declared scope, has a live working Turnstile+Resend path verified 2026-09-07, and is the `invite`-mode CTA destination. If it is being retired, that removes a page, an OG image, and a form from the build. |
| 7 | **Net vs gross** (blocker #18, unresolved) | DECIDE | Assume **gross with an explicit fee line**, matching the accurate existing copy at `app/page.tsx:61`. Flagged on the mockup for approval. |
| 8 | **Legal page copy** — entity name, state of formation, address, effective date, age floor, venue (blockers #13/#14) | DO | Assume `/privacy` and `/terms` are **restyled only, with content byte-identical including every `[PLACEHOLDER]`**. No agent invents an entity name, address, or effective date. |
| 9 | **`MARKETPLACE_ACCESS` state at launch** | DECIDE | Assume it remains **`invite`** (per blocker #4, until Stripe is verified) and that every CTA must therefore work correctly in **both** states, resolved server-side. Both branches are tested and both are screenshotted. |
| 10 | **Confirm deletion of `app/(dashboard)/creator/payouts/page 2.tsx`** | DO | Assume it **stays**. It is typechecked but not routable, so it may produce phantom errors; agents are told to ignore, never edit, and never delete it. |
| 11 | **Where the redesign is reviewed** — Preview deployment, or local only? | DECIDE | Assume **Vercel Preview for marketing + auth**, local for the dashboard, because Preview has no `DATABASE_URL` (H14). Preview carries **live** Clerk keys — Jackson should not create accounts there. |
| 12 | **Support email / response-time commitment** for `/support` (blocker #24) | DECIDE | Assume the **existing** `support@creatordocks.com` and **no** response-time promise. No SLA is invented. |

---

## 6. Orchestrator checklist

**Does itself — never delegates.** (Each of these is a control that a dying or over-eager agent cannot be trusted with.)

- [ ] Confirm the other two sessions are committed and stopped; record the base SHA.
- [ ] Create the worktree; `npm ci`; `prisma generate`; place `.env.local` with `CREATOR_WEB_MODE=full`; verify `.env.production.local` is absent.
- [ ] Switch to Node 24 and paste `node -v`.
- [ ] Establish and paste the **green baseline** of all three gates from the worktree.
- [ ] Build and prove the vitest `.tsx`/jsdom harness (red → green). **Before any design work.**
- [ ] Commit `scripts/design-gate.sh` and `scripts/frozen-classes.sha256`; record every baseline count in the wave log.
- [ ] **Re-run the class-collision census in the worktree** (the 50-class set in this document was measured on the dirty tree; if the auth-CSS deletion landed, it moved) and regenerate package briefs from the result.
- [ ] Capture Wave-0 "before" screenshots and the Lighthouse/CWV baseline.
- [ ] Own the **single** dev server on the reserved port; verify the build marker; never let an agent start one.
- [ ] Write package briefs with **disjoint file ownership**, explicitly listing each package's files, and carrying the full prohibition list (§2.1).
- [ ] Cap concurrency at **≤ 6**.
- [ ] After **every** wave: run §2.2 personally — gates, `git status`, the empty creator/internal diff, the frozen-class hashes, the iCloud-dupe sweep, the `origin/main` drift check, the ratchets, the test count.
- [ ] Commit each package separately, conventional commits, before the next wave.
- [ ] Revert-and-redispatch any package that fails; **never** hand-patch a dead agent's file.
- [ ] Assemble the screenshot matrix and the before/after pairs; discard any run failing the build-marker or font-loaded check.
- [ ] Re-verify the §2.6 copy checklist against `path:line` itself — this is the one check where an agent grading its own copy is worthless.
- [ ] Push `feat/web-redesign`; confirm Vercel Preview is green; hand the Preview URL to the owner.
- [ ] Record the wave→SHA→surface map for partial rollback.
- [ ] **Stop at the branch.** Do not merge to `main` (F18).

**Delegates to build agents:** token authoring; the contrast, cover-art-parity and flag-resolution tests (written first, TDD); component and page implementation; the `BrandNavShell` fork; `lib/clerk-appearance.ts` dark/light; the OG/icon route restyle with real font buffers; copy rewriting against the checklist; the final orphan sweep.

**Delegates to nobody — owner only:** approving the mockups; supplying assets and legal copy; the answers in §5; exercising any real payment flow; and the merge to `main`.

---

## Guess list — what was unclear, inferred, or assumed

1. **The 50-class collision set was measured on the dirty tree** (branch `fix/ios-design-audit`, 41 modified + 19 untracked files). If the other session deletes dead auth CSS from `app/globals.css` before the branch is cut, the 143-class count, the 50-class collision set, the 22 frozen-only classes, and the 6,553 B gzip baseline all change. **The census must be re-run in the worktree at Wave 0** — I have made this an explicit orchestrator checklist item rather than treating my numbers as final.
2. **The class census is token-matching, not CSS parsing.** I extracted `className="…"` string tokens and intersected them with top-level `.class` selectors. It will miss classes composed dynamically (template literals with interpolation, `clsx`-style conditionals) and will over-count a token that coincidentally matches a class name. Treat 50 as the *floor* of the collision set, not an exact figure.
3. **I did not read all 1,760 lines of `app/globals.css`** — I skimmed structure, the `:root` block, the three `@media` breakpoints, and ran targeted greps. There may be nested/descendant selectors creating cross-scope coupling that a top-level `.class` census cannot see (e.g. `.dashboard-layout .something`). The frozen-class hash check partly covers this, but a full parse at Wave 0 would be better.
4. **I did not read `app/DashboardNavShell.tsx` or `app/PublicPageShell.tsx` line by line** — only their import graphs and line counts. The "fork `DashboardNavShell`" recommendation assumes the component is self-contained enough to fork cleanly; if it imports shared sub-components, the fork is larger than one file and the package boundary must grow.
5. **I did not verify that `mobile/src/lib/cover-art.ts` has exactly 8 palettes and 4 patterns** — I took that from the task brief. The parity-test fixture table must be generated from the actual file.
6. **The "no usable test identity" conclusion** driving the rejection of a curl-based creator/internal HTML diff comes from `docs/production-readiness-2026-09-06.md` §1 and `docs/PROJECT-STATE.md` §3, not from an attempted request. If a tester identity has been created since those docs were written, an authenticated before/after HTML diff becomes possible and would be strictly better than the CSS-hash proxy — worth re-checking at Wave 0.
7. **Lighthouse and CWV numbers are budgets I set, not measured baselines.** I could not run Lighthouse read-only without starting a dev server (prohibited by my role). If the current site already exceeds CLS 0.02, the budget is a target rather than a no-regression line — capture the real baseline at Wave 0 and reconcile.
8. **`docs/runbooks/rollback.md` is untracked (`?? docs/runbooks/`) and I did not read it.** My rollback section assumes it covers Vercel instant rollback; the "add a redesign section" recommendation may be redundant or may need more than I described.
9. **I did not read `lib/admin-config.ts`** — it is modified (+32 lines uncommitted) and its current shape is unknown. The `MARKETPLACE_ACCESS` behaviour I describe comes from `docs/PROJECT-STATE.md` §5 and `BLOCKED-ON-JACKSON.md` #4. Whether the flag is exported as a helper the CTA can call server-side is **unverified** and is the first thing the CTA package must check.
10. **I did not read `node_modules/next/dist/docs/`.** `AGENTS.md` requires it before assuming APIs. My claims about `ImageResponse`/Satori font handling, `suppressHydrationWarning`, and `next/font` build-time fetching are from general Next.js App Router behaviour, not from this version's docs. Every build agent touching those must read the local docs first; I have flagged this inside F11/F12 rather than asserting the API shape.
11. **Port 3000 was free when I checked**, but the other session may bind it at any moment. The reserved-port recommendation stands regardless.
12. **The screenshot count (~94)** assumes the brand dashboard has exactly the 8 routes listed in `app/(dashboard)/brand/layout.tsx:20-25` plus a campaign detail page. I did not enumerate `app/(dashboard)/brand/**` exhaustively; the real route list should be generated at Wave 0 and the matrix sized from it.
13. **Whether `not-found` is a distinct in-scope file** — the brief lists it, but I did not locate `app/not-found.tsx`. If it does not exist, it must be created rather than restyled.
14. **I assumed the marketing site is dark-only** and the dashboard is dark+light, per the brief's wording ("marketing site is dark-first; the dashboard … MUST also ship a working light mode"). "Dark-first" could mean the marketing site also needs light. I added a light spot-check at 1440 to hedge; if full light marketing is required, the matrix grows by ~21 shots.
15. **The `.nvmrc` is untracked.** I assumed the other session will commit it before the branch is cut. If not, the worktree has no `.nvmrc` and CI's `node-version-file` step breaks — I made its presence an explicit Wave-0 assertion.