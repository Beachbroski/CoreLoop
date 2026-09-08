> **Resolutions applied 2026-09-08.** This section was drafted by an Opus panel on 2026-09-07 and then corrected against two adversarial reviews (see `09-panel-critiques.md`). Where this document and `00-PLAN.md` disagree, **`00-PLAN.md` wins.**

# CreatorDocks Web Redesign — Engineering Plan

**Scope owner:** staff engineer / migration architect
**Repo:** `/Users/jsteele/Desktop/CreatorDocks/marketplace` (git root; `mobile/` and `packages/*` are npm workspaces inside it)
**Read at:** commit `9fdf866` on `fix/ios-design-audit` with a dirty tree. **Update 2026-09-08:** the other sessions have since committed everything (`126e86b` is the tip; source tree clean apart from docs). Every inventory number below must be re-measured in the worktree at Wave 0 anyway.
**Installed Next:** `16.3.4` (the other session bumped `package.json` from `16.2.6` → `16.3.4` mid-audit; `node_modules/next` is already at 16.3.4, so all doc citations below are from the version that will actually run)

---

## 1. Inventory

### 1.1 Marketing site (public, dark-first)

| File | LOC | S/C | globals.css classes it relies on | Inline `style={{}}` | Other-session overlap | Notes |
|---|---|---|---|---|---|---|
| `app/page.tsx` | 247 | server | `hero-grid, hero-copy-stack, hero-title, hero-copy, cta-row, chip-row, pill, eyebrow, hero-stage, hero-orb, one, two, dashboard-stack, glass-card, split-row, list-row, status-pill, subtle-grid, marketing-section, section-frame, section-title, section-copy, feature-grid, feature-card, bento-grid, bento-card, faq-grid, dashboard-panel, spacing-xl, apple-btn, apple-btn-ghost` | 30 | — | The whole anti-template hit list lives here: orbs, glass hero card that restates the copy, `01/02/03` markers, 12-col bento. Content model (`dealSignals`, `brandSteps`, `brandDifferences`, `faqItems`) is good and should survive; the chrome should not. |
| `app/get-the-app/page.tsx` | 275 | server | same set as `page.tsx` | 27 | — | Creator-facing but web-owned (freeze doc: legal/marketing pages stay on web). Has `metadata.itunes` gated on `NEXT_PUBLIC_IOS_APP_ID`. |
| `app/waitlist/page.tsx` | 55 | server | `hero-grid, waitlist-page-grid, hero-copy-stack, hero-title, hero-copy, chip-row, pill, eyebrow, dashboard-panel` | 0 | — | Wraps `WaitlistForm` in `Suspense` (form reads `useSearchParams`). |
| `app/waitlist/WaitlistForm.tsx` | 490 | **client** | `waitlist-*` (10 classes), `apple-input, apple-select, apple-btn, apple-btn-ghost, apple-link, banner-danger/info/success, field-label, cta-row, dashboard-panel, subtle-grid, eyebrow, page-copy, sidebar-label, turnstile-panel, turnstile-copy` | 17 | **YES — modified** | Largest client file in scope. Turnstile widget, referral codes, `@vercel/analytics` `track()`. Rewrite must not touch the submit contract or Turnstile mount. |
| `app/privacy/page.tsx` | 51 | server | `dashboard-panel, page-copy` | 1 | — | Content-only; `PublicPageShell` does the layout. |
| `app/terms/page.tsx` | 61 | server | `dashboard-panel, page-copy` | 1 | — | Same. |
| `app/support/page.tsx` | 41 | server | `dashboard-panel, page-copy, pill, subtle-grid, apple-link` | 3 | — | Same. |
| `app/not-found.tsx` | 29 | server | `auth-shell, section-frame, subtle-grid, spacing-xl, brand-lockup/mark/wordmark, eyebrow, page-title, page-copy, cta-row, apple-btn, apple-btn-ghost` | 5 | — | Root `not-found` — renders inside the root layout only, no `PublicPageShell`. |
| `app/PublicPageShell.tsx` | 94 | server | `apple-nav, public-nav, public-nav-content/form (undefined), apple-shell, brand-lockup/mark/wordmark, nav-links, nav-link, public-nav-cta, section-frame, subtle-grid, spacing-xl, eyebrow, page-title, page-copy, public-footer, public-footer-links, public-footer-copy, footer-link, apple-btn` | 4 | — | The pill nav + the whole public chrome. `public-nav-content` / `public-nav-form` are defined at `globals.css:1565` and `:1569` (inside the 640px block) — live rules, do not delete. |
| `app/PublicWaitlistLink.tsx` | 23 | **client** | none | 0 | — | Preserves UTM query onto `/waitlist`. This is the file the flag-aware CTA replaces/wraps. |
| `app/AdminPreviewBanner.tsx` | 25 | **client** | `admin-preview-banner, admin-preview-banner-link` | 0 | — | `?preview=admin` only. |

### 1.2 Auth + onboarding

| File | LOC | S/C | Classes | Inline | Overlap | Notes |
|---|---|---|---|---|---|---|
| `app/(auth)/sign-in/[[...sign-in]]/page.tsx` | 46 | server | `auth-shell, auth-card, auth-hero, auth-hero-stack/eyebrow/title/copy, auth-panel, auth-panel-center, auth-panel-inner, auth-panel-center-inner, auth-clerk-shell, brand-lockup/mark/wordmark, eyebrow, apple-link` | 1 | **YES — modified** | `<SignIn appearance={authClerkAppearance} oauthFlow="redirect" forceRedirectUrl="/post-login">`. |
| `app/(auth)/sign-up/[[...sign-up]]/page.tsx` | 60 | server | same | 2 | **YES — modified** | Same shape; carries the "creating an account ≠ marketplace access" doc comment — keep it. |
| `app/sso-callback/[[...sso-callback]]/page.tsx` | 13 | server | none | 0 | — | Bare `<AuthenticateWithRedirectCallback>` — renders nothing. Needs a themed loading state. |
| `app/post-login/page.tsx` | 12 | server | none | 0 | — | `export const dynamic = 'force-dynamic'`, redirects only. Do not add UI. |
| `app/onboarding/page.tsx` | 210 | **client** | `onboarding-shell, auth-card, auth-hero, auth-panel, role-grid, role-card, banner-danger, brand-lockup/mark/wordmark, eyebrow, page-title, page-copy, pill, subtle-grid` | 17 | — | Client page; fetches `/api/users/me`, POSTs role. Role picker (BRAND/CREATOR) is the one screen where the creator path is still first-class on web. |
| `lib/clerk-appearance.ts` | 49 | — | n/a | n/a | — | **Hard-coded light palette + Tailwind arbitrary-value class strings.** `colorPrimary: '#0071e3'`, `fontFamily: '"Plus Jakarta Sans", sans-serif'`. This is why Tailwind cannot be dropped (§2.1). |

### 1.3 Brand dashboard

| File | LOC | S/C | Classes | Inline | Overlap | Notes |
|---|---|---|---|---|---|---|
| `app/layout.tsx` | 60 | server | Tailwind `h-full min-h-full flex flex-col antialiased` | 1 (`fontFamily`) | — | Root layout. `ClerkProvider` + `Plus_Jakarta_Sans` (`--font-display`) + `Analytics` + metadata. |
| `app/(dashboard)/layout.tsx` | 13 | server | none | 0 | — | Auth/tester gate only. Do not restyle. |
| `app/(dashboard)/brand/layout.tsx` | 31 | server | `dashboard-layout, main-shell` | 0 | — | Owns the nav item list. Already async/dynamic (`auth()`), so it is the correct place to stamp `data-theme` (§2.3). |
| `app/DashboardNavShell.tsx` | 159 | **client** | `sidebar-shell, desktop-sidebar, sidebar-block, sidebar-label, sidebar-link, sidebar-link-active, sidebar-footer, mobile-dashboard-bar, mobile-drawer*, mobile-menu-button, mobile-workspace-label, brand-lockup/mark/wordmark, dashboard-panel, subtle-grid` | 17 | — | Contains a hard-coded "System feel" marketing panel in the sidebar — delete. `UserButton appearance={{elements:{avatarBox:'w-10 h-10'}}}` (Tailwind). Shared with the creator layout — **must keep working for `/creator`**. |
| `app/(dashboard)/AdminViewBanner.tsx` | 21 | server | `banner-warning` | 2 | — | Used by every brand page **and** creator pages. |
| `app/(dashboard)/ChangeRoleControl.tsx` | 45 | **client** | `apple-btn-ghost` | 2 | — | Used by brand *and* creator settings. |
| `app/(dashboard)/brand/page.tsx` | 202 | server | `page-header*, page-title, page-copy, metric-card, metric-value, metric-label, metric-trend, four-col, two-col, section-header*, list-row, split-row, empty-state, empty-icon, status-pill, pill, chip-row, shimmer, sidebar-label, dashboard-panel, subtle-grid, apple-btn, apple-btn-ghost, apple-link` | 25 | — | Suspense + `shimmer` skeletons. Composes `AttentionList` and `FunnelBars` from `metrics/`. |
| `app/(dashboard)/brand/metrics/page.tsx` | 86 | server | `admin-metric-grid, page-header*, two-col, shimmer, spacing-xl, subtle-grid, apple-btn-ghost` | 8 | — | Reuses **admin-prefixed** classes (`admin-metric-grid`) — a brand page depending on classes named for internal. Untangle. |
| `app/(dashboard)/brand/metrics/BrandMetricsView.tsx` | 301 | server | `admin-breakdown-*, admin-trend-*, admin-metric-grid, metric-card*, glass-card, empty-state, section-header*, status-pill, pill, chip-row, two-col, spacing-xl, split-row, dashboard-panel, subtle-grid` | 39 | — | **Highest inline-style density in the repo.** Largest single rewrite target. |
| `app/(dashboard)/brand/metrics/AttentionList.tsx` | 67 | server | `list-row, page-copy, apple-link` | 5 | — | |
| `app/(dashboard)/brand/metrics/BreakdownList.tsx` | 46 | server | `admin-breakdown-track/fill, page-copy, sidebar-label, subtle-grid` | 6 | — | Bar widths are inline `%` → becomes a CSS custom property. |
| `app/(dashboard)/brand/metrics/FunnelBars.tsx` | 49 | server | `admin-breakdown-track/fill, subtle-grid` | 7 | — | Same. |
| `app/(dashboard)/brand/campaigns/[id]/page.tsx` | 244 | server | `page-header, page-title, page-copy, glass-card, dashboard-panel, split-row, status-pill, pill, chip-row, two-col, empty-state, empty-icon, shimmer, brand-mark, subtle-grid, apple-btn` | 31 | — | Uses `brand-mark` as a creator-avatar fallback; renders `<img>` (lint warn). |
| `app/(dashboard)/brand/campaigns/[id]/ApplicationActions.tsx` | 214 | **client** | `apple-btn, apple-btn-ghost, chip-row` | 14 | — | Stripe `Elements` + `PaymentElement`. **Do not restructure the payment flow** — restyle the wrapper only; Stripe's own iframe needs `appearance` passed to `Elements` for dark mode. |
| `app/(dashboard)/brand/campaigns/[id]/CampaignEditControls.tsx` | 293 | **client** | `apple-btn, apple-btn-ghost, apple-input, apple-textarea, field-label, chip-row, subtle-grid` | 10 | — | Biggest brand client form after `NewCampaignForm`. |
| `app/(dashboard)/brand/campaigns/[id]/applications/page.tsx` | 183 | server | `page-title, page-copy, glass-card, dashboard-panel, split-row, status-pill, empty-state, empty-icon, shimmer, spacing-xl, brand-mark, subtle-grid, apple-btn, apple-link` | 24 | **YES — modified** | `isAllowedContentUrl` guard before rendering `href` — **preserve exactly**; it is a security fix from the other session. |
| `app/(dashboard)/brand/campaigns/[id]/applications/SubmissionReview.tsx` | 133 | **client** | `apple-btn, apple-btn-ghost, apple-input, field-label, chip-row, subtle-grid` | 12 | — | |
| `app/(dashboard)/brand/campaigns/new/page.tsx` | 23 | server | `apple-btn, empty-state, empty-icon, page-copy` | 2 | — | Read-only admin guard branch. |
| `app/(dashboard)/brand/campaigns/new/NewCampaignForm.tsx` | 268 | **client** | `apple-input, apple-select, apple-textarea, field-label, banner-danger, glass-card, dashboard-panel, two-col, chip-row, pill, page-title, page-copy, subtle-grid, apple-btn` | 15 | — | The brand-facing form that matters most commercially. Checkbox-chip pattern (platforms/deliverables) lives here. |
| `app/(dashboard)/brand/applications/page.tsx` | 129 | server | `page-header*, page-title, page-copy, list-row, status-pill, empty-state, empty-icon, shimmer, chip-row, brand-mark, dashboard-panel, subtle-grid, apple-btn, apple-btn-ghost, apple-link` | 15 | — | `<img>` avatar. |
| `app/(dashboard)/brand/submissions/page.tsx` | 143 | server | same as applications | 16 | **YES — modified** | `isAllowedContentUrl` guard — preserve. `<img>` avatar. |
| `app/(dashboard)/brand/settings/page.tsx` | 94 | server | `dashboard-panel, page-title, page-copy, shimmer, subtle-grid` | 16 | — | Hosts `ChangeRoleControl`. Natural home for the theme toggle's "Appearance" row. |

### 1.4 Identity assets

| File | LOC | Notes |
|---|---|---|
| `app/icon.tsx` | 34 | `ImageResponse` 32×32, coral `#ff503d` tile with `D`, `fontFamily: 'Arial'`. Already coral — the identity is half-migrated. |
| `app/opengraph-image.tsx` | 58 | 1200×630, **pale blue gradient** `linear-gradient(135deg,#eef6ff,#fff,#dbeafe)` — the exact AI-template look, with a coral logo tile sitting on it. |
| `app/get-the-app/opengraph-image.tsx` | 62 | Copy of the above with creator copy. |
| `app/waitlist/opengraph-image.tsx` | 1 | `export { contentType, default, size } from '../opengraph-image'`. |

### 1.5 Out of scope but load-bearing (read-only for every package)

| File | Why it constrains us |
|---|---|
| `app/globals.css` (1,760 LOC) | 51 of its classes are used by **both** in-scope pages and out-of-scope `creator/*` + `internal/*`. See §2.4. |
| `app/(dashboard)/creator/**` (9 files, 1,403 LOC) | Frozen. Depends on `apple-*`, `overlay-panel-*`, `filter-*`, `platform-pill`, `three-col`, plus `DashboardNavShell`, `AdminViewBanner`, `ChangeRoleControl`. |
| `app/internal/**` (5 files) | Admin, web-only forever, **no `layout.tsx` exists**. Depends on `waitlist-table*`, `admin-*`, `apple-*`. |
| `proxy.ts` | Already sets `x-pathname` on every request (**modified by other session**). Public-route matcher covers `/icon`, `/opengraph-image`, `/waitlist(.*)`, `/get-the-app(.*)` — new OG routes under those prefixes are already public. |
| `lib/admin-config.ts` | `getMarketplaceAccess()` / `isMarketplaceOpen()` — the CTA flag source (**modified by other session**). |
| `mobile/src/constants/theme.ts` | Token source of truth for colour. Its `Fonts.web` object is dead code on both platforms (nothing reads it) — there is **no** CSS-variable-name contract with mobile. Note the file imports `react-native` and a nonexistent `@/global.css`, so it **cannot be imported from a web test**; WP-01 extracts the `Colors` literal into a committed fixture instead. |
| `mobile/src/lib/cover-art.ts` | 8 palettes, FNV-1a hash, 4 patterns. Zero imports → safely importable from a web parity test. |

### 1.6 Legacy-class dependency partition (measured, not guessed)

- **Used only by `creator/*`** (12): `apple-card, filter-bar, filter-chip, overlay-panel, overlay-panel-{shell,scrim,header,form,actions,close}, platform-pill, three-col`
- **Used only by `internal/*`** (8): `admin-{filter-grid,newest-card,newest-grid,user-menu}, waitlist-table, waitlist-table-sort, waitlist-status-control, waitlist-status-message`
- **Shared by out-of-scope AND in-scope** (51): `apple-{btn,btn-ghost,input,select,link,nav,shell}, admin-{metric-grid,trend-*,breakdown-*}, banner-warning, brand-{lockup,mark,wordmark}, chip-row, dashboard-{layout,panel}, empty-state, empty-icon, eyebrow, field-label, four-col, glass-card, list-row, main-shell, metric-{card,value,label,trend}, nav-link(s), page-{copy,title,header*}, pill, section-header*, shimmer, sidebar-label, spacing-xl, split-row, status-pill, subtle-grid, two-col`
- **In-scope only, safe to retire once pages are rewritten** (~55): all `hero-*`, `bento-*`, `feature-*`, `faq-grid`, `auth-*`, `onboarding-shell`, `role-*`, `public-*`, `footer-link`, `mobile-drawer*`, `sidebar-shell/block/footer/link`, `waitlist-*`, `turnstile-*`, `marketing-section`, `section-frame`, `section-{title,copy}`, `cta-row`, `dashboard-stack`, `admin-preview-banner*`

**Consequence:** globals.css cannot be rewritten in place. The 51 shared classes must keep their current definitions until creator web is actually sunset.

---

## 2. Target architecture

### 2.1 Tokens: plain CSS custom properties, **not** Tailwind `@theme` — but Tailwind stays installed

**Decision: `lib/design-tokens.ts` (TypeScript, source of truth) → `app/styles/tokens.css` (CSS projection) → a test that proves they agree.**

Why not Tailwind `@theme`:
1. The site uses essentially **zero** Tailwind utilities in its own markup. The only utility strings are `h-full min-h-full flex flex-col antialiased` in `app/layout.tsx`, `w-10 h-10` in `DashboardNavShell`, and the arbitrary-value classes inside `lib/clerk-appearance.ts`. Generating a utility layer for a codebase that writes semantic classes is dead weight.
2. `@theme` variables are emitted on `:root` and are awkward to re-declare per `[data-theme]`; we need three theme states plus a *nested* forced-dark scope for marketing. Plain custom properties do this natively.
3. Tokens must be readable from **TypeScript** (Clerk `appearance`, Satori OG images, the Stripe `Elements` appearance object, the contrast test). Satori does not resolve CSS variables at all — OG images need literal hex. A TS source of truth serves all four consumers; a CSS-only `@theme` serves none of them.

Why Tailwind must **stay** (`@import "tailwindcss"` and `@tailwindcss/postcss`):
- `lib/clerk-appearance.ts` passes Tailwind class strings to Clerk (`rounded-[28px]`, `text-[#667085]`, `min-h-12`, `border-[rgba(15,23,42,0.08)]`). Removing Tailwind silently un-styles every Clerk-rendered element. Same for `avatarBox: 'w-10 h-10'`.
- Removing it is a separate, risky change with no upside for this redesign. **Keep the import; add no new utility usage.**

**File layout**

```
lib/design-tokens.ts          ~180 LOC  the palette, in TS, ported from mobile theme.ts
lib/design-tokens.contrast.test.ts ~200 LOC  web mirror of theme.contrast.test.ts
lib/design-tokens.css.test.ts ~80 LOC   parses tokens.css, asserts it equals the TS object
app/styles/index.css          ~12 LOC   the ONE entry: @import tailwind, legacy, tokens, base, components
app/styles/tokens.css         ~160 LOC  :root / [data-theme] blocks
app/styles/base.css           ~120 LOC  resets, canvas, typography, focus ring
app/styles/components.css     ~0        (empty; components own their CSS — see §2.5)
```

`app/styles/index.css` is imported **once**, from `app/layout.tsx`. Per `01-app/01-getting-started/11-css.md` §"Ordering and Merging": *"Try to contain CSS imports to a single JavaScript or TypeScript entry file"* and *"CSS ordering can behave differently in development, always ensure to check the build."* Using CSS-level `@import` (resolved by `@tailwindcss/postcss`'s bundled `postcss-import`) makes order deterministic at build time instead of relying on Next's chunker.

**Token names** — fixed now so packages can run in parallel. Prefix `--cd-`. Colour names mirror `mobile/src/constants/theme.ts` 1:1 so a reviewer can diff the two files; the design brief's semantic roles are carried by the three web-only additions:

```
colour:   --cd-text --cd-text-secondary --cd-text-faint (web-only, non-text ≥3:1)
          --cd-bg --cd-bg-element --cd-bg-raised (web-only) --cd-bg-selected
          --cd-border --cd-border-strong
          --cd-accent --cd-accent-fill --cd-accent-strong --cd-accent-soft --cd-on-accent
          --cd-secondary --cd-secondary-soft
          --cd-success --cd-success-soft --cd-warning --cd-warning-soft --cd-danger --cd-danger-soft
          --cd-focus --cd-art-scrim (web-only) --cd-overlay (page scrim, web-only)
brand:    --cd-brand-coral (#ff503d) --cd-brand-coral-strong (#e63f2d)
type:     --cd-font-display (Archivo, variable wdth/wght) --cd-font-body (Schibsted Grotesk)
          — there is NO mono token; money uses Archivo condensed with tabular figures
elevation:--cd-elev-1 --cd-elev-2 --cd-elev-3
space:    --cd-space-0 … --cd-space-10 (2/4/8/12/16/24/32/48/64/96/128 px)
radius:   --cd-radius-0 --cd-radius-1 --cd-radius-2 --cd-radius-3 --cd-radius-4 --cd-radius-full (0/4/6/10/14/999)
motion:   --cd-ease --cd-dur-fast --cd-dur-base
```

Rules for build agents:
- The dark values are **copied verbatim** from `Colors.dark`; light values verbatim from `Colors.light`. `--cd-bg-raised` and `--cd-overlay` are web-only additions.
- **Any new colour token must be added to a table in `design-tokens.contrast.test.ts`.** The mobile test's coverage guard (`rates every soft fill in at least one pairing table`) is ported; it fails on your behalf if you forget.
- No hex literal may appear in any `.tsx` under `app/`, `components/` — enforced by the source-scan test in WP-27. The only exceptions are `lib/design-tokens.ts` and the four `ImageResponse` files (which import from it).

### 2.2 Theme states

```css
/* app/styles/tokens.css — DARK is the product default, so it is the bare :root */
:root, [data-theme='dark'] { color-scheme: dark;  /* dark values */ }
[data-theme='light']       { color-scheme: light; /* light values */ }
@media (prefers-color-scheme: light) {
  :root:not([data-theme='dark']):not([data-theme='light']) { color-scheme: light; /* light values */ }
}
```

Note the selectors are **attribute selectors, not `:root[data-theme]`** — this is deliberate and differs from the usual pattern. It lets any element carry a theme scope, which is what forces marketing to stay dark inside a shared root layout.

### 2.3 Applying the theme (no flash, no dynamic root layout)

The hard constraint: `app/layout.tsx` is shared by marketing (must be static + always dark) and the dashboard (must be dynamic + user-toggleable). Reading `cookies()` or `headers()` in the root layout would opt **every** marketing page out of static rendering. And `layout.md` §"Pathname" is explicit: *"Layouts do not re-render on navigation, so they do not access pathname."* So route-based theming in the root layout is out.

**The design:**

| Surface | Where `data-theme` is stamped | Value |
|---|---|---|
| `<html>` in `app/layout.tsx` | nothing stamped | inherits `:root` = dark |
| Marketing (`PublicPageShell`, `not-found`) | `<div className="cd-app" data-theme="dark">` | always `dark`, hard-coded |
| Auth (`sign-in`, `sign-up`, `sso-callback`, `onboarding`) | `<div className="cd-app" data-theme="dark">` | always `dark` |
| Brand dashboard | `app/(dashboard)/brand/layout.tsx` reads the `cd-theme` cookie server-side and stamps `<div className="cd-app" data-theme={theme}>` | `dark` \| `light` \| `system` |

- The brand layout is **already** dynamic (`getCurrentAppUser()` → `auth()`), so adding `await cookies()` costs nothing.
- Server-rendered `data-theme` ⇒ **zero flash**, no blocking inline `<script>`, no `localStorage` hydration dance.
- `'system'` renders **no** `data-theme` attribute at all, which drops through to the `prefers-color-scheme` media block — the third state.
- Marketing pages stay statically prerendered because nothing dynamic is added to the root layout.

**Theme state lives in a cookie, not localStorage.** `lib/theme.ts`:

```ts
export const THEME_COOKIE = 'cd-theme'
export type ThemePreference = 'system' | 'light' | 'dark'
export function parseThemePreference(raw: string | undefined): ThemePreference  // fails to 'dark'
export function themeAttribute(pref: ThemePreference): 'dark' | 'light' | undefined
```

`ThemeToggle` is a client component: writes `document.cookie = 'cd-theme=…; Path=/; Max-Age=31536000; SameSite=Lax'` (not `httpOnly`, so the write is synchronous and free), optimistically sets `data-theme` on its own nearest `.cd-app` ancestor for instant feedback, then calls `router.refresh()` so the server and client agree. Toggle lives in the sidebar footer **and** as an "Appearance" row in `/brand/settings`.

`html`/`body` keep no theme paint of their own; the opaque canvas is `.cd-app { background: var(--cd-bg); color: var(--cd-text); min-height: 100dvh; }`. `<html>` additionally gets `background: #07080b` via `base.css` so iOS/macOS overscroll rubber-banding does not flash the legacy gradient.

### 2.4 Keeping legacy `globals.css` alive for `creator/*` and `internal/*`

Options evaluated:

**(a) Split legacy into a file imported only by the creator/internal layouts.** `11-css.md` §"Global CSS": *"Global styles can be imported into any layout, page, or component inside the `app` directory."* So the mechanism works — the root layout import does **not** make this impossible. But there is no `app/internal/layout.tsx`, so it would need creating, and the doc's own caveat applies: *"since Next.js uses React's built-in support for stylesheets to integrate with Suspense, this currently does not remove stylesheets as you navigate between routes."* Navigating `/brand` → `/internal/waitlist` would leave both sheets loaded anyway, so the isolation is illusory while still costing us edits to out-of-scope files.

**(b) Rewrite globals.css in place.** Rejected: 51 shared classes, ~1,400 out-of-scope LOC depend on them.

**(c) — ADOPTED — Namespaced coexistence, zero touches to frozen files.**

Keep `app/globals.css` imported globally and **frozen until WP-26** (no edit in waves 1–4, by anyone). Every new class is prefixed `cd-`; every new variable is prefixed `--cd-`. There is exactly one real collision between the two systems: the legacy `body` rule paints the pale-blue gradient and the old text colour. It is out-cascaded without editing it, using `:has()` (supported in every browser this product targets):

```css
/* app/styles/base.css — new file, WP-04 */
html:has(.cd-app) { background: var(--cd-bg); }
body:has(.cd-app) { background: var(--cd-bg); color: var(--cd-text); }
.cd-app { min-height: 100dvh; background: var(--cd-bg); color: var(--cd-text); }
```

`body:has(.cd-app)` (0,1,1) beats the legacy `body` (0,0,1) regardless of source order. Creator and admin pages render no `.cd-app`, so they keep the gradient, the colour and every one of their classes — **pixel-identical, with no edit to `app/(dashboard)/creator/**`, no new `app/internal/layout.tsx`, and no edit to `globals.css`.** The earlier draft's `.legacy-canvas` extraction and its two out-of-scope touches are withdrawn.

Why this is the right trade:
- Legacy pages stay pixel-identical and untouched — the frozen-surface gate (`git diff --stat -- 'app/(dashboard)/creator' 'app/internal'` must be empty) holds by construction.
- No `!important`, no specificity war, no dependency on CSS source order (which `11-css.md` warns differs between dev and build).
- `globals.css` is edited by exactly one package (WP-26, alone, last), so the other sessions' possible dead-auth-CSS deletion can never conflict mid-project.

**Dead-CSS removal (WP-26, last wave):** once every in-scope page is rewritten, delete only the ~55 classes proven unused by `creator/*` and `internal/*`. `tests/legacy-css-contract.test.ts` (WP-03) is the guard: it greps `app/(dashboard)/creator/**` + `app/internal/**` for `className` tokens, cross-references `globals.css`, and **fails if any class those pages use is missing** — so a wave-5 agent physically cannot delete a class creator or admin still needs.

### 2.5 Component library

**Location: `components/ui/` at the repo root** (`@/components/ui/*` via the existing `paths` alias). Outside `app/` so route-file conventions never apply to it, and so `app/**/*.test.ts` include globs stay meaningful.

**Styling: one plain `.css` file per component, colocated, imported by the component**, classes prefixed `cd-`. Not CSS Modules — the classes must be inspectable by name in devtools and in the design canvas, and the `cd-` prefix already guarantees no collision with the 1,760-line legacy sheet. Not inline styles — see §2.6. **Each component imports its own colocated `.css` file** (`import './button.css'` — a global stylesheet imported from a component, which `11-css.md` §"Global CSS" permits from any component inside `app/` or imported by it). `app/styles/index.css` imports only `tailwindcss`, `../globals.css`, `tokens.css` and `base.css` — it is **never** edited by a component package, which removes the same-wave collision the first draft had. Ordering between component sheets is irrelevant by design: `cd-` classes are namespaced and no component sheet styles another component's classes. The Suspense caveat (sheets are not unloaded on navigation) is harmless for the same reason.

| Component | File | LOC budget | Server/Client | Test file |
|---|---|---|---|---|
| Button | `components/ui/button.tsx` + `.css` | 90 | server | `button.test.tsx` |
| IconButton | `components/ui/icon-button.tsx` | 60 | server | `icon-button.test.tsx` |
| Surface (card/panel) | `components/ui/surface.tsx` | 80 | server | `surface.test.tsx` |
| Section | `components/ui/section.tsx` | 70 | server | `section.test.tsx` |
| Pill / StatusPill | `components/ui/pill.tsx` | 110 | server | `pill.test.tsx` |
| PageHeader | `components/ui/page-header.tsx` | 70 | server | `page-header.test.tsx` |
| SectionHeader | `components/ui/section-header.tsx` | 55 | server | `section-header.test.tsx` |
| MetricCard | `components/ui/metric-card.tsx` | 100 | server | `metric-card.test.tsx` |
| TrendIndicator | `components/ui/trend.tsx` | 55 | server | `trend.test.tsx` |
| MeterBar (funnel/breakdown) | `components/ui/meter-bar.tsx` | 70 | server | `meter-bar.test.tsx` |
| Field | `components/ui/field.tsx` | 80 | server | `field.test.tsx` |
| Input | `components/ui/input.tsx` | 60 | server | `input.test.tsx` |
| Textarea | `components/ui/textarea.tsx` | 55 | server | `textarea.test.tsx` |
| Select | `components/ui/select.tsx` | 70 | server | `select.test.tsx` |
| CheckboxChip | `components/ui/checkbox-chip.tsx` | 80 | server | `checkbox-chip.test.tsx` |
| EmptyState | `components/ui/empty-state.tsx` | 70 | server | `empty-state.test.tsx` |
| Skeleton | `components/ui/skeleton.tsx` | 55 | server | `skeleton.test.tsx` |
| ListRow / SplitRow | `components/ui/list-row.tsx` | 90 | server | `list-row.test.tsx` |
| Banner | `components/ui/banner.tsx` | 80 | server | `banner.test.tsx` |
| CoverArt | `components/ui/cover-art.tsx` | 130 | server | `cover-art.test.tsx` |
| ThemeToggle | `components/ui/theme-toggle.tsx` | 90 | **client** | `theme-toggle.test.tsx` |
| NavItem | `components/ui/nav-item.tsx` | 55 | **client** | `nav-item.test.tsx` |
| Drawer | `components/ui/drawer.tsx` | 110 | **client** | `drawer.test.tsx` |
| AccessCta | `components/ui/access-cta.tsx` | 45 | server | `access-cta.test.tsx` |
| QueryPreservingLink | `components/ui/query-preserving-link.tsx` | 45 | **client** | `query-preserving-link.test.tsx` |

**Server by default.** `use-client.md`: *"You only need to add it to the files whose components you want to render directly within Server Components"* and *"the props of the Client Components must be serializable."* Any component that a server page passes a render callback to must therefore stay a Server Component. Only the five client components above carry the directive.

### 2.6 Removing inline styles

Rule: `style={{}}` is banned in every file a redesign package owns, with exactly one exception — **setting a CSS custom property whose value is genuinely dynamic**:

```tsx
// allowed
<div className="cd-meter-bar" style={{ ['--cd-meter-fill' as string]: `${pct}%` }} />
// banned
<div style={{ marginTop: 18, color: 'var(--text-soft)' }} />
```

Enforced by `tests/no-inline-styles.test.ts` (WP-27): scans the owned file list, flags any `style={{` whose body does not contain `'--cd-`. Chosen over `react/forbid-dom-props` because that rule cannot allow the CSS-variable case. ~440 inline style props across the in-scope surface disappear this way; the ~12 legitimate dynamic ones survive as custom properties.

### 2.7 Clerk theming

`lib/clerk-appearance.ts` is rewritten to **derive from `lib/design-tokens.ts`** and to export three objects:

```ts
export const darkClerkAppearance   // ClerkProvider default + all auth pages
export const lightClerkAppearance  // UserButton when the dashboard is in light mode
export const authClerkAppearance   // dark + the flush/social-buttons options (name kept; auth pages import it)
```

Constraints discovered while reading:
- Clerk v7 derives shades from `colorPrimary`, so it must receive a **literal hex**, never `var(--cd-accent)`. Import the hex from `design-tokens.ts`.
- `fontFamily` becomes `'var(--cd-font-body), "Helvetica Neue", Arial, sans-serif'` — the **body** face (Schibsted Grotesk), because Clerk renders labels, inputs and helper text; the expanded display face belongs on the page headline beside the form, never inside it. A CSS variable is safe here because Clerk passes `fontFamily` through untouched.
- `elements` keeps Tailwind arbitrary-value strings; swap the hard-coded hexes for the new palette's literals. Keep `min-h-12`, `rounded-full` etc.
- `<ClerkProvider appearance={darkClerkAppearance}>` in the root layout. The dashboard's `UserButton` receives `appearance={theme === 'light' ? lightClerkAppearance : darkClerkAppearance}` from `DashboardNavShell`, which gets the resolved theme as a prop from the brand layout.
- **Stripe too:** `ApplicationActions.tsx` mounts `<Elements>`; pass `options.appearance = { theme: 'night', variables: { colorPrimary: tokens.dark.accentFill, … } }` from the same token module. Missing this leaves a white payment iframe in a dark card.

### 2.8 Fonts

Two faces, decided in `01-design-brief.md` §3 and verified against the installed `next/font/google` typings (`Archivo` accepts `axes: ['wdth']`; `Schibsted_Grotesk` is `wght` 400–900):

```ts
// app/fonts.ts (new, ~40 LOC) — the single place fonts are declared
import { Archivo, Schibsted_Grotesk } from 'next/font/google'

export const display = Archivo({ subsets: ['latin'], axes: ['wdth'], display: 'swap', variable: '--cd-font-display', fallback: ['Helvetica Neue', 'Arial', 'sans-serif'] })
export const body = Schibsted_Grotesk({ subsets: ['latin'], display: 'swap', variable: '--cd-font-body', fallback: ['Helvetica Neue', 'Arial', 'sans-serif'] })
export const fontClassNames = `${display.variable} ${body.variable}`
```

`app/layout.tsx` does `<html lang="en" className={fontClassNames}>` per `01-getting-started/13-fonts.md`, and `base.css` sets `font-family: var(--cd-font-body), …` on `.cd-app`. Delete the `style={{ fontFamily: … }}` from `<body>`. Width and weight are always declared together (`font-variation-settings: 'wdth' 118, 'wght' 700`). The old `--font-display` variable and `Plus_Jakarta_Sans` import go; nothing reads them. **OG images need static files regardless** (§2.9): commit `assets/fonts/archivo-expanded-700.ttf` and `assets/fonts/archivo-condensed-600.ttf`, subsetted to Latin.

### 2.9 `app/icon.tsx` and the three `opengraph-image.tsx`

All four are `ImageResponse` (Satori). Facts that constrain the redesign:

- Satori **does not resolve CSS custom properties**. Every colour must be a literal — import from `lib/design-tokens.ts`.
- Satori requires `display: flex` on any element with more than one child (this is why the current files set it everywhere). Keep that discipline.
- `opengraph-image.md` §"Config exports": export `alt`, `size`, `contentType`. **Add the missing `alt` export** to all three OG files — currently none of them has it, so `<meta property="og:image:alt">` is only emitted from the manual `openGraph.images[].alt` in `layout.tsx`/`waitlist/page.tsx`.
- Fonts: `opengraph-image.md` loads them with `fs.readFile(path.join(process.cwd(), 'assets/…'))`. `next/font` output is not reachable from `ImageResponse`. So either commit a `.ttf` under `assets/fonts/` and load it, or keep a system stack. **Recommend committing one weight of the display face** (~40–120 KB) — an OG card in Arial while the site uses a distinct face is exactly the "looks AI-generated" tell we are eliminating.
- Size limits are enforced at build: OG ≤ 8 MB, Twitter ≤ 5 MB, *"If the image file size exceeds these limits, the build will fail."*
- `app/waitlist/opengraph-image.tsx` should stop re-exporting the root card and get its own creator-waitlist card (the root card is brand-first; a creator arriving from a shared waitlist link should not see "hire creators").
- Next 16 gotcha, see §6: the image function's `params`/`id` are now Promises. None of ours takes them — **do not add a synchronous `params` argument**.

### 2.10 Cover-art port

```
lib/cover-art/palettes.ts     ~40  COVER_ART_PALETTES, PATTERNS
lib/cover-art/hash.ts         ~30  FNV-1a + fraction()
lib/cover-art/spec.ts         ~55  coverArtSpec(id, niche) — byte-identical logic
lib/cover-art/index.ts        ~10
lib/cover-art/spec.test.ts    ~90  behaviour: determinism, palette-by-niche, pattern-by-id, decor bounds
lib/cover-art/parity.test.ts  ~60  THE contract with mobile
components/ui/cover-art.tsx   ~130 inline <svg>, Server Component
components/ui/cover-art.test.tsx ~80
```

`parity.test.ts` imports mobile's implementation **directly by relative path** — `mobile/src/lib/cover-art.ts` has zero imports, so this is safe:

```ts
import { coverArtSpec as webSpec } from './spec'
import { coverArtSpec as mobileSpec } from '../../mobile/src/lib/cover-art'
// 200 generated (id, niche) pairs — every palette, every pattern, both niche-present and absent
for (const [id, niche] of CASES) expect(webSpec(id, niche)).toEqual(mobileSpec(id, niche))
```

Risk: `tsconfig.json` has `"exclude": ["node_modules","mobile","packages"]`, but `exclude` only filters the initial file glob — an imported file is still pulled into the program and typechecked with the **web** compiler options (`target: ES2017`, `strict`). `cover-art.ts` uses only `Math.imul` / `charCodeAt` / `>>> 0`, all ES2017-safe. **If `npm run typecheck` regresses, fall back** to a committed golden fixture (`lib/cover-art/__fixtures__/mobile-spec.json`, generated once by running mobile's function) and diff against that instead — the contract survives, only its liveness is reduced.

Rendering: inline SVG (`<linearGradient>` + `<circle>` / `<rect>` / stroked rings), `preserveAspectRatio="none"`, `aria-hidden`, deterministic gradient `id`s derived from the seed (**not** `useId`, which would differ across server/client and break hydration). Server Component so campaign lists stay RSC.

### 2.11 Flag-aware CTAs

```
lib/access-cta.ts       ~45  getAccessCta(slot): { href, label, mode }
lib/access-cta.test.ts  ~90  8 cases: 4 slots × 2 modes, plus unset/garbage → invite
components/ui/access-cta.tsx            server: resolves href, delegates to…
components/ui/query-preserving-link.tsx client: appends current search params
```

`getAccessCta()` reads `getMarketplaceAccess()` from `lib/admin-config.ts` — server-only, `MARKETPLACE_ACCESS` is deliberately **not** `NEXT_PUBLIC_`, so the resolution cannot happen in a client component. The existing `PublicWaitlistLink` (client, `useSearchParams` + `Suspense`) is refactored into the generic `QueryPreservingLink`; `AccessCta` computes the base path on the server and hands it down.

The signature is **slot-keyed** — `getAccessCta(slot: 'nav' | 'hero' | 'closing' | 'secondary')` — and the eight label strings are frozen here (they are the design brief's §8 table):

| slot | `invite` | `open` |
|---|---|---|
| `nav` | `Request access` → `/waitlist` | `Get started` → `/sign-up` |
| `hero` | `Request access` → `/waitlist` | `Create your brand account` → `/sign-up` |
| `closing` | `Request access` → `/waitlist` | `Post your first brief` → `/sign-up` |
| `secondary` (404 etc.) | `Request access` → `/waitlist` | `Create your brand account` → `/sign-up` |

Unset or garbage `MARKETPLACE_ACCESS` resolves to `invite` inside `getMarketplaceAccess()`; `getAccessCta` never re-parses the env.

⚠️ **Operational gotcha to document in the runbook:** marketing pages are statically prerendered, so `process.env.MARKETPLACE_ACCESS` is **baked at build time**. Flipping the env var on Vercel will not change the CTAs until a redeploy. That is acceptable (flipping the flag is already a deliberate act coupled to the Stripe go-live), but it must be written down, because the alternative — forcing those pages dynamic — costs the whole marketing site its static rendering.

---

## 3. Work packages

Conventions for every package: conventional-commit message; ≤ 800 LOC per file, 200–400 typical; functions < 50 lines; no mutation; no hard-coded colours/sizes outside `lib/design-tokens.ts`; **test written before implementation**; the package is not done until `npm run typecheck && npm run lint && npm run test` all pass from the worktree root.

**Verification command for every package (unless stated otherwise):**
```
npm run typecheck && npm run lint && npm run test
```
Wave 3+ additionally: `npx next build` (catches Satori errors, RSC boundary violations, and production CSS-order problems that dev hides).

---

### Wave 1 — Foundation

#### WP-01 · Design tokens + contrast contract · **M (~500 LOC)**
**Goal.** One source of truth for every colour, type step, space step and radius on web; proven WCAG-safe by an executable contract, exactly as mobile does it.
**Owns (create):** `lib/design-tokens.ts`, `lib/design-tokens.contrast.test.ts`, `lib/design-tokens.css.test.ts`, `app/styles/tokens.css`
**Read-only:** `mobile/src/constants/theme.ts`, `mobile/src/constants/theme.contrast.test.ts`, `app/globals.css`
**Inputs:** none (first package).
**Outputs:** `Tokens.dark`, `Tokens.light`, `Brand`, `Type`, `Space`, `Radius`, `Shadow` exports; the `--cd-*` variable set from §2.1.
**Acceptance:**
- `Tokens.dark` / `Tokens.light` colour values are byte-identical to `Colors.dark` / `Colors.light` for the 20 shared semantic names — **proven executably**: `scripts/extract-mobile-colors.mjs` regex-extracts the `Colors` object literal from `mobile/src/constants/theme.ts` (no import — that file pulls in `react-native`) into `lib/__fixtures__/mobile-colors.json`, committed; `lib/design-tokens.parity.test.ts` asserts equality. Record the mobile SHA the fixture was cut from in the fixture file's header; regenerate only when that file changes.
- The three web-only tokens (`bgRaised`, `textFaint`, `artScrim`) and the two alpha divergences (`accentSoft` 0.10 dark / 0.06 light) are exactly the values in `01-design-brief.md` §2, each with its ratio asserted.
- `tokens.css` defines all three theme states per §2.2, including `color-scheme`.
- `design-tokens.css.test.ts` parses `tokens.css` and fails if any TS token is missing from CSS or disagrees with it.
- Contrast test ports all five mobile tables (text-on-surface, text-on-soft-fill, non-text-on-soft-fill, text-on-opaque-fill, border-strength) **plus** the coverage guards, and adds `--cd-bg-raised` to `SURFACES`.
- Zero `!important`, zero `#hex` outside this package's two files.
**Tests:** `lib/design-tokens.contrast.test.ts`, `lib/design-tokens.css.test.ts` (both `.ts` → run under the existing node project, so this package does not wait on WP-02).
**Wave:** 1

#### WP-02 · Test infrastructure (jsdom project + coverage) · **S (~120 LOC + lockfile)**
**Goal.** Component tests can run without disturbing the 26 existing node-env test files.
**Owns:** `vitest.config.ts`, `tests/setup-ui.ts`, `package.json` (devDependencies only), `package-lock.json`
**Read-only:** `tsconfig.json`, `node_modules/next/dist/docs/01-app/02-guides/testing/vitest.md`
**Inputs:** none.
**Outputs:** two vitest projects (`node`, `ui`); `npm run test` runs both; `npm run test:coverage` exists.
**Adds devDeps (all declared in `marketplace/package.json`, none relied on by hoisting):** `@vitejs/plugin-react`, `@testing-library/react` (**absent today** — only `dom`, `jest-dom`, `user-event` and `react-native` exist under `node_modules/@testing-library`, hoisted from the mobile workspace), `@testing-library/dom`, `@testing-library/jest-dom`, `@testing-library/user-event`, `@vitest/coverage-v8`, and a **direct** `jsdom@^26` (the hoisted `jsdom@20.0.3` comes from Expo's tree and must not be relied on).
**Acceptance:**
- `test.projects`: `node` keeps `environment:'node'` and the existing include globs verbatim; `ui` adds `environment:'jsdom'`, `plugins:[tsconfigPaths(), react()]`, `include:['components/**/*.test.tsx','app/**/*.test.tsx','lib/**/*.test.tsx']`, `setupFiles:['tests/setup-ui.ts']`.
- `tests/setup-ui.ts` imports `@testing-library/jest-dom/vitest` and registers `afterEach(cleanup)`.
- All 26 pre-existing tests still pass, unchanged.
- `npm ci --dry-run` succeeds (CI's `npm ci` must not desync).
- **`package.json` `next` version is left exactly as found** — the other session is mid-bump.
**Tests:** `tests/vitest-projects.test.ts` — a meta-test asserting both projects are configured and that the node project's include list still covers `lib/**/*.test.ts`.
**Wave:** 1

#### WP-03 · Frozen-surface contract guard + design gate · **S (~250 LOC)**
**Goal.** Make it mechanically impossible for any later package to break creator/admin or to ship a template tell, before any of them run.
**Owns (create):** `tests/legacy-css-contract.test.ts`, `scripts/frozen-classes.sh`, `scripts/frozen-classes.sha256`, `scripts/design-gate.sh`, `scripts/wave-gate.sh`
**Does NOT touch:** `app/globals.css` (frozen until WP-26), anything under `app/(dashboard)/creator/` or `app/internal/`.
**Read-only:** every file under `app/(dashboard)/creator/`, `app/internal/`, `app/globals.css`, `03-risk-verification.md` §2.3.
**Acceptance:**
- `legacy-css-contract.test.ts` extracts every `className` token from `app/(dashboard)/creator/**` + `app/internal/**` (including template-literal classes such as `apple-nav`), asserts each one that matches a `globals.css` selector is still defined, and snapshots the list so WP-26 can only shrink it.
- `frozen-classes.sh` hashes the declaration block of every shared class (re-measured in the worktree — the earlier census of 50 was taken on a dirty tree) into `frozen-classes.sha256`; re-running it must print no diff.
- `design-gate.sh` implements `03-risk-verification.md` §2.3(a) over an explicit **allowlist of redesign-owned paths** (never `globals.css`, creator or internal), with per-rule baseline counts and a `--ratchet` mode that fails only when a count rises.
- `wave-gate.sh` runs, in order: `node -v`, the four gates (`npm run typecheck && npm run lint && npm run test && npm run test --workspace=packages/shared`), `git status --short`, the empty-diff check for creator/internal, the iCloud `* 2.*` sweep, `frozen-classes.sh --check`, `design-gate.sh --ratchet`.
**Tests:** `tests/legacy-css-contract.test.ts`; a deliberately failing run of `design-gate.sh` (add a `backdrop-filter` to a scratch file, show red, delete it) pasted in the package report.
**Wave:** 1

#### WP-04 · Fonts, root layout, theme plumbing · **M (~350 LOC)**
**Goal.** The app boots on the new type + the new canvas, with a flash-free three-state theme.
**Owns:** `app/fonts.ts` *(new)*, `app/layout.tsx`, `app/styles/index.css` *(new)*, `app/styles/base.css` *(new)*, `lib/theme.ts` *(new)*, `lib/theme.test.ts` *(new)*, `assets/fonts/**` *(new, if local faces are chosen)*
**Read-only:** `lib/design-tokens.ts` (WP-01), `mobile/src/constants/theme.ts`, `node_modules/next/dist/docs/01-app/01-getting-started/13-fonts.md`, `.../11-css.md`
**Inputs:** the token names from §2.1 (fixed in this plan, so WP-04 does **not** wait for WP-01 to finish).
**Outputs:** `fontClassNames`, `THEME_COOKIE`, `parseThemePreference`, `themeAttribute`, `.cd-app`.
**Acceptance:**
- Root layout imports **exactly one** stylesheet (`./styles/index.css`); `index.css` `@import`s in order: `tailwindcss`, `../globals.css`, `tokens.css`, `base.css` — **nothing else, ever** (components import their own sheets).
- `<html>` carries `fontClassNames` and no `data-theme`; the `style={{fontFamily}}` prop is gone from `<body>`.
- Fonts are Archivo (`--cd-font-display`, `axes: ['wdth']`) and Schibsted Grotesk (`--cd-font-body`) per §2.8; `Plus_Jakarta_Sans` and `--font-display` are removed.
- `parseThemePreference` fails closed to `'dark'` for unset/garbage, mirroring `creator-web-mode.ts`'s house style; every branch covered.
- `base.css` sets `html:has(.cd-app)` / `body:has(.cd-app)` / `.cd-app` per §2.4(c), the type scale classes from `01-design-brief.md` §3, a visible `:focus-visible` ring from `--cd-focus`, and `@media (prefers-reduced-motion: reduce)` neutralising every `cd-` animation and the legacy `scroll-behavior: smooth`.
- Existing `metadata` object is preserved verbatim apart from OG image alt text.
**Tests:** `lib/theme.test.ts` (table-driven over all inputs × all three outputs).
**Wave:** 1

#### WP-05 · Cover-art port · **M (~500 LOC)**
**Goal.** A campaign renders the same artwork on web as in the iOS app.
**Owns:** `lib/cover-art/**` (5 files + 2 tests), `components/ui/cover-art.tsx`, `components/ui/cover-art.css`, `components/ui/cover-art.test.tsx`
**Read-only:** `mobile/src/lib/cover-art.ts`, `mobile/src/components/cover-art.tsx`, `mobile/src/lib/cover-art.test.ts`
**Inputs:** none (palettes are self-contained).
**Outputs:** `coverArtSpec`, `COVER_ART_PALETTES`, `<CoverArt seed niche imageUrl height>`.
**Acceptance:**
- `parity.test.ts` proves `webSpec(id,niche) === mobileSpec(id,niche)` over ≥ 200 cases covering all 8 palettes and all 4 patterns; **or**, if the mobile import breaks `typecheck`, the golden-fixture fallback with the failure documented in the package's commit body.
- Component is a Server Component (no `'use client'`), renders inline `<svg>`, `aria-hidden="true"`, and gradient ids derived from the seed (never `useId`).
- `imageUrl` wins when present (future backend field), mirroring mobile.
- Renders identically in dark and light (the palettes are surface-independent).
**Tests:** `lib/cover-art/spec.test.ts`, `lib/cover-art/parity.test.ts`, `components/ui/cover-art.test.tsx`
**Wave:** 1

#### WP-06 · Flag-aware access CTA · **S (~200 LOC)**
**Goal.** Every "Request access" CTA becomes correct in both `invite` and `open` mode without a code change.
**Owns:** `lib/access-cta.ts`, `lib/access-cta.test.ts`, `components/ui/access-cta.tsx`, `components/ui/query-preserving-link.tsx`, their `.test.tsx` files
**Read-only:** `lib/admin-config.ts`, `app/PublicWaitlistLink.tsx`
**Inputs:** none.
**Outputs:** `getAccessCta()`, `<AccessCta>`, `<QueryPreservingLink>`.
**Acceptance:**
- `getAccessCta()` reads `getMarketplaceAccess()` — it must **not** re-parse `process.env` itself, so the fail-closed logic stays in one place.
- Signature is `getAccessCta(slot)` with the four slots and eight strings frozen in §2.11; one test case per slot per mode (8) plus unset and garbage (→ `invite`).
- `<QueryPreservingLink>` is wrapped in `Suspense` with a no-query fallback (same shape as today's `PublicWaitlistLink`), and preserves UTM params.
- `data-public-waitlist-link` attribute is preserved (analytics may key off it — verify with the owner if it is removed).
- **Does not delete** `app/PublicWaitlistLink.tsx` — that file is owned by WP-13.
**Tests:** `lib/access-cta.test.ts`, `components/ui/access-cta.test.tsx`, `components/ui/query-preserving-link.test.tsx`
**Wave:** 1

---

### Wave 2 — Component library + public chrome

#### WP-07 · Primitives: Button, IconButton, Pill, StatusPill · **M (~450 LOC)**
**Owns:** `components/ui/button.tsx|.css|.test.tsx`, `icon-button.*`, `pill.tsx|.css|.test.tsx`
**Depends on:** WP-01 (tokens), WP-02 (jsdom project), WP-04 (`index.css` import chain)
**Outputs:** `<Button variant="primary|ghost|quiet|danger" size="sm|md|lg">`, `<IconButton>`, `<Pill>`, `<StatusPill status>`.
**Acceptance:** `StatusPill` maps every status the brand pages render (`DRAFT/ACTIVE/CLOSED`, `PENDING/ACCEPTED/REJECTED`, `SUBMITTED/APPROVED/REVISION/DECLINED`, `PAID`) to a semantic token pair — mirror `mobile/src/lib/status-presentation.ts` naming; unknown status falls back to `--cd-text-secondary` on `--cd-bg-selected`, the pairing the mobile contrast test explicitly rates. Buttons render as `<button>` or, with `href`, as `next/link` — never a `<div role="button">`. Disabled state has a non-colour affordance. Focus ring visible in both themes.
**Tests:** one file per component, ≥ 4 cases each (render, variant class, disabled/aria, link-vs-button).
**Wave:** 2

#### WP-08 · Surfaces: Surface, Section, PageHeader, SectionHeader, Banner, EmptyState, Skeleton, ListRow · **L (~700 LOC)**
**Owns:** `components/ui/{surface,section,page-header,section-header,banner,empty-state,skeleton,list-row}.tsx|.css|.test.tsx`
**Depends on:** WP-01, WP-02, WP-04, WP-07 (PageHeader takes a `Button` action slot)
**Acceptance:** No `backdrop-filter` anywhere (anti-template mandate). `Skeleton` respects `prefers-reduced-motion`. `Banner` covers `info|success|warning|danger` from semantic tokens and renders `role="status"` / `role="alert"` appropriately. `EmptyState` takes an optional action node, no emoji. `ListRow` reproduces the existing first/last-child border behaviour without the current `> :first-child` selector hack.
**Wave:** 2

#### WP-09 · Forms: Field, Input, Textarea, Select, CheckboxChip · **M (~500 LOC)**
**Owns:** `components/ui/{field,input,textarea,select,checkbox-chip}.tsx|.css|.test.tsx`
**Depends on:** WP-01, WP-02, WP-04
**Acceptance:** Inputs use `--cd-border-strong` (the mobile file's rule: *if removing the line would leave the user unable to tell where to type, use `borderStrong`*), not `--cd-border`. Every field wires `id`/`htmlFor`/`aria-describedby` for error text; error state is not colour-only. `CheckboxChip` is a real `<input type="checkbox">` visually replaced — keyboard-operable, `:focus-visible` ring on the label. Native `<select>` gets an explicit `color-scheme` so the popup matches the theme.
**Tests:** include one `user-event` keyboard test per interactive component.
**Wave:** 2

#### WP-10 · Data display: MetricCard, Trend, MeterBar · **M (~350 LOC)**
**Owns:** `components/ui/{metric-card,trend,meter-bar}.tsx|.css|.test.tsx`
**Depends on:** WP-01, WP-02, WP-04, WP-07
**Acceptance:** `MeterBar` takes `value`/`max` and sets `--cd-meter-fill` — the single sanctioned inline-style case; it also renders `role="img"` with an `aria-label` carrying the number, because the current funnel/breakdown bars are invisible to assistive tech. `Trend` never signals direction by colour alone (arrow glyph + text). `MetricCard` handles the loading state via `Skeleton`.
**Wave:** 2

#### WP-11 · Chrome: ThemeToggle, NavItem, Drawer · **M (~350 LOC)**
**Owns:** `components/ui/{theme-toggle,nav-item,drawer}.tsx|.css|.test.tsx`
**Depends on:** WP-01, WP-02, WP-04 (`lib/theme.ts`), WP-07
**Acceptance:** `ThemeToggle` is a 3-way control (System / Light / Dark) as a `radiogroup`; writes the cookie, optimistically sets `data-theme` on `closest('.cd-app')`, then `router.refresh()`. Test asserts the cookie string (`Path=/; Max-Age=31536000; SameSite=Lax`) and that `router.refresh` is called. `Drawer` traps focus, closes on `Escape`, restores focus to the trigger, and marks the scrim `aria-hidden` (today's scrim is a `<button>` with an `aria-label`, which announces a phantom control). `NavItem` uses `usePathname` with the existing exact-vs-prefix matching rule.
**Wave:** 2

#### WP-13 · Public shell, nav, footer, brand mark, admin preview banner · **M (~550 LOC)**
**Owns:** `app/PublicPageShell.tsx`, `app/PublicWaitlistLink.tsx` *(delete or reduce to a re-export of `<AccessCta>`)*, `app/AdminPreviewBanner.tsx`, `app/PublicPageShell.test.tsx`, **`components/ui/brand-mark.tsx` + `.css` + `.test.tsx`** *(new — the mark as inline SVG with no font dependency, per the owner's artboard-6 choice; the legacy `.brand-mark` class in `globals.css` stays untouched and alive for creator/internal)*
**Depends on:** WP-01, WP-04, WP-06 (`<AccessCta>`), WP-07, WP-08
**Outputs — the shell contract, frozen here so waves 3 can run in parallel:**
```tsx
<PublicPageShell variant?: 'content' | 'form' | 'bare'
                 eyebrow?: string title?: string description?: string
                 children>
```
**Acceptance:** Wrapper is `<div className="cd-app" data-theme="dark">`. **No pill nav** — the floating rounded-999px sticky bar is the single most template-coded element on the site and must not survive. Nav CTA is `<AccessCta>`. Footer keeps every current link (`/get-the-app`, `/privacy`, `/terms`, `/support`, `/sign-in`). `AdminPreviewBanner` keeps its `Suspense` + `?preview=admin` behaviour exactly.
**Wave:** 2

---

### Wave 3 — Marketing + auth

#### WP-12 · Clerk + Stripe appearance · **S (~250 LOC)**
**Owns:** `lib/clerk-appearance.ts`, `lib/clerk-appearance.test.ts`, `lib/stripe-appearance.ts` *(new)*, `lib/stripe-appearance.test.ts`
**Depends on:** WP-01
**Acceptance:** Three Clerk objects per §2.7; every colour traced to `lib/design-tokens.ts` (test: no `#` literal in the file); `authClerkAppearance` keeps its exported name and its `options` block (`elevation: 'flush'`, `socialButtonsPlacement`, `privacyPageUrl`/`termsPageUrl`/`helpPageUrl`) unchanged. `fontFamily` becomes `'var(--cd-font-body), "Helvetica Neue", Arial, sans-serif'` (the body face; see §2.7). `variables.colorPrimary` and friends are literal hex imported from `lib/design-tokens.ts`. Stripe `Elements` appearance exported for WP-22.
**Wave:** 3

#### WP-14 · Landing page · **L (~600 LOC, likely split across 2–3 section files)**
**Owns:** `app/page.tsx`, `app/(marketing)/_sections/**` *(new dir for hero/steps/differences/faq/cta sections, ≤ 250 LOC each)*, `app/page.test.tsx`
**Depends on:** WP-06, WP-07, WP-08, WP-13
**Acceptance:** The existing content arrays survive; the chrome does not — **zero** `hero-orb`, `glass-card`, `bento-grid`, `backdrop-filter`, `01/02/03` step numerals, and no hero card that restates the headline copy. The three money facts (authorize on accept / capture on approve / 15% out of the rate, never on top) remain above the fold. Every CTA is `<AccessCta>`. `app/page.tsx` itself ≤ 120 LOC (composition only). Renders correctly at 1440 and 390.
**Tests:** `app/page.test.tsx` — asserts the h1, the three money facts, and that the CTA href follows the flag in both modes.
**Wave:** 3

#### WP-15 · `/get-the-app` · **M (~400 LOC)**
**Owns:** `app/get-the-app/page.tsx`, `app/get-the-app/_sections/**`, `app/get-the-app/page.test.tsx`
**Depends on:** WP-06, WP-07, WP-08, WP-13
**Acceptance:** `metadata.itunes` gating on `NEXT_PUBLIC_IOS_APP_ID` preserved exactly (a placeholder id renders a broken smart banner — the existing comment explains why). `isAppLive` copy branches preserved. Creator-facing but visually one identity with the brand site.
**Wave:** 3

#### WP-16 · Waitlist page + form · **L (~700 LOC, form split into ≥ 3 files)** ⚠ other-session overlap
**Owns:** `app/waitlist/page.tsx`, `app/waitlist/WaitlistForm.tsx`, `app/waitlist/_form/**` *(new: fields, success panel, turnstile panel)*, `app/waitlist/WaitlistForm.test.tsx`
**Depends on:** WP-08, WP-09, WP-13
**Scheduling:** the other session has this file modified. **Must be scheduled after the clean commit**, and the agent must `git log -1 -- app/waitlist/WaitlistForm.tsx` and read the current file before writing anything.
**Acceptance:** The 490-line client component is split so no file exceeds 400 LOC. **The submit payload, endpoint, Turnstile mount/reset, referral-code handling and `track()` calls are byte-identical to what is on disk after the clean commit.** All 10 `waitlist-*` legacy classes replaced. Success state, error state and the referral-link preview all reachable in the test.
**Wave:** 3

#### WP-17 · Legal, support, 404 · **S (~250 LOC)**
**Owns:** `app/privacy/page.tsx`, `app/terms/page.tsx`, `app/support/page.tsx`, `app/not-found.tsx`, `app/not-found.test.tsx`
**Depends on:** WP-07, WP-08, WP-13
**Acceptance:** **Legal copy is not edited — one character changed is a legal review.** These pages become prose-layout showcases: measure ≤ 68ch, real heading hierarchy. `not-found.tsx` renders outside `PublicPageShell` (root-level) and must therefore carry its own `.cd-app data-theme="dark"` wrapper.
**Wave:** 3

#### WP-18 · Auth pages + onboarding + sso-callback · **M (~500 LOC)** ⚠ other-session overlap
**Owns:** `app/(auth)/sign-in/[[...sign-in]]/page.tsx`, `app/(auth)/sign-up/[[...sign-up]]/page.tsx`, `app/sso-callback/[[...sso-callback]]/page.tsx`, `app/onboarding/page.tsx`, `app/onboarding/_role-picker.tsx` *(new)*, tests
**Depends on:** WP-07, WP-08, WP-09, WP-12
**Scheduling:** both auth pages are modified by the other session. After the clean commit only; re-read before writing.
**Acceptance:** `oauthFlow="redirect"`, `forceRedirectUrl`/`fallbackRedirectUrl="/post-login"`, `signUpUrl`/`signInUrl` all preserved. The sign-up page's doc comment about `MARKETPLACE_ACCESS` is preserved. `sso-callback` gains a themed centred spinner (currently renders literally nothing). Onboarding's role picker is extracted; its `/api/users/me` fetch, `AbortController` and redirect logic are unchanged. All four wrapped in `.cd-app data-theme="dark"`. **`app/post-login/page.tsx` is not touched** — it must stay redirect-only.
**Wave:** 3

---

### Wave 4 — Brand dashboard

#### WP-19 · Brand dashboard shell (forked) + theme stamp · **M (~500 LOC)**
**Owns (create):** `components/brand/brand-nav-shell.tsx` + `.css` + `.test.tsx`, `components/brand/admin-view-banner.tsx` + `.test.tsx`, `components/brand/change-role-control.tsx` + `.test.tsx`
**Owns (modify):** `app/(dashboard)/brand/layout.tsx`
**Does NOT touch:** `app/DashboardNavShell.tsx`, `app/(dashboard)/AdminViewBanner.tsx`, `app/(dashboard)/ChangeRoleControl.tsx` — all three are rendered by the frozen creator pages and stay **byte-identical**. The brand journey gets forks, not restyles.
**Depends on:** WP-04 (`lib/theme.ts`), WP-07, WP-08, WP-11, WP-12
**Outputs — the shell contract, frozen here:**
```tsx
<BrandNavShell homeHref homeLabel userName userLabel navItems theme={ThemePreference} />
```
**Acceptance:**
- Brand layout reads `cd-theme` via `await cookies()` and renders `<div className="cd-app" data-theme={themeAttribute(pref)}>`; when the preference is `'system'` **no attribute is emitted**. A test asserts all three cases.
- `BrandNavShell` is the design brief's §4 sidebar: 264px, no radius, no shadow, the 2px coral active bar, no "System feel" panel, `UserButton` with the matching Clerk appearance, `ThemeToggle` in the footer, the drawer below 1024px.
- `components/brand/admin-view-banner.tsx` and `change-role-control.tsx` keep the exact props and API calls of the shared originals (the role PATCH to `/api/users/role` is unchanged).
- `git diff --stat -- app/DashboardNavShell.tsx 'app/(dashboard)/AdminViewBanner.tsx' 'app/(dashboard)/ChangeRoleControl.tsx'` is empty.
**Wave:** 4

> **WP-20 … WP-24** import `AdminViewBanner` and `ChangeRoleControl` from `components/brand/`, never from `app/(dashboard)/`. The shared originals remain for creator pages only.

#### WP-20 · Brand home · **M (~450 LOC)**
**Owns:** `app/(dashboard)/brand/page.tsx`, `app/(dashboard)/brand/_home/**` *(new section files)*, test
**Depends on:** WP-08, WP-10, WP-19
**Acceptance:** All 25 inline styles gone; `shimmer` → `<Skeleton>`; `Suspense` boundaries preserved; the `resolveDashboardViewer` / `readOnly` gating on every mutation affordance preserved verbatim (admin view-as must stay read-only). Works with an empty database (no campaigns) — the empty state is the first thing a new brand sees.
**Wave:** 4

#### WP-21 · Metrics · **L (~700 LOC)**
**Owns:** `app/(dashboard)/brand/metrics/{page,BrandMetricsView,AttentionList,BreakdownList,FunnelBars}.tsx` + new split files + tests
**Depends on:** WP-08, WP-10, WP-19
**Acceptance:** `BrandMetricsView` (301 LOC / 39 inline styles) is split so no file exceeds 400 LOC. Every `admin-*` class dependency is removed — a brand page must not depend on classes named for internal admin. Funnel and breakdown bars become `<MeterBar>` with accessible labels. `lib/brand-metrics.ts` is **not** touched.
**Wave:** 4

#### WP-22 · Campaigns: detail, edit, new · **L (~800 LOC)**
**Owns:** `app/(dashboard)/brand/campaigns/[id]/page.tsx`, `.../ApplicationActions.tsx`, `.../CampaignEditControls.tsx`, `app/(dashboard)/brand/campaigns/new/page.tsx`, `.../NewCampaignForm.tsx` + new split files + tests
**Depends on:** WP-05 (CoverArt), WP-08, WP-09, WP-12 (Stripe appearance), WP-19
**Acceptance:** `ApplicationActions` receives `options.appearance` from `lib/stripe-appearance.ts` so the `PaymentElement` is dark — verify visually, it is the most expensive thing to get wrong. **The authorize/capture flow, the endpoints it calls, and the rate arithmetic are untouched.** `NewCampaignForm`'s platform/deliverable pickers become `<CheckboxChip>`. `CoverArt` is introduced on the campaign detail header, seeded by `campaign.id` + niche. The `<img>` creator avatars either move to `next/image` or keep an explicit `eslint-disable` with a reason — no new lint warnings.
**Wave:** 4

#### WP-23 · Applications + submissions lists · **M (~500 LOC)** ⚠ other-session overlap
**Owns:** `app/(dashboard)/brand/applications/page.tsx`, `app/(dashboard)/brand/submissions/page.tsx`, `app/(dashboard)/brand/campaigns/[id]/applications/page.tsx`, `.../SubmissionReview.tsx` + tests
**Depends on:** WP-05, WP-08, WP-09, WP-19
**Scheduling:** two of these files are modified by the other session. After the clean commit only.
**Acceptance:** **`isAllowedContentUrl(...)` (imported from `@creatordocks/shared` — `lib/content-url.ts` no longer exists) must still gate every `href` that renders a stored `contentUrl`, on every render site.** This is the `SEC-12`/`PUSH-05` fix; a test asserts a `javascript:` URL renders as inert text rather than a link. `CoverArt` used for campaign thumbnails in list rows.
**Wave:** 4

#### WP-24 · Settings + appearance · **S (~250 LOC)**
**Owns:** `app/(dashboard)/brand/settings/page.tsx` + test
**Depends on:** WP-08, WP-09, WP-11 (ThemeToggle), WP-19
**Acceptance:** Adds an "Appearance" section hosting `<ThemeToggle>`. `ChangeRoleControl` still renders and still works. 16 inline styles gone.
**Wave:** 4

---

### Wave 5 — Identity assets, cleanup, guards

#### WP-25 · Icon + OG images · **M (~350 LOC)**
**Owns:** `app/icon.tsx`, `app/opengraph-image.tsx`, `app/get-the-app/opengraph-image.tsx`, `app/waitlist/opengraph-image.tsx`, `app/_og/shared.tsx` *(new)*, `assets/fonts/og-display.ttf` *(new, if used)*, `app/_og/shared.test.tsx`
**Depends on:** WP-01, WP-04 (font files)
**Acceptance:** No pale-blue gradient anywhere. Colours imported from `lib/design-tokens.ts` as literals. Each of the three OG files exports `alt`, `size`, `contentType`. `waitlist/opengraph-image.tsx` becomes its own creator-facing card. `params`/`id` are **not** added as synchronous arguments (§6). `npx next build` succeeds — this is the gate that catches Satori errors, and it is mandatory for this package.
**Wave:** 5

#### WP-26 · Dead legacy CSS removal · **S (~-600 LOC)**
**Owns:** `app/globals.css`, `tests/legacy-css-contract.test.ts` *(snapshot update only)*
**Depends on:** every page package (WP-13 through WP-24) must be merged first.
**Acceptance:** Deletes only classes that `legacy-css-contract.test.ts` proves are used by neither `creator/*` nor `internal/*` nor any redesigned page. The contract test's snapshot may only *shrink*, never gain a class. The three legacy `@media` blocks are pruned in step with the rules they modify. `npx next build` + a visual pass over `/creator` and `/internal/waitlist` before merge.
**Wave:** 5

#### WP-27 · Discipline guards · **S (~200 LOC)**
**Owns:** `tests/no-inline-styles.test.ts`, `tests/no-hardcoded-colors.test.ts`, `eslint.config.mjs`
**Depends on:** all page packages.
**Acceptance:** `no-inline-styles` scans the redesign-owned file list and fails on any `style={{` not containing `--cd-`. `no-hardcoded-colors` fails on `#[0-9a-f]{3,8}` or `rgba?(` in `app/**/*.tsx` and `components/**/*.tsx`, allow-listing `lib/design-tokens.ts` and `app/_og/**`. eslint gains only a scoped `jsx-a11y` tightening for `components/ui/**` — no repo-wide rule changes (CI runs `npm run lint` on everything, including creator/internal).
**Wave:** 5

#### WP-28 · Design-system doc + coverage gate · **S (~250 LOC)**
**Owns:** `docs/design/web-design-system.md` *(new)*, `package.json` `test:coverage` script threshold
**Depends on:** all.
**Acceptance:** Documents the token table, the three theme states, the component list with prop signatures, the `cd-` naming rule, the legacy-coexistence rule, the flag-aware CTA behaviour and its build-time caveat, and the cover-art mobile contract. Coverage thresholds turned on for the scoped include list (§5).
**Wave:** 5

---

### 3.1 Wave plan

| Wave | Packages | Count | Gate before advancing |
|---|---|---|---|
| **0** | *(orchestrator)* source tree clean → cut `feat/web-redesign` → create worktree → install + `prisma generate` → baseline gates green → **WP-00 mockups → owner approval** | 1 | existing tests pass; `git status --short` empty in the source tree; canvas approved in writing |
| **1** | WP-01 tokens · WP-02 test infra · WP-03 legacy isolation · WP-04 fonts/layout/theme · WP-05 cover art · WP-06 access CTA | 6 | gates + `git status` + `npx next build` |
| **2** | WP-07 primitives · WP-08 surfaces · WP-09 forms · WP-10 data display · WP-11 chrome · WP-13 public shell | 6 | gates + `git status` + a screenshot of a scratch `/design-check` page (deleted before merge) |
| **3** | WP-12 Clerk/Stripe · WP-14 landing · WP-15 get-the-app · WP-16 waitlist · WP-17 legal/404 · WP-18 auth/onboarding | 6 | gates + `npx next build` + screenshots at 1440/390 of `/`, `/get-the-app`, `/waitlist`, `/sign-in`, `/onboarding` |
| **4** | WP-19 shell · WP-20 home · WP-21 metrics · WP-22 campaigns · WP-23 lists · WP-24 settings | 6 | gates + `npx next build` + screenshots of all six brand screens in **both** themes + `/creator` and `/internal/waitlist` regression check |
| **5** | WP-25 OG/icon · WP-26 dead CSS · WP-27 guards · WP-28 docs | 4 | gates + `npx next build` + full screenshot sweep |

**File-collision audit (re-run after the fixes):** `app/globals.css` is touched by WP-26 only (wave 5, alone). `package.json` by WP-02 (wave 1) and WP-28 (wave 5). `app/styles/index.css` by WP-04 only — component packages import their own sheets. The three shared dashboard components are touched by nobody. No two packages in the same wave share a file. **The orchestrator re-runs this audit over the final owned-file lists before dispatching each wave.**

**Other-session-overlap packages** (WP-03, WP-16, WP-18, WP-23) are all in wave 1 or later, i.e. all after the clean commit. Each carries the standing instruction: *re-read the file on disk before editing; the contents may differ from this plan's inventory.*

---

## 4. Worktree runbook

### 4.1 Pre-flight (orchestrator, in the source tree)

```bash
cd /Users/jsteele/Desktop/CreatorDocks/marketplace
git status --short                    # only docs/untracked non-source files — the other sessions committed on 2026-09-08 (tip 126e86b)
git rev-parse HEAD                    # record the clean commit sha
npm run typecheck && npm run lint && npm run test   # baseline: all green before we start
npm ci --dry-run                      # confirms package.json (next 16.3.4) and the lockfile agree
```

If `git status --short` is not empty, **stop**. Every package's acceptance criteria assume a clean base.

### 4.2 Create the worktree

```bash
cd /Users/jsteele/Desktop/CreatorDocks/marketplace
git worktree add -b feat/web-redesign ../marketplace-redesign HEAD
```

### 4.3 Secrets (never committed)

```bash
cp .env.local        ../marketplace-redesign/.env.local
cp .env              ../marketplace-redesign/.env          # prisma CLI reads .env, not .env.local
cd ../marketplace-redesign
grep -q '^\.env' .gitignore && echo "env ignored OK" || echo "STOP: .env not gitignored"
```

Never `git add -f` an env file. Never print its contents. `.env.production.local` is **not** copied — no agent needs production credentials.

### 4.4 Install

`node_modules` is **2.0 GB** and includes the Expo/React-Native tree (`mobile/` and `packages/shared` are npm workspaces of this root package.json, so a plain `npm ci` installs all of it — 5–10 minutes).

Preferred (APFS clone, seconds):
```bash
cd /Users/jsteele/Desktop/CreatorDocks/marketplace
cp -Rc node_modules ../marketplace-redesign/ || cp -R node_modules ../marketplace-redesign/
```
`cp -R` (BSD) preserves symlinks, and the workspace link `node_modules/@creatordocks/shared → ../../packages/shared` is **relative**, so it resolves correctly inside the worktree. Verify:
```bash
cd ../marketplace-redesign
readlink node_modules/@creatordocks/shared   # must print ../../packages/shared
node -p "require('next/package.json').version"  # 16.3.4
```

Then:
```bash
npx prisma generate
npm run typecheck    # smoke test: if this passes, the copy is sound
```

Fallback if anything looks wrong: `npm ci` (safe, ~5–10 min). **After WP-02 lands** (it adds five devDependencies), run `npm install` once in the worktree; that rewrites the worktree's `package-lock.json`, which is exactly what WP-02 owns.

### 4.5 Dev server — **port 3100**, not 3000

Port 3000 is occupied by another session.
```bash
cd /Users/jsteele/Desktop/CreatorDocks/marketplace-redesign
npm run dev -- --port 3100      # Next 16: Turbopack is the default, no --turbopack flag
```

⚠️ **Clerk redirect URLs** are configured against an origin. If sign-in bounces on `:3100`, work on the marketing/dashboard pages while signed out and screenshot auth pages from their static render, or ask the owner to add `http://localhost:3100` to the Clerk dev instance — **do not** change any Clerk configuration yourself.

### 4.6 ⚠️ There is ONE database

`DATABASE_URL` in `.env.local` points at the **single production Neon instance**. There is no local or staging database. Consequences:

- Every brand dashboard page an agent loads locally reads **live production data**. Whatever campaigns, applications and submissions exist in production are what the redesigned pages will show — possibly none at all.
- **No agent may perform a write from the dev server.** Do not create a campaign, accept an application, approve a submission, submit the waitlist form, or change a role. Every one of those hits production, and two of them move real money through Stripe.
- Design for the **empty** state first. It is the most likely state and the first thing a new brand sees.
- If a signed-in ADMIN loads `/brand`, `resolveDashboardViewer` returns `readOnly: true` and renders the admin's own (empty) account — this is the *safe* browsing mode and the recommended way to screenshot the dashboard. Use `?viewAs=<userId>` only if the owner supplies an id.
- Component tests must never touch `lib/prisma`; test the presentational components, not the pages that query.

### 4.7 Gates (every package, every wave)

```bash
cd /Users/jsteele/Desktop/CreatorDocks/marketplace-redesign
npm run typecheck && npm run lint && npm run test && npm run test --workspace=packages/shared
npx next build                # waves 3–5, and any package touching ImageResponse or CSS order
git status --short            # orchestrator re-runs this after EVERY wave; do not trust agent summaries
```

Per `version-16.md` §"Removals → `next lint`": *"The `next lint` command has been removed… `next build` no longer runs linting."* `npm run lint` (eslint directly) is the **only** lint gate — a green build says nothing about lint.

### 4.8 Hand-off — the branch is the deliverable

```bash
cd /Users/jsteele/Desktop/CreatorDocks/marketplace-redesign
npm run typecheck && npm run lint && npm run test && npm run test --workspace=packages/shared && npx next build
git push -u origin feat/web-redesign          # Vercel builds a PREVIEW; nothing reaches production
```

**The redesign never merges to `main` inside this project.** Local `main` is 47 commits ahead of `origin/main` and a push to `main` is a production deploy, so a merge would ship six weeks of unrelated work with the redesign onto an environment whose launch env is still being fixed. The merge is Jackson's action, after `docs/production-readiness-2026-09-06.md` blockers B1–B3, following `docs/runbooks/deploy.md`. Preview caveat: it has no `DATABASE_URL` and carries **live** Clerk keys — review marketing and auth there, the dashboard locally, and do not create accounts on Preview.

---

## 5. Test strategy

### 5.1 Vitest configuration (WP-02)

Keep the existing node environment untouched — 26 test files depend on it — and add a second project:

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'
import react from '@vitejs/plugin-react'

export default defineConfig({
  test: {
    projects: [
      {
        plugins: [tsconfigPaths()],
        test: {
          name: 'node',
          environment: 'node',
          include: ['tests/**/*.test.ts', 'lib/**/*.test.ts', 'app/**/*.test.ts'],
        },
      },
      {
        plugins: [tsconfigPaths(), react()],
        test: {
          name: 'ui',
          environment: 'jsdom',
          setupFiles: ['tests/setup-ui.ts'],
          include: ['components/**/*.test.tsx', 'app/**/*.test.tsx', 'lib/**/*.test.tsx'],
        },
      },
    ],
  },
})
```

`@vitejs/plugin-react` is required — the current config has no JSX transform at all, which is why no `.tsx` test can exist today. Add a direct `jsdom@^26`; the `jsdom@20.0.3` currently resolvable is hoisted from Expo's tree and is not ours to depend on.

### 5.2 Web contrast contract (WP-01)

`lib/design-tokens.contrast.test.ts` is a direct port of `mobile/src/constants/theme.contrast.test.ts` — same WCAG constants, same alpha compositing, same four pairing tables, same three coverage guards. Differences:

- Reads from `lib/design-tokens.ts` instead of `theme.ts`.
- `SURFACES` gains `bgRaised`.
- Uses `describe`/`it` from vitest (the mobile file uses jest globals).
- Adds one table the mobile file does not need: **text on the marketing canvas**, because the web hero puts display type directly on `--cd-bg` at sizes that still take the 4.5:1 bar in the small-print cases.
- Adds a `--cd-focus-ring` non-text check (3:1 against every surface), since the focus ring is a control affordance under WCAG 1.4.11 — the same reasoning the mobile file applies to `borderStrong`.

`lib/design-tokens.css.test.ts` closes the loop the mobile file cannot: it parses `app/styles/tokens.css` and asserts every TS token appears in both the dark and light blocks with the identical value. Without it the CSS could drift from the tested TS palette and the contrast contract would be checking a file nobody renders.

### 5.3 What "80% coverage" realistically means

**No coverage provider is installed today** (`@vitest/coverage-v8` is missing) and there is no coverage script — so the 80% target is currently unmeasured, not merely unmet. WP-02 installs it; WP-28 turns the threshold on.

The target applies to an **explicit include list**, not the repo:

```ts
coverage: {
  provider: 'v8',
  include: [
    'components/ui/**',
    'lib/design-tokens.ts',
    'lib/cover-art/**',
    'lib/theme.ts',
    'lib/access-cta.ts',
  ],
  thresholds: { lines: 80, functions: 80, statements: 80, branches: 70 },
}
```

Why not the route files: `01-app/02-guides/testing/vitest.md` states plainly — *"Since `async` Server Components are new to the React ecosystem, Vitest currently does not support them… we recommend using E2E tests for `async` components."* Every brand dashboard page and both `[id]` pages are async Server Components that query Prisma. Rendering them in vitest is not possible, and mocking Prisma to force it would test the mock. So:

| Layer | How it is verified |
|---|---|
| Tokens, cover art, theme, access CTA (pure) | Unit tests, ≥ 90% achievable |
| `components/ui/**` (sync server + client) | RTL render tests, 80% threshold enforced |
| Sync server pages (`not-found`, `privacy`, `terms`, `support`, `page.tsx`) | RTL render tests — these are pure and DO render |
| Client pages (`WaitlistForm`, `onboarding`) | RTL + `user-event`, no network (fetch stubbed) |
| Async server pages (all brand dashboard routes) | **Not unit tested.** Covered by `npx next build` (compile + RSC boundary + Satori) and by orchestrator screenshots |
| Visual identity, dark/light parity, 1440/390 layout | **Manual — orchestrator screenshots after every wave** |

Existing E2E infrastructure: none. Adding Playwright is out of scope for this redesign and should be a separate proposal.

### 5.4 What stays manual (orchestrator)

After every wave, from the dev server on `:3100`, in **both** themes where applicable:
`/` (1440 + 390), `/get-the-app`, `/waitlist`, `/privacy`, `/support`, a 404, `/sign-in`, `/sign-up`, `/onboarding`, `/brand`, `/brand/metrics`, `/brand/campaigns/new`, `/brand/applications`, `/brand/submissions`, `/brand/settings` — **plus the regression pair `/creator` and `/internal/waitlist`**, which must look exactly as they did before the redesign.

---

## 6. Next 16 gotchas verified in `node_modules/next/dist/docs`

Installed version is **16.3.4**; all citations are from that tree. Paths are relative to `node_modules/next/dist/docs/`.

1. **`params`, `searchParams`, `cookies()`, `headers()` are Promises — synchronous access is fully removed.**
   `01-app/02-guides/upgrading/version-16.md` §"Async Request APIs (Breaking change)": *"Starting with Next.js 16, synchronous access is fully removed."* Affects WP-19 (`await cookies()`) and WP-22/WP-23 (`await params` in `[id]` routes). `npx next typegen` generates `PageProps<'/route'>` / `LayoutProps` helpers.

2. **`icon` and `opengraph-image` functions now receive `params` and `id` as Promises.**
   Same doc, §"Async parameters for icon, and open-graph Image (Breaking change)": the image-generating function's `params`/`id` are promises, while `generateImageMetadata` keeps synchronous `params`. WP-25: our four files take no arguments today — **do not add a synchronous `params` parameter while redesigning them.**

3. **Turbopack is the default for both `next dev` and `next build`.**
   Same doc, §"Turbopack by default". *"If your project has a custom `webpack` configuration and you run `next build`… the build will fail."* `next.config.ts` currently has none — WP-04 and WP-25 must not add one to solve a CSS or font problem. The `--turbopack` flag is obsolete.

4. **`next lint` is gone and `next build` no longer lints.**
   Same doc, §"Removals → `next lint` Command". `npm run lint` (bare `eslint`) is the only lint gate; a green build proves nothing about lint. Every package must run it explicitly.

5. **Layouts cannot read the pathname or search params, and do not re-render on navigation.**
   `01-app/03-api-reference/03-file-conventions/layout.md` §"Pathname": *"Layouts do not re-render on navigation, so they do not access pathname."* Same for §"Query params". This is why the theme is stamped by the *brand* layout from a cookie rather than by the root layout from the route — and why `NavItem` must be a Client Component using `usePathname`.

6. **The root layout must define `<html>` and `<body>`, and must not hand-write `<head>` tags.**
   Same file, §"Root Layout": *"You should **not** manually add `<head>` tags such as `<title>` and `<meta>` to root layouts. Instead, you should use the Metadata API."* WP-04 keeps the existing `metadata` export and adds nothing to `<head>` directly.

7. **CSS order follows import order and differs between dev and the production build.**
   `01-app/01-getting-started/11-css.md` §"Ordering and Merging": *"CSS ordering can behave differently in development, always ensure to check the build (`next build`) to verify the final CSS order."* Plus §"Recommendations": *"Try to contain CSS imports to a single JavaScript or TypeScript entry file."* This is the load-bearing reason the new system is `cd-`-namespaced (never relies on out-ordering `globals.css`) and is assembled by CSS `@import` inside one entry file.

8. **Global stylesheets are not unloaded on navigation.**
   Same file, §"Global CSS": *"since Next.js uses React's built-in support for stylesheets to integrate with Suspense, this currently does not remove stylesheets as you navigate between routes which can lead to conflicts."* This is what kills the "import legacy.css only from the creator/internal layouts" option (§2.4a) — navigating between areas would leave both sheets live anyway.

9. **`opengraph-image` config exports, font loading, and hard size limits.**
   `01-app/03-api-reference/03-file-conventions/01-metadata/opengraph-image.md`: export `alt`, `size`, `contentType`; fonts are read with `fs` from `process.cwd()` (*"Font loading, process.cwd() is Next.js project directory"*); *"the twitter-image file size must not exceed 5MB, and the opengraph-image 8MB… the build will fail."*

10. **`'use client'` marks an entry point, and every prop crossing it must be serializable.**
    `01-app/03-api-reference/01-directives/use-client.md`: *"You only need to add it to the files whose components you want to render directly within Server Components"* and *"the props of the Client Components must be serializable."* WP-07..WP-10 stay Server Components on purpose; a render-callback prop (e.g. `renderAction`) passed from a page into a client component would fail at runtime, not at typecheck.

11. **Vitest does not support async Server Components.**
    `01-app/02-guides/testing/vitest.md`: *"Vitest currently does not support them… we recommend using E2E tests for async components."* This is the basis for the scoped coverage target in §5.3. The same doc confirms `@vitejs/plugin-react` is required — the repo does not have it.

12. **`middleware` → `proxy`.**
    Same upgrade doc, §"…renamed to `proxy` to clarify network boundary and routing focus." Already migrated here (`proxy.ts` exports `default clerkMiddleware(...)`). No redesign package touches it; note only that it already sets `x-pathname`, which is tempting but must **not** be used to theme the root layout (that would make every marketing page dynamic).

---

## Guess list — what was unclear, and what I guessed

1. **`package.json` changed under me mid-read.** It went from `next@16.2.6` / `eslint-config-next@16.2.6` to `16.3.4` while I was working; `node_modules/next` already reports 16.3.4. I re-read the docs from the installed 16.3.4 tree, so the citations are current — but the lockfile may be mid-flight. **The orchestrator must re-run `npm ci --dry-run` immediately before cutting the branch.** If it fails, the worktree install plan in §4.4 is wrong.

2. **I did not read `.env.local`** (instructed not to). The "one shared production Neon database" claim comes from `docs/PROJECT-STATE.md` and the repo memory, not from the file. If a separate local/branch database exists, §4.6 is over-cautious — verify before telling agents the dev server is read-only.

3. **`node_modules` copy vs `npm ci`.** I did not test `cp -Rc` into a worktree. The relative workspace symlink resolves correctly in principle; `npm ci` is the guaranteed-correct fallback and I flagged it as such.

4. **Clerk dev-instance origins.** I could not check which localhost ports are registered with the Clerk development instance, so I do not know whether `:3100` will complete a sign-in. Flagged as a risk with a non-destructive workaround.

5. **Importing `mobile/src/lib/cover-art.ts` from a web test.** I reasoned that `tsconfig`'s `exclude` does not prevent import-following and that the file is dependency-free, so it should typecheck under the web config — but I did not execute `npm run typecheck` with that import present. The golden-fixture fallback exists precisely because I could not verify this.

6. ~~Font faces are unspecified; `--font-display` must keep its name.~~ **Resolved:** Archivo + Schibsted Grotesk (§2.8); the mobile `Fonts.web` object is dead code, so there was never a naming contract.

7. **`data-public-waitlist-link="true"`.** `PublicWaitlistLink` sets this attribute and nothing in `app/` reads it. I assumed it is an analytics selector (possibly in Vercel Analytics config outside the repo) and told WP-06 to preserve it. If it is dead, it can go — worth a one-line confirmation from the owner.

8. **Two out-of-scope touches.** `app/internal/layout.tsx` (new, 12 lines) and one line in `app/(dashboard)/creator/layout.tsx`. I judged these to be regression-prevention rather than scope creep, but they *are* edits to files the brief marked out of scope. §2.4 documents a no-touch fallback whose only cost is overscroll rubber-banding on WebKit. **This is the one architectural decision I would want confirmed before wave 1 runs.**

9. **Coverage baseline.** No provider is installed, so I could not measure current coverage. The 80% figure in §5.3 is a target on a scoped include list I chose; I do not know what the 26 existing node tests currently cover.

10. **Landing-page section-file split.** I budgeted WP-14 at ~600 LOC across a new `_sections/` directory, but the real number depends entirely on the approved mockup. If the design lands heavier, WP-14 should be split into two packages within wave 3 (there is room — wave 3 has exactly 6).

11. **I read all in-scope files in full except** `app/(dashboard)/brand/metrics/BrandMetricsView.tsx`, `app/(dashboard)/brand/campaigns/[id]/CampaignEditControls.tsx`, `app/(dashboard)/brand/campaigns/new/NewCampaignForm.tsx`, `app/(dashboard)/brand/campaigns/[id]/ApplicationActions.tsx` and the back half of `app/waitlist/WaitlistForm.tsx`, which I characterised from their imports, class usage, inline-style counts and signatures rather than line by line. LOC and class figures for those five are measured; my descriptions of their internal structure are inferred.