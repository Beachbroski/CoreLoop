> **Resolutions applied 2026-09-08.** This section was drafted by an Opus panel on 2026-09-07 and then corrected against two adversarial reviews (see `09-panel-critiques.md`). Where this document and `00-PLAN.md` disagree, **`00-PLAN.md` wins.**

# CreatorDocks Web Redesign — Design Brief

*Phase 1 mockup agents and Phase 2 build agents both read this document. It is the aesthetic authority: do not invent a look, and do not "improve" a token. Where this brief and a house rule conflict, the house rule wins on code structure and this brief wins on appearance.*

---

## 1. Identity thesis

**The person.** A cafe owner in Bushwick, closing out the till at 9:40pm, deciding whether to spend $400 on a creator she has never met. She is not evaluating a SaaS product. She is deciding whether to trust a stranger with money she counted by hand. Every design decision answers one of her two questions: *what exactly will you take off my card, and what do I get before you take it.*

**What "sexy, not AI-made" means for her.** Not friendly. Not playful. Not "empowering." It means the site looks like it is run by people who are careful with money and good at the creative part. Two materials carry that, and they are deliberately in tension:

- **The slip.** Money surfaces are built like a card-terminal receipt: hairline rules, sharp corners, condensed tabular figures, no decoration, every number named. This is the language of an object she already trusts — she reads five of these a day at the register.
- **The wall.** Creative surfaces are the campaign artwork itself — the same deterministic, saturated cover art the iOS app draws. It is the only saturated color in the room, and it always represents a real campaign, never a mood.

The whole design is a quiet, disciplined dark ledger, punctured by artwork. Nothing else is allowed to be loud.

**The one aesthetic risk we take: shopfront-scale expanded display type.** The landing headline is set in Archivo at width 118, weight 700, up to 88px, left-aligned, running near the full 1200px measure across three lines, with no accented word and no gradient. It should read like vinyl lettering across a shop window — physical, confident, slightly too big for the room. That is the memorable thing, and it is the *only* place we spend boldness on the marketing site.

**Where we stay quiet — everywhere else.** One accent (coral). No shadows on dark surfaces except overlays. Radii of 0, 4, 6, 10, 14 and nothing between 18 and 40. No glass, no blur, no orbs, no bento. Chrome (nav, sidebar, tables, forms) is near-monochrome and gets color only when money or status is at stake. The dashboard has no headline that sells anything: it is a workspace, and its job is to tell her what is waiting on her and what it will cost.

**One identity, two platforms.** The iOS app is where creators live; the web is where brands live. They must read as the same company at a glance: same coral, same canvas, same generated cover art, same "hold now, pay on approval" vocabulary. What differs is register — the app is a feed you browse, the web is a ledger you review.

---

## 2. Token spec

All values live in `lib/design-tokens.ts` (TypeScript, the source of truth) and are projected into `app/styles/tokens.css` as `--cd-*` custom properties; `lib/design-tokens.css.test.ts` proves the two agree. The OG image routes and the contrast test import the TS object (`ImageResponse` cannot read CSS variables). **No `.tsx` file under `app/**` or `components/**` may contain a color literal.** Every token is prefixed `--cd-` because the legacy stylesheet already defines unprefixed `--text`, `--accent`, `--text-faint` and friends, which creator and admin pages still resolve.

### Theme stamping — the mechanism (final; see `02-engineering.md` §2.2–2.3)

Dark is the flagship, so **dark lives on the bare `:root`**. Light is an override. Definition order in `app/styles/tokens.css` (this exact structure — do not collapse it):

```css
:root, [data-theme="dark"]  { color-scheme: dark;  /* the complete dark set */ }
[data-theme="light"]        { color-scheme: light; /* the complete light set */ }
@media (prefers-color-scheme: light) {
  :root:not([data-theme="dark"]):not([data-theme="light"]) { color-scheme: light; /* light set again */ }
}
```

The selectors are plain attribute selectors, not `:root[data-theme]`, so **any element can carry a theme scope**. That is what lets a shared, static root layout host a forced-dark marketing site and a user-themed dashboard:

- `<html>` in `app/layout.tsx` stamps nothing.
- **Marketing and auth** (`PublicPageShell`, `not-found`, sign-in, sign-up, sso-callback, onboarding) render `<div class="cd-app" data-theme="dark">`. Always dark, on every device. Marketing pages stay statically prerendered.
- **The brand dashboard** layout is already dynamic (it calls `getCurrentAppUser()`), so it reads the `cd-theme` cookie with `await cookies()` and renders `<div class="cd-app" data-theme={…}>`: `dark` → `"dark"`, `light` → `"light"`, `system` → **no attribute**, which drops through to `prefers-color-scheme`. Server-rendered, so there is **no flash and no inline script**.
- `ThemeToggle` (System / Light / Dark, a radiogroup) lives in `/brand/settings` and in the sidebar footer. It writes the cookie, optimistically stamps its nearest `.cd-app`, then calls `router.refresh()`.
- `base.css` paints the ground with `body:has(.cd-app) { background: var(--cd-bg); color: var(--cd-text) }` and `html:has(.cd-app) { background: var(--cd-bg) }`. Creator and admin pages contain no `.cd-app`, so they keep the legacy gradient untouched.

### Dark theme (flagship) — derived from `mobile/src/constants/theme.ts`

| Token | Value | Source | Notes / computed ratio |
|---|---|---|---|
| `--cd-bg` | `#07080b` | mobile `background` | the room |
| `--cd-bg-element` | `#12141b` | mobile `backgroundElement` | panels, tables, sidebar |
| `--cd-bg-raised` | `#171a22` | **new (web)** | 1.46× the luminance of `--cd-bg-element` and 1.26× below `--cd-bg-selected` (WCAG relative luminance 0.00708 / 0.01036 / 0.01308) — a real, visible step that does not collide with the hover/selected state. Modals, drawers, the hero slip, the waitlist form panel. |
| `--cd-bg-selected` | `#1b1e27` | mobile `backgroundSelected` | hover + active rows, selected chips |
| `--cd-border` | `rgba(255,255,255,0.10)` | mobile `border` | decorative hairlines; 1.31:1, deliberately below 3:1 (1.4.11 exempt — nothing is identified by it) |
| `--cd-border-strong` | `rgba(255,255,255,0.36)` | mobile `borderStrong` | control boundaries (inputs, selects, textareas). Composites to `#606163` on canvas (3.23:1), `#67696d` on surface (3.33:1), `#6b6c72` on **raised (3.32:1 — new ground, computed)**, `#6d6f75` on selected (3.31:1) |
| `--cd-text` | `#f7f8fa` | mobile `text` | 18.85 / 17.31 / **16.37 (raised)** / 15.66 |
| `--cd-text-secondary` | `#9ba1ae` | mobile `textSecondary` | 7.73 / 7.10 / **6.71** / 6.42 — **all real caption and helper text uses this** |
| `--cd-text-faint` | `#7d8492` | **new (web)** | 5.33 / 4.89 / **4.63** / 4.43. Rated as a **non-text token (≥3:1)**: decorative rules, disabled glyphs, the 404 numeral, chart baselines. **Never put a sentence in it.** (The current site's legacy `--text-faint: #98a2b3` carries captions at ~2.5:1; that is a live accessibility bug this redesign closes.) |
| `--cd-accent` | `#ff503d` | mobile `accent` | coral as **foreground**: links, icon tints, focus ring, active nav rule, urgent deadlines. 6.17 / 5.66 / **5.36** / 5.13 |
| `--cd-accent-fill` | `#d64131` | mobile `accentFill` | coral as a **surface carrying white text**: primary buttons, price pills, the closing band. White on it = 4.51:1 |
| `--cd-accent-strong` | `#c03a2c` | mobile `accentStrong` | pressed/hover state of `--cd-accent-fill`. White on it = 5.41:1 |
| `--cd-on-accent` | `#ffffff` | mobile `onAccent` | the only label color permitted on `--cd-accent-fill` / `--cd-accent-strong` |
| `--cd-accent-soft` | `rgba(255,80,61,0.10)` | **alpha-only divergence from mobile's 0.16** | mobile's wash is rated icon-only (3:1). The web uses it behind **accent-colored text** (Active pills, the accept-confirmation panel), so it is sized for 4.5:1: `--cd-accent` over it composites to 5.69 (canvas) / 5.11 (surface) / **4.83 (raised)** / **4.59 (selected — worst case)**. Same hue, same base color, lower alpha. |
| `--cd-secondary` | `#5895f7` | mobile `secondary` | **informational only** — never a button, never a primary action. 6.73 / 6.18 / 5.85 / 5.59 |
| `--cd-secondary-soft` | `rgba(59,130,246,0.16)` | mobile | `--cd-secondary` over it on raised **4.76**, selected **4.57** |
| `--cd-success` | `#2dd4a8` | mobile | 10.58 / 9.72 / 9.19 / 8.79. Reserved for **money the creator receives** and approved states |
| `--cd-success-soft` | `rgba(45,212,168,0.14)` | mobile | text over it on raised **6.99**, selected **6.68** |
| `--cd-warning` | `#f0a93a` | mobile | 9.96 / 9.15 / 8.65 / 8.28. Admin banners, pending review |
| `--cd-warning-soft` | `rgba(240,169,58,0.16)` | mobile | over it on raised **6.34**, selected **6.06** |
| `--cd-danger` | `#f55b7f` | mobile | 6.38 / 5.86 / 5.54 / 5.30 |
| `--cd-danger-soft` | `rgba(244,67,108,0.14)` | mobile | over it on raised **4.78**, selected **4.58** |
| `--cd-focus` | `#ff503d` | = `--cd-accent` | `outline: 2px solid var(--cd-focus); outline-offset: 2px`. 6.17 / 5.66 / 5.36 / 5.13 — clears 3:1 on every ground |
| `--cd-art-scrim` | `rgba(7,8,11,0.55)` | **new (web)** | the scrim under any text sitting on cover art. White on it over the worst palette stop (`#f59e0b`) = **7.63:1** |

### Light theme (dashboard only) — derived from mobile `Colors.light`

| Token | Value | Notes / computed ratio |
|---|---|---|
| `--cd-bg` | `#f5f7fb` | mobile `background` |
| `--cd-bg-element` | `#ffffff` | mobile `backgroundElement` |
| `--cd-bg-raised` | `#ffffff` | **Deliberately the same fill as `--cd-bg-element`.** In light mode, lightness is capped at white, so elevation is carried by shadow; in dark mode, shadows are invisible on `#07080b`, so elevation is carried by lightness. **One mechanism per theme, never both.** This also preserves every ratio mobile already computes and enforces against `#ffffff`. |
| `--cd-bg-selected` | `#eef2f8` | mobile `backgroundSelected` |
| `--cd-border` | `rgba(15,23,42,0.08)` | mobile — 1.18:1, decorative |
| `--cd-border-strong` | `rgba(15,23,42,0.48)` | mobile — `#8c9099` on white (3.21:1), `#878b97` on canvas (3.16:1), `#838995` on selected (3.13:1) |
| `--cd-text` | `#101828` | 16.55 / 17.75 / 15.80 |
| `--cd-text-secondary` | `#636d82` | 4.85 / 5.20 / 4.63 |
| `--cd-text-faint` | `#7a8296` | **new (web)** — 3.59 / 3.85 / 3.42. Non-text only, same rule as dark. |
| `--cd-accent` | `#bf3524` | 5.22 / 5.60 / 4.98 |
| `--cd-accent-fill` | `#d83e2a` | white on it = 4.52:1 |
| `--cd-accent-strong` | `#c33625` | white on it = 5.42:1 |
| `--cd-on-accent` | `#ffffff` | |
| `--cd-accent-soft` | `rgba(224,64,44,0.06)` | **alpha-only divergence from mobile's 0.10**, for the same text-bearing reason. `--cd-accent` over it: 4.82 (canvas) / 5.17 (surface) / **4.60 (selected — worst)** |
| `--cd-secondary` | `#005be4` | 5.41 / 5.81 / 5.17 |
| `--cd-secondary-soft` | `rgba(19,113,255,0.10)` | mobile |
| `--cd-success` | `#0a7551` | 5.33 / 5.71 / 5.08 |
| `--cd-success-soft` | `rgba(13,159,110,0.10)` | mobile |
| `--cd-warning` | `#8d5b12` | 5.38 / 5.77 / 5.14 |
| `--cd-warning-soft` | `rgba(200,129,26,0.12)` | mobile |
| `--cd-danger` | `#c2193e` | 5.59 / 6.00 / 5.34 |
| `--cd-danger-soft` | `rgba(225,29,72,0.10)` | mobile |
| `--cd-focus` | `#bf3524` | 5.22 / 5.60 / 4.98 — clears 3:1 everywhere |
| `--cd-art-scrim` | `rgba(7,8,11,0.55)` | identical in both themes; cover art is dark-native |

### Brand constants (theme-independent)

`--cd-brand-coral: #ff503d` (the logo mark, and any badge sitting on cover art — light mode's darkened foreground coral would vanish against the artwork). `--cd-brand-coral-strong: #e63f2d`.

### Elevation (not a color, but a token set)

Dark: `--cd-elev-1: none`, `--cd-elev-2: inset 0 1px 0 rgba(255,255,255,0.04)`, `--cd-elev-3: 0 24px 64px -12px rgba(0,0,0,0.75)`.
Light: `--cd-elev-1: none`, `--cd-elev-2: 0 1px 2px rgba(15,23,42,0.06), 0 8px 24px -8px rgba(15,23,42,0.10)`, `--cd-elev-3: 0 24px 64px -12px rgba(15,23,42,0.22)`.

### Pairs the web contrast test MUST enforce

Create `lib/design-tokens.contrast.test.ts`, mirroring `mobile/src/constants/theme.contrast.test.ts` in structure (re-derive WCAG relative luminance and alpha-composite the `*Soft` fills from the tokens themselves — do not hard-code the expected hexes). It fails the build if any of these drift:

1. `text`, `text-secondary` × {`canvas`, `surface`, `surface-raised`, `surface-selected`} ≥ **4.5**.
2. `text-faint` × the same four grounds ≥ **3.0** (and an assertion that it is *lower* than `text-secondary`, so nobody "fixes" it upward and re-enables caption use).
3. `accent`, `secondary`, `success`, `warning`, `danger` × the same four grounds ≥ **4.5**.
4. Each of `accent`, `secondary`, `success`, `warning`, `danger` composited **over its own `*Soft` fill** on each of the four grounds ≥ **4.5**. (`surface-raised` is the ground mobile never had; it is the second-worst case after `selected`.)
5. `on-accent` (`#ffffff`) × `accent-fill` and × `accent-strong` ≥ **4.5**, both themes.
6. `border-strong` composited on each of the four grounds ≥ **3.0**.
7. `focus` × each of the four grounds ≥ **3.0**.
8. `#ffffff` over `--cd-art-scrim` composited on **every one of the 16 cover-art palette stops** ≥ **4.5**.
9. `#ffffff` on the **darker** stop of each of the 8 cover-art palettes ≥ **4.5** (the avatar-initials rule — currently 5.88 to 15.99).
10. A documented assertion that **at least six of the eight lighter palette stops** put `#ffffff` below 4.5:1 (measured: `#ff6a58` 2.82, `#7c3aed` 5.70, `#0ea5e9` 2.77, `#f59e0b` 2.15, `#10b981` 2.54, `#ec4899` 3.53, `#6366f1` 4.47, `#14b8a6` 2.49), so white-on-artwork is never assumed safe and the scrim rule (#8) cannot be deleted as redundant. **No agent may alter `COVER_ART_PALETTES` to satisfy a contrast test** — those values are the mobile parity contract (`mobile/src/lib/cover-art.ts:31-40`).

---

## 3. Typography

**No Inter, Space Grotesk, Plus Jakarta Sans, Manrope, DM Sans, or Playfair anywhere in the repo after this change.** Two families, three voices.

### The faces

**Display — `Archivo` (variable, `wdth` 62–125, `wght` 100–900).**
Two widths, two jobs, one family:

- **Archivo Expanded (`wdth` 105–118)** for headlines. It is a wide, squared, sign-painter grotesque — the lettering on an awning, a gym's window vinyl, a salon's hand-painted panel. It is architecture, not software. That is the shopfront risk from §1, and it is the whole reason the page does not read as a template.
- **Archivo Condensed (`wdth` 84–88), tabular figures** for every number that is money, count, or date. A condensed face with tabular figures is the receipt roll: columns align, `$1,325.00` and `$212.50` sit on the same rhythm, and dense financial tables stay readable at 15px. **This is why there is no monospace face in this system** — mono for data labels is a generated-page tell, and condensed Archivo does the job better and is already loaded.

**Body / UI — `Schibsted Grotesk` (variable, `wght` 400–900, plus italic).**
A newsroom face, drawn for reading reports and figures on screen. Its lowercase is noticeably narrower and more humanist than Archivo's, so at a glance the two are unmistakably different voices — the awning versus the newsprint the brief is actually written in. It handles a 2,000-character campaign description at 15px without turning into a wall, which the display face would not.

### Scale

Sizes in rem (root 16px). `ls` = letter-spacing. Fluid values use `clamp()`.

| Role | Family / axes | Size | Line-height | ls | Weight | Where |
|---|---|---|---|---|---|---|
| `hero` | Archivo `wdth 118` | `clamp(2.75rem, 6.2vw, 5.5rem)` | 0.94 | −0.035em | 700 | landing + /get-the-app H1 only |
| `display` | Archivo `wdth 112` | `clamp(2rem, 3.6vw, 3.25rem)` | 1.00 | −0.03em | 650 | marketing section headings |
| `h1` | Archivo `wdth 105` | `2rem` | 1.10 | −0.025em | 600 | dashboard page titles, legal page titles |
| `h2` | Archivo `wdth 100` | `1.375rem` | 1.25 | −0.015em | 600 | panel headings, legal subheads |
| `h3` | Schibsted | `1.0625rem` | 1.35 | −0.005em | 600 | row titles, FAQ questions, form group names |
| `lead` | Schibsted | `1.1875rem` | 1.60 | −0.005em | 400 | hero sub-copy, section intros. **max 62ch** |
| `body` | Schibsted | `0.9375rem` | 1.60 | 0 | 400 | dashboard body, form help. **max 68ch** |
| `body-lg` | Schibsted | `1.0625rem` | 1.65 | 0 | 400 | marketing body, legal body. **max 68ch** |
| `small` | Schibsted | `0.8125rem` | 1.45 | 0.005em | 400 | captions, footnotes, table meta |
| `label` | Schibsted | `0.8125rem` | 1.20 | 0.01em | 600 | field labels, table headers, sidebar section names. **Sentence case. Never uppercase.** |
| `data-lg` | Archivo `wdth 88`, `tabular-nums` | `clamp(1.75rem, 2.6vw, 2.5rem)` | 1.00 | −0.02em | 600 | the money strip, metric figures, the slip's totals |
| `data` | Archivo `wdth 88`, `tabular-nums` | `0.9375rem` | 1.40 | 0 | 500 | money and counts inside table rows, dates, referral codes |

Global: `font-variant-numeric: tabular-nums` and `font-feature-settings: "tnum" 1` on `.data`, `.data-lg`, and every `<td>` in a numeric column. Headings get `text-wrap: balance`; `lead` and `body` get `text-wrap: pretty`.

**Forbidden typographic moves** (also in the checklist): no accented single word in a headline; no all-caps labels; no eyebrow above a heading; no tracked-out micro-labels; no `→` in link text.

### Loading

CSS2 URLs (verified to return 200 from Google Fonts):

```
https://fonts.googleapis.com/css2?family=Archivo:ital,wdth,wght@0,62..125,100..900;1,62..125,100..900&display=swap
https://fonts.googleapis.com/css2?family=Schibsted+Grotesk:ital,wght@0,400..900;1,400..900&display=swap
```

In the app, use `next/font/google` (verified against the installed `next` typings — `Archivo` accepts `axes: ['wdth']`; `Schibsted_Grotesk` is `wght` 400–900 only):

```ts
import { Archivo, Schibsted_Grotesk } from 'next/font/google'

const display = Archivo({
  subsets: ['latin'],
  axes: ['wdth'],
  display: 'swap',
  variable: '--cd-font-display',
  fallback: ['Helvetica Neue', 'Arial', 'sans-serif'],
})

const body = Schibsted_Grotesk({
  subsets: ['latin'],
  display: 'swap',
  variable: '--cd-font-body',
  fallback: ['Helvetica Neue', 'Arial', 'sans-serif'],
})
```

Width and weight are always set **together**: `font-variation-settings: 'wdth' 118, 'wght' 700` — setting `wdth` alone resets `wght` in several engines, and an agent without a browser will not see it. Never mix in the `font-stretch` shorthand. (`Fonts.web` in `mobile/src/constants/theme.ts` is dead code on both platforms; there is no variable-name contract with mobile.)

OG image routes cannot use `next/font`. Commit two subsetted static font files under `assets/fonts/` (Archivo at `wdth 118 / wght 700`, and Archivo at `wdth 88 / wght 600`) and load them as `ArrayBuffer`s in each `opengraph-image.tsx`. **Read `node_modules/next/dist/docs/` for the current `ImageResponse` font API before implementing** — this Next version's API may differ from your training data.

---

## 4. Layout grammar

### Spacing scale

Mirrors `mobile/src/constants/theme.ts` `Spacing` and adds the three steps a web page needs. Named by position (not by multiplier) to avoid the ordinal confusion documented in the mobile file:

`--cd-space-0: 2px` · `--cd-space-1: 4px` · `--cd-space-2: 8px` · `--cd-space-3: 12px` · `--cd-space-4: 16px` · `--cd-space-5: 24px` · `--cd-space-6: 32px` · **`--cd-space-7: 48px`** · `--cd-space-8: 64px` · **`--cd-space-9: 96px`** · **`--cd-space-10: 128px`**

Mapping to mobile: `half→0, one→1, two→2, twoHalf→3, three→4, four→5, five→6, six→8`. Document that mapping in a comment in the tokens file.

### Radii — corners are information, not decoration

`--cd-radius-0: 0` · `--cd-radius-1: 4px` · `--cd-radius-2: 6px` · `--cd-radius-3: 10px` · `--cd-radius-4: 14px` · `--cd-radius-full: 999px`

- **0 (sharp):** full-bleed bands, sticky nav, table header rules, the slip's internal hairlines, the sidebar, section dividers, the marketing comparison table. Sharp edges are where the page touches the viewport or where a structure is a *rule*, not an object.
- **4:** status pills, badges, filter chips, checkboxes, the step markers.
- **6:** buttons, inputs, selects, textareas. **Buttons are rectangles, not pills.** A 6px coral rectangle reads like a POS terminal key — which is exactly the world this product lives in.
- **10:** cards, panels, cover art, table thumbnails, empty states.
- **14:** modals, drawers, the hero slip.
- **999:** avatars and the live/status dot. **Nothing else.**

**Banned:** any radius in 18–40px, and `999px` on buttons, chips, or nav.

### Grid and max-widths

**Marketing** (`/`, `/get-the-app`, `/waitlist`, legal, 404):
- Page measure `--cd-measure-page: 1200px`. Gutters: 24px ≥1024, 20px 768–1023, 16px <768.
- 12-column grid, 24px gap, used with *named asymmetric spans*, never as a bento:
  - hero: copy `1 / span 7`, slip `8 / span 5`
  - editorial rows: label column `1 / span 4`, content `5 / span 8`
  - FAQ: two columns of 6 at ≥1024, one at <1024
  - **The 768–1023 band is specified, not inherited** (the legacy sheet has a `max-width: 820px` block that stays live during migration): hero stacks (copy above slip), mosaic at 2 columns, comparison table keeps two columns, nav collapses to mark + CTA + menu. 820 is a mandatory screenshot viewport.
- **Everything is left-aligned.** Centered text is permitted only on `/sso-callback` and the waitlist success panel. Nothing wider than 480px is centered.
- Vertical rhythm: `--cd-space-9` (96px) between sections at ≥1024, `--cd-space-7` (48px) below 768.

**Dashboard** (`/brand/**`):
- Sidebar 264px fixed + main fluid. Main content max 1320px, page gutters 32px ≥1024 / 16px below.
- Vertical rhythm: `--cd-space-6` (32px) between blocks, `--cd-space-4`/`--cd-space-3` inside them.
- Control heights: input/select 44px, button 40px (sm 32, lg 48), table row 56px, campaign row with thumbnail 72px, sidebar item 40px.
- Body type is 15px here vs 17px on marketing. That size difference, plus the rhythm difference, is the whole density story: **marketing is a page you read at arm's length; the dashboard is a document you scan.**

### Separating surfaces on a dark ground — without glass

Four levels, and a level implies its full recipe. No mixing.

| Level | Dark | Light |
|---|---|---|
| 0 canvas | `--cd-bg`, no border, no shadow | `--cd-bg` |
| 1 surface | `--cd-bg-element` + `1px solid var(--cd-border)`, `--cd-elev-1` (none) | `--cd-bg-element` + `1px solid var(--cd-border)` |
| 2 raised | `--cd-bg-raised` + `1px solid var(--cd-border)` + `--cd-elev-2` (a 1px inner top highlight) | `--cd-bg-raised` (= white) + `--cd-elev-2` (shadow) |
| 3 overlay | `--cd-bg-raised` + `1px solid rgba(255,255,255,0.14)` + `--cd-elev-3` + a `rgba(7,8,11,0.72)` page scrim | `--cd-bg-raised` + `--cd-elev-3` + `rgba(15,23,42,0.32)` scrim |

**Rules:** `backdrop-filter` is banned outright. `filter: blur()` is banned outright. On dark, `box-shadow` appears **only at level 3**. Inside a level-1 panel, sub-structure is expressed by 1px `--cd-border` rules and 1px vertical dividers — never by nesting another bordered card (no card-in-a-card).

### Nav — public

A real bar, not a floating pill. Full-width, `--cd-radius-0`, 68px tall, sticky at `top: 0`.
- At `scrollY === 0`: transparent background, transparent bottom border.
- Past 8px: `background: var(--cd-bg-element)`, `border-bottom: 1px solid var(--cd-border)`, transitioned over 160ms. That is a state change, so it earns its animation.
- Left: brand mark 26px at `--cd-radius-2` + wordmark in `h3` type at `wdth 105`.
- Center-left: links in `body` at `--cd-text-secondary`; hover → `--cd-text`; the current section gets a **2px `--cd-accent` underline at `text-underline-offset: 8px`** — not a pill, not a background.
- Right: the flag-aware CTA as a `--cd-accent-fill` rectangle, `--cd-radius-2`, 40px tall.
- Below 860px: links collapse into a full-screen sheet (level 3, `--cd-radius-0`, slides in over 200ms), CTA stays visible in the bar.

### Nav — dashboard sidebar

264px, `background: var(--cd-bg-element)`, `border-right: 1px solid var(--cd-border)`, **no radius, no shadow, not a card**, sticky full-height.
- Brand lockup at top, then the workspace name in `label` type, `--cd-text-secondary`, **sentence case** ("Brand workspace") — the current uppercase tracked label goes.
- Nav item: 40px tall, `--cd-radius-2`, `--cd-text-secondary`. Hover → `--cd-text` + `--cd-bg-selected`. Active → `--cd-text` + `--cd-bg-selected` + a **2px `--cd-accent` bar** absolutely positioned at `left: 0, top: 8px, bottom: 8px`. No gradient fill, no `translateX`.
- **Delete the "System feel" panel** ("Faster briefs" / "Cleaner payouts"). It is marketing copy inside a workspace, and it is the single most template-looking element in the current dashboard.
- Footer: Clerk `UserButton` + name/role, separated by a top `--cd-border` rule (not a nested card).
- Below 1024px: sidebar becomes a 56px top bar + a left drawer at level 3.

---

## 5. Imagery system

### Porting cover art

Create `lib/cover-art.ts` (web) as a **line-for-line port** of `mobile/src/lib/cover-art.ts` — same FNV-1a hash, same `fraction(seed, lane)` lanes, same 8 palettes, same `['orbs','rings','stripes','arc']` order, same 2–3 decor elements, same size/opacity ranges. Pure, no React.

Add `lib/cover-art.parity.test.ts` asserting that web `coverArtSpec(id, niche)` returns byte-identical specs to a committed fixture table of ~20 `(id, niche)` pairs generated from the mobile implementation. **The two platforms must never drift**, or the same campaign looks like two different campaigns to the same person.

Also port `tileAspectRatio` (1, 4/5, 4/3) and `deadlineSignal` / `isNewCampaign` / `spotsLabel` from `mobile/src/lib/campaign-signals.ts` into `lib/campaign-signals.ts` with the same parity test treatment.

### Rendering (`components/CoverArt.tsx`) — CSS, not canvas

A 1:1 DOM translation of `mobile/src/components/cover-art.tsx`. No SVG, no canvas, no library.

- Container: `position: relative; overflow: hidden; border-radius: var(--cd-radius-3)`.
- Base: `background-image: linear-gradient(135deg, c0 0%, c1 100%)` — 135deg is the CSS equivalent of the mobile gradient's `{0,0} → {1,1}`.
- Decor: absolutely positioned `<span>`s, each `left: x*100%; top: y*100%` with `margin-left/-top: -size/2`, `size = d.size * (height * 1.5)`:
  - `orbs` → `border-radius: 999px; background: #fff; opacity: d.opacity`
  - `rings` → same box, transparent background, `border: max(2px, height*0.07) solid #fff`
  - `stripes` → `width: size*2.4; height: height*0.16; border-radius: 999px; background:#fff; transform: rotate(-24deg)`
  - `arc` → decor[0] as a ring at `size*2.2`, remaining decor as orbs
- All decor spans are `aria-hidden`. The artwork carries no information.
- When a real `imageUrl` exists it wins, rendered through `next/image` with `object-fit: cover`, same radius, same overflow.

**Text on cover art**: any overlay text sits on a `--cd-art-scrim` layer (`rgba(7,8,11,0.55)`), giving white 7.63:1 against the worst palette stop. The price pill uses `--cd-accent-fill` + `--cd-on-accent` (4.51:1) — it does not need the scrim, and it never uses `--cd-accent` (white on `#ff503d` is only 3.25:1).

### The campaign tile (marketing)

Used **only** in the landing "who this is for" mosaic and the `/get-the-app` hero. It is the same object a creator sees in the app:

Cover art at the campaign's own aspect ratio → price pill bottom-right (`--cd-accent-fill`, `--cd-radius-1`, `data` type) → urgency badge top-left when `deadlineSignal().urgent` (a `--cd-brand-coral` outlined chip with a 6px coral dot; **fixed brand coral, not `--cd-accent`**, because it sits on artwork in both themes) → caption below: brand row (18px initials disc + brand name in `small`), title in `h3` clamped to 2 lines, then a **two-column meta row** in `small` / `--cd-text-secondary`: niche (with its dot in the palette's darker stop) on the left, spots and deadline right-aligned on the right. No middots.

### The campaign row (dashboard)

The dashboard is **not** a mosaic. Campaign artwork appears as a fixed **56×40 thumbnail at `--cd-radius-2`** in table rows, and as a **1200×200 header strip at `--cd-radius-3`** on `/brand/campaigns/[id]`. Fixed geometry keeps the table scannable; varying aspect ratios belong to a browse feed, not a ledger.

### Creator application visual language

An applicant is a **row**, never a card. Left: 36px avatar. Then name (`h3`) and handle/niche (`small`, `--cd-text-secondary`). Then the pitch, clamped to 3 lines with a "Read pitch" disclosure that expands in place. Right, right-aligned: proposed rate in `data`, status pill, actions. Accepted applicants get a 2px `--cd-success` left rule on the row; rejected ones drop to `--cd-text-secondary` with no rule. **No hover elevation, no hover translate.**

### Avatars

- `--cd-radius-full`, `object-fit: cover`, 1px `--cd-border` ring.
- No image → an initials disc filled with the **darker stop** of that person's/campaign's palette (white on those stops = 5.88–15.99:1), initials in `--cd-on-accent`, Archivo `wdth 100 / 700`. Same rule as mobile's `markEnd`.
- **Coral is never a person's avatar.** Coral is the CreatorDocks mark; using it for a creator makes the platform look like a participant in the deal.

### Real photography — rules, not a dependency

If Jackson supplies photos later, they slot in without a redesign:

1. Photography replaces **cover art only**. It never appears behind chrome, nav, forms, or the dashboard.
2. Always through `next/image`, always `--cd-radius-3`, always `object-fit: cover`, always with explicit `sizes`.
3. Any text over a photo uses `--cd-art-scrim` — the same layer, unchanged.
4. No duotone, no coral multiply, no grayscale-to-color hover. The photo is the photo.
5. Portraits are cropped square into the avatar circle; a person's face is never a full-bleed hero.
6. **A missing photo is never a grey placeholder.** The generated art *is* the design; it is what ships, and photography is an upgrade path, not a gap.

### No ambient. The artwork is content, not atmosphere.

The first draft put a 10%-opacity canvas of generated cover art behind the hero. The review was right that this is the orb-field / gradient-mesh hero backdrop with different geometry, and it was cut. **There is no generated ambient anywhere in the product**: no canvas behind the hero, no wash behind the sign-in panel, no `requestAnimationFrame`.

Where the wall goes instead: the **"Who this is for" section opens with a full-bleed strip of real campaign tiles at full opacity**, cropped by the viewport edges — the artwork is information (these are the briefs), not mood. The sign-in split screen shows **one** real campaign tile on the bare canvas.

---

## 6. Motion

One orchestrated moment, then stillness.

### Landing hero page-load sequence (the single moment)

One thing moves on load, and it is unique to this product: **the slip prints.** The hero as a whole fades in once (opacity 0 → 1, 200ms), then the slip's ledger rules draw left-to-right — `transform: scaleX(0) → 1`, `transform-origin: left`, 220ms each, 60ms stagger, starting at 240ms. Total under 700ms. CSS only, no JS timeline, no per-line headline stagger, no `translateY` entrances.

Nothing else on the page animates on load. `/get-the-app` reuses only the 200ms fade.

### Scroll

**No scroll reveals. None.** No `IntersectionObserver`, no `animation-timeline`, no fade-and-slide-up on sections. Sections are simply present when you reach them. This is the single loudest AI tell and its absence is what makes the page feel authored.

Also: **remove `scroll-behavior: smooth`** from the global stylesheet. In-page anchor jumps are instant.

### Hover / press

- **Hover:** `color`, `border-color`, `background-color` only, 120ms `ease`. No `transform`, no shadow growth, no scale.
- **Links** in body copy: `text-decoration: underline; text-decoration-color: transparent → var(--cd-accent)`, `text-underline-offset: 3px`, 120ms.
- **Press:** `:active { transform: scale(0.98) }` for 90ms on buttons and clickable rows — the web echo of the iOS tile's 0.97 press. This and the load sequence are the only transforms in the system.
- **Focus:** `:focus-visible` only, `outline: 2px solid var(--cd-focus); outline-offset: 2px`. Never removed, never animated.

### Dashboard

Motion answers actions, nothing else.

- **Route changes: nothing.** No page transitions, no fades.
- **Disclosure** (the accept-confirmation panel, the revision textarea, "Read pitch"): `grid-template-rows: 0fr → 1fr` over 200ms `ease-out`. This is the pattern for every expand in the product.
- **Status change:** a status pill cross-fades over 140ms when its row's status changes after an action.
- **Optimistic actions** (accept, approve, reject): the button label swaps to its progress form ("Approving…") and a 2px `--cd-accent` indeterminate rule appears under the decision bar. No spinners inside buttons.
- **Skeleton → content:** a plain swap, no fade. The skeleton already matches the real layout, so a fade only draws attention to reflow.

### Skeletons

**Delete the `shimmer` sweep.** A gradient that slides forever is both a template tell and constant motion. Replacement: `--cd-bg-selected` blocks at the real radii and the real dimensions, with `animation: skeleton-pulse 1.6s ease-in-out infinite` animating **opacity only**, 0.55 ↔ 0.85.

### Reduced motion

`@media (prefers-reduced-motion: reduce)`:
- The hero sequence collapses to a single 200ms opacity fade of the whole hero; the canvas draws its final frame with no fade; the rule-draw is skipped entirely.
- `:active` scale removed.
- Skeleton pulse removed → static `opacity: 0.7`.
- Disclosure expansion becomes instant (`transition: none`), and the nav's scrolled-state transition becomes instant.
- All hover color transitions become instant.

### Never animate

Scroll position · section entrances · card hover position or scale · numbers counting up · gradient angles or hues · the coral (no pulsing accents) · anything on the dashboard's initial paint · the sidebar · loading skeletons' geometry (only opacity) · the logo mark.

---

## 7. Page concepts

CTAs everywhere are flag-aware via a single helper `lib/access-cta.ts` → `{ href, label }` keyed by slot (`nav` | `hero` | `closing` | `secondary`) and `getMarketplaceAccess()`. **No component may hardcode `/waitlist` or `/sign-up`.**

### `/` — landing

**Thesis:** *You will know the exact number before you spend it.*

**Hero — two variants on the Phase 1 canvas, the owner picks one:**
- **Variant B (the default on artboard 1):** the headline runs the **full 12-column measure** in `hero` type — this is the shopfront risk, and boxing it into 7 columns is what makes it read as a hero card. Below the headline, one row: lead + CTA row in `1 / span 6`, the slip in `8 / span 5`, the slip's top edge sitting on the fold.
- **Variant A (artboard 1b, hero region only):** copy `1 / span 7`, slip `8 / span 5`, side by side.

In both: no eyebrow chip. H1 in `hero` type. Lead in `lead`. CTA row: primary (flag-aware) + "See how it runs" ghost. Below, the local-brand types as plain text separated by 1px `--cd-accent` vertical rules — `Cafes | Gyms | Salons | Boutiques | Home services` — not pills.

**The slip** — the memorable object, 380px wide, level 2, `--cd-radius-4`:
1. Header: campaign title (`h3`) + `Ferrous Coffee · Bushwick` (`small`, `--cd-text-secondary`).
2. A 16:9 cover-art strip (real `coverArtSpec` output) with the `$400` price pill.
3. The ledger — hairline-ruled rows, label left in `body`/`--cd-text-secondary`, value right in `data`, tabular:
   - `Accepted rate` — `$400.00`
   - `Authorized on your card` — `$400.00`
   - `Captured when you approve` — `$400.00`
   - `Platform fee (15%)` — `−$60.00` (`--cd-text-secondary`, real U+2212 minus, **not red**)
   - `Ana Reyes receives` — `$340.00` (`--cd-success`)
4. Footer, `small`: "Nothing is captured until you approve the content."

This is the product's mechanics rendered as an object — it does not repeat the headline, which is exactly what the current hero card does wrong.

**Section order:**
1. Hero.
2. **What it costs you** — a full-bleed band (`--cd-radius-0`, `--cd-bg-element`) holding three facts as a horizontal ledger separated by 1px vertical rules, not cards: `$0 to post` / `$400 held when you accept` / `$340 to the creator`. Value in `data-lg`, one line of `body` under each. No icons.
3. **How it runs** (`#how-it-runs`) — three steps. This *is* a genuine sequence, so ordinals are legitimate — but not as `01/02/03` chips. A single vertical `--cd-accent` hairline runs down the left of the column with 8px coral squares (`--cd-radius-1`) at each step's cap-height; the number is the heading's first word, set in Archivo `wdth 88` at 0.75× the heading size: `1  Post a brief`. Single column, `--cd-space-7` between steps. It reads like a checklist taped inside the office door.
4. **Who this is for** — opens with a **full-bleed strip of real campaign tiles at full opacity**, cropped by the viewport edges (the artwork as information), then the 6-tile mosaic at mixed aspect ratios: 3 columns ≥1024 / 2 at 768–1023 / 1 below. This is the only mosaic on marketing, and it does the job the fake "feature bento" was faking: it shows the actual product.
5. **Why not an agency** — a two-column comparison table, `--cd-radius-0`, hairline rules, no cards. Rows: cost to start · commitment · who picks the creator · when money moves · what happens if the content is wrong. Local operators read tables; tables are honest and dense and completely un-templated.
6. **Creators are on iPhone** — one editorial row above a coral rule: short copy, link to `/get-the-app`, and the real iOS Discover mosaic rendered at true 375px width, cropped by the section's right edge. **No phone frame, no device mockup.**
7. **FAQ** — a definition list, not cards. Question in `h3`, answer in `body-lg`, 1px `--cd-border` rule between; two columns ≥1024.
8. **Closing** — a full-bleed `--cd-accent-fill` band with `--cd-on-accent` text, **left-aligned at the page measure**: one headline in `display`, one line, and the white button with coral text sitting inline after the line (not centered, not stacked in the middle). **This is the only saturated coral surface on the page.**

**Footer:** hairline top rule, wordmark left, links in one row, `small`, `--cd-text-secondary`.

### `/get-the-app`

**Thesis:** *The briefs are local and the money is real.* Dark, same identity, creator-facing.

Hero: `hero` headline, lead, the env-driven CTA (App Store link when `NEXT_PUBLIC_IOS_APP_URL` is set, otherwise the waitlist link), and the real iOS mosaic at 375px cropped by the viewport edge. Then: the six capabilities as a **two-column definition list** (term in `h3`, description in `body-lg`) — not six identical cards. Then the **creator's side of the slip**, mirroring the landing hero's object: `Accepted rate $400.00 / Platform fee (15%) −$60.00 / You receive $340.00 / Paid out through Stripe after the brand approves`. Then FAQ (same definition-list grammar), then the closing band. When the app is live, the Safari smart-app-banner metadata stays as it is.

### `/waitlist`

Two columns ≥900px. **Left:** the promise in `display` + lead, then "What happens next" as a 3-item timeline using the same coral-hairline device as the landing's steps (this genuinely is a sequence). **Right:** the form on `--cd-bg-raised`, `--cd-radius-4`; fields `--cd-radius-2`, 44px, `--cd-bg-selected` fill, 1px `--cd-border-strong` — this is the page where `--cd-border-strong` earns its existence.

Turnstile sits below the fields with `small` explanatory text, never as a surprise blocker.

**Success state** replaces the form panel in place (no route change, no confetti): a receipt-styled confirmation — position in `data-lg`, the referral code in `data` with a copy button, the share link, and one line about what happens next. Centered text is allowed here and nowhere else on the page.

### `/privacy`, `/terms`, `/support` — restrained

One column, 68ch, on `--cd-bg`. **No cards at all.** `h1` at the top, then `h2` sections each preceded by a full-measure 1px `--cd-border` rule. Body at `body-lg` / 1.7. Ordered/unordered lists get 1.5em hanging indents. At ≥1200px, a sticky table of contents sits in the left margin (`small`, `--cd-text-secondary`, current item `--cd-accent`) — no card, no border, just a column of links.

`/support` additionally opens with one level-1 block, `--cd-radius-3`: contact email, expected response window, and links to the two legal pages. That is the only surface on any legal page.

### `not-found`

Full-height `--cd-bg`, content **left-aligned** at the page measure — it is not a moment, it is a wrong turn. Brand mark, then `404` in Archivo `wdth 88 / 600` at 96px in `--cd-text-faint` (a legitimate non-text-critical use), then the headline in `h1`, one line of `body-lg`, and two links: "Go to the homepage" and the flag-aware access CTA. No illustration, no gradient.

### `/sign-in`, `/sign-up`

Split at ≥1000px. **Left 45%:** `--cd-bg`, the brand mark, a headline in `display`, one line of lead, and one real campaign tile on the bare canvas. **Right 55%:** a full-height `--cd-bg-element` panel with a 1px left `--cd-border`, the Clerk form vertically centered at 400px width. Below 1000px the left panel collapses to just mark + headline above the form.

- Sign-in headline: "Sign in to your campaigns." Sub-line points to sign-up or, in invite mode, to the access CTA.
- Sign-up headline: "Set up your brand account." In **invite mode**, a `--cd-warning-soft` note above the form: "Accounts are opening in batches. Request access and we'll email you when yours is ready." with the waitlist link — the form stays available for invited people.

**`lib/clerk-appearance.ts` must be rebuilt from `lib/design-tokens.ts`, not hand-typed hex** (today it is hardcoded `#0071e3` / `#ffffff` and will be unreadable in dark mode). Clerk derives shades from `colorPrimary`, so the `variables` block receives **literal hex imported from the token module** (dark and light objects); `elements` class strings may use `var(--cd-…)`. Two exported appearances, mapped as:
`colorPrimary: var(--cd-accent-fill)` · `colorBackground: var(--cd-bg-element)` · `colorInputBackground: var(--cd-bg-selected)` · `colorInputText: var(--cd-text)` · `colorText: var(--cd-text)` · `colorTextSecondary: var(--cd-text-secondary)` · `colorDanger: var(--cd-danger)` · `borderRadius: 6px` · `fontFamily: var(--cd-font-body)` · `fontSize: 15px`.
Elements: `card` transparent/no shadow/no radius; `socialButtonsBlockButton` `--cd-radius-2`, 48px, 1px `--cd-border-strong`; `formFieldInput` `--cd-radius-2`, 44px, `--cd-bg-selected`, 1px `--cd-border-strong`; `formButtonPrimary` `--cd-radius-2`, 44px, `--cd-accent-fill`, `--cd-on-accent`; `footerActionLink` `--cd-accent`; `headerTitle` in `display` type. **Verify against Clerk 7's appearance API before writing** — element keys move between majors.

### `/onboarding` — role choice

Two large choice panels side by side ≥760px, each ~1:1.2, level 1, `--cd-radius-3`. Each panel opens with a 16:9 cover-art strip seeded on a fixed string (`'brand'` / `'creator'`), so the two panels get two different, stable palettes and the screen introduces the artwork system on first contact.

- **"I'm hiring creators"** — three plain facts: posting is free · you're charged when you approve · our 15% comes out of the rate.
- **"I make content"** — "The creator experience lives in the iPhone app," and a note that choosing this takes you to `/get-the-app`.

Selected: border → `--cd-accent`, 2px inset ring, fill → `--cd-bg-selected`. During submission both panels disable and a 2px `--cd-accent` indeterminate rule appears under the chosen one. Errors render inline under the panels as `--cd-danger` body text, never as an alert.

### `/post-login`, `/sso-callback`

`/post-login` is a server redirect with no UI; ship a minimal fallback identical to `/sso-callback` in case it ever renders.

`/sso-callback` is the **only genuinely centered screen**: `--cd-bg`, brand mark, one line ("Signing you in…"), and a 2px `--cd-accent` progress rule that animates `width: 0 → 90%` over 2s `ease-out` and holds. Reduced motion → a static rule at 40%.

### `/brand` — dashboard home

**Thesis:** *What is waiting on you, and what it will cost.* **Delete the marketing headline** ("Build campaigns people want to reply to"). A workspace does not sell.

1. Admin banner slot.
2. **Page header:** `h1` "Dashboard", the brand's name below in `body`/`--cd-text-secondary`. Primary action "New campaign" right-aligned.
3. **The money strip** — one level-1 panel, `--cd-radius-3`, divided by 1px vertical rules into four cells: `Committed` · `Still owed` · `Charged` · `To creators`. Values in `data-lg`, labels in `label`, one `small` caption each — the `Charged` caption carries the fee (`incl. $37.50 platform fees`) so gross and net always appear as a pair (§8 rule 1). **One object, not four cards** — it is one balance sheet. This is the plan's assumption on the open net-vs-gross decision (`docs/BLOCKED-ON-JACKSON.md` #18): gross with an explicit fee line; approving artboard 3 resolves it.
4. **Needs you** — the most important list on the site. Rows: avatar, creator name, campaign, what is needed (`Application pending` / `Submission to review`), the money implication in `small` (`Accepting holds $425.00`), and the action button. Empty: "Nothing is waiting on you."
5. **Campaigns** — a **table**, not a card list. 72px rows: 56×40 cover-art thumb · title (`h3`) + niche (`small`) · budget (`data`, right) · deadline with ported `deadlineSignal` (coral when ≤3 days, "Closed" when passed) · applicants (`data`) · status pill · "Manage". Sticky header row, `--cd-radius-0`, bottom hairline, `label` type, sortable.
6. **Pipeline** — the funnel as horizontal bars: track `--cd-accent-soft`, fill `--cd-accent`, count in `data` right-aligned, plus one `small` line: "$700.00 still owed on accepted work." **Move the 14-day trend chart off this page** — it belongs on metrics.

### `/brand/metrics`

A report, not a dashboard. `h1` "Metrics".
1. **Money** — the five figures as one ruled table (label, value in `data`, caption), not five cards.
2. **From application to paid** — the funnel, full width.
3. **Applications, last 14 days** — bar chart: bars `--cd-accent`, 2px top radius, a single `--cd-text-faint` baseline rule, day labels in `small`. **No gridlines, no gradient fills, no dots, no tooltip library** (native `title` only).
4. **Decisions** — two breakdown lists side by side. Color carries meaning and only meaning: `--cd-success` accepted/approved · `--cd-danger` rejected · `--cd-warning` pending · `--cd-accent` volume.
5. **Campaign status mix** — one stacked horizontal bar, `--cd-radius-1`, with a legend beneath in `small`.

Empty state: "No campaigns, no metrics yet" in the standard empty pattern (§ below), left-aligned.

### `/brand/campaigns/new`

Two columns ≥1100px. **Left (7 cols):** the form in three level-1 panels — **The work** (title, description, objective, deliverables) · **Who and where** (niche, platforms, creators needed, target audience, creator requirements) · **Money and time** (budget, deadline, usage rights, call to action). Platform selection is a row of `--cd-radius-1` toggle chips; selected = `--cd-accent-soft` + `--cd-accent` + 1px `--cd-accent` border.

**Right (5 cols), sticky at `top: 96px`: the live brief preview.** The exact `CampaignTile` a creator will see in the app, rendered from the current form values (art seeded from a temporary client-side uuid held in state so it doesn't reshuffle on every keystroke), plus a money line recomputed on every budget change:

> **You are authorized for up to $500.00. A creator accepted at $500.00 receives $425.00 after the 15% fee.**

This preview is the reason the page is not a boring form, and it is true: the brand is literally authoring what appears in the iOS feed.

Fields: `--cd-radius-2`, 44px, `--cd-bg-selected`, 1px `--cd-border-strong`; focus → 2px `--cd-focus` outline at 2px offset + border `--cd-accent`. Errors: `--cd-danger` border + a `--cd-danger` message directly below the field. **No toasts.** Submit bar sticks to the bottom of the left column: `--cd-bg-element`, top hairline, primary + "Save as draft".

### `/brand/campaigns/[id]`

`h1` = campaign title with the status pill beside it. A 1200×200 cover-art header strip (`--cd-radius-3`) with the budget pill. Then:

- **Facts** — a definition table, hairline rows, values in `data`: budget · niche · platforms · deadline · creators needed · usage rights. **Not chips.** (Chips make six equal-weight facts look like tags; a table makes them look like terms.)
- **Brief** — the description at 68ch, `body-lg`, preserved line breaks.
- **Structured brief** — a two-column definition list, term in `label`, value in `body`. No nested cards.
- **Applications** — applicant **rows** (§5). For a pending application, "Accept" opens an inline confirmation panel (grid-row expand) on `--cd-accent-soft` with a 2px `--cd-accent` left rule, which states the money **before** the button:

  > Accepting authorizes **$425.00** on your card now. You are charged when you approve the content. **Marcus Ilagan receives $361.25.**

  Buttons: `Accept and hold $425.00` (primary) and `Decline` (ghost, with an inline confirm step). This is the money moment on the whole site — it gets the accent ground, and nothing else on the page does.

### `/brand/campaigns/[id]/applications` — review workspace

Two panes ≥1100px. **Left rail 320px:** accepted creators as a selectable list with avatar, name, rate, and submission status; selected row gets `--cd-bg-selected` + a 2px `--cd-accent` left bar. **Right pane:** the selected submission — content preview (uploaded file thumbnail at 16:9 `--cd-radius-3`, plus the live link; a URL failing `isAllowedContentUrl` renders as plain `--cd-text-faint` text with a `--cd-warning` note, **never as a link**), the creator's notes, revision history if any, and a decision bar pinned to the bottom of the pane (`--cd-bg-element`, top hairline):

- **`Approve and pay $400.00`** — primary, `--cd-accent-fill`. The button carries the number.
- `Request a revision` — ghost; opens an inline textarea, **not a modal**.
- `Decline` — ghost with `--cd-danger` text, two-step confirm.

Below the bar, `small`: "Approving captures the $400.00 hold and releases $340.00 to Ana Reyes."

Below 1100px the rail becomes a horizontal scroller above the pane.

### `/brand/applications`, `/brand/submissions`

One table each, same grammar as the campaigns table. Filter chips above (`--cd-radius-1`; active = `--cd-accent-soft` + `--cd-accent` + 1px `--cd-accent` border), plus a count in `small`.

- **Applications** columns: creator · campaign · proposed rate (`data`, right) · applied (relative) · status · action.
- **Submissions** columns: creator · campaign · submitted · content · status · review action.

An empty table renders a single full-width row containing the standard empty pattern — not a separate card above the table.

### `/brand/settings`

A single 680px column. One level-1 panel per group, `--cd-radius-3`, containing `--cd-radius-0` definition rows (label left `--cd-text-secondary`, value right `--cd-text`, hairline between): **Account** (name, email, role) · **Appearance** (theme: system / light / dark — a 3-way segmented control, `--cd-radius-2`) · **Payments** (Stripe status) · **Role** (the change-role control when eligible; when not eligible, state the reason as body text — "You have 3 campaigns, so the account type is locked" — never a disabled button with a tooltip).

### Empty states — one pattern everywhere

**No dashed borders. No gradient icon disc.** Level-1 panel, `--cd-radius-3`, with a 2px `--cd-border-strong` left rule. Inside, left-aligned: `h3` heading, one sentence of `body` naming *what will appear here and what to do*, one primary action. Examples:

- "No campaigns yet. Post a brief and creators near you can apply with their rate." → `Post a campaign`
- "No applications yet. Applications show up here within a day or two of a brief going live."
- "Nothing is waiting on you." (no action — this one is good news)

### Skeletons

Every skeleton mirrors its real layout exactly — same block heights, same column widths, same radii, same gaps — using `--cd-bg-selected` and the opacity pulse from §6. A generic stack of grey bars is not acceptable; a wrong-shaped skeleton causes a layout jump that reads as jank.

### Admin banners — obvious, on-brand

Both are **system bands**, not cards. They use our tokens and our type, and they are the only warning-colored surfaces in their context.

- **`AdminPreviewBanner`** (public pages): full-bleed, `--cd-radius-0`, 40px tall, `--cd-warning-soft` ground, `--cd-warning` text, `border-top: 2px solid var(--cd-warning)`, `small` type. Sits **above** the nav and pushes content down — never overlays. Right-aligned "Back to Ops" link, underlined.
- **`AdminViewBanner`** (dashboard): same colors and type, but `--cd-radius-3` and full-column width to match the panels it sits above. The viewed account's email renders in `data` (Archivo condensed tabular) so it reads as a system value rather than prose, with a `Read-only` pill (`--cd-radius-1`, `--cd-warning-soft`) at the right. The "account not found" variant swaps to `--cd-danger-soft` / `--cd-danger`.

---

## 8. Copy direction

**Voice.** A good operator talking to another operator. Short sentences. A number wherever a number exists. Second person for the brand ("your card", "you approve"). Name the creator when we know them. Sentence case everywhere, including buttons. No exclamation marks. Banned words: empower, seamless, unlock, supercharge, effortless, elevate, journey, magic, revolutionize, "the future of". Errors state what happened and what to do; they do not apologize. Empty screens are invitations, not moods.

### Three hero headline options

**A.**
> **Post a brief. Hold the money. Pay when you approve.**
> Local creators apply with the rate they want. Accepting puts a hold on your card; approving the content is what charges it. Our 15% comes out of that rate, never on top of it.

**B.**
> **Nothing is charged until the content is good.**
> Posting a brief is free. Creators near you apply with a pitch and a rate. Accept one at $400 and $400 is held; approve their work and $400 is charged, $340 of it to the creator.

**C.**
> **The creators are already in your neighborhood.**
> Say what you need and what you can spend. Nearby creators apply with a pitch and a rate. You hold the money when you accept them, and you pay it when you approve the work.

All three are true to the mechanics, name the fee correctly, and avoid a single accented word.

### CTA labels

| Slot | `MARKETPLACE_ACCESS=invite` (today) | `=open` (after Stripe is live) |
|---|---|---|
| Nav | `Request access` → `/waitlist` | `Get started` → `/sign-up` |
| Hero primary | `Request access` → `/waitlist` | `Create your brand account` → `/sign-up` |
| Hero secondary | `See how it runs` → `/#how-it-runs` | same |
| Closing band | `Request access` → `/waitlist` | `Post your first brief` → `/sign-up` |
| Sign-up page note | "Accounts are opening in batches. Request access and we'll email you when yours is ready." | (not rendered) |
| 404 | `Request access` | `Create your brand account` |
| `/get-the-app` | `Get early access` → `/waitlist` (or `Download on the App Store` when `NEXT_PUBLIC_IOS_APP_URL` is set) | unchanged — this is creator-side and governed by the iOS env vars, not `MARKETPLACE_ACCESS` |

All of these come from `lib/access-cta.ts`. The referral query params must survive the hop, exactly as `PublicWaitlistLink` does today.

### Microcopy rules for money — mandatory

1. **Always show the pair.** Wherever a rate appears next to an action, show what the brand pays *and* what the creator nets: `$400.00 charged · $340.00 to Ana Reyes`.
2. **The fee is "out of", never "plus".** Always: "15% platform fee, taken out of the rate." Never: "+15%", "plus fees", "excluding fees".
3. **Money buttons carry the number.** `Accept and hold $425.00`. `Approve and pay $400.00`.
4. **Fixed vocabulary, never mixed.** Accept ⇒ *authorize* / *hold*. Approve ⇒ *capture* / *charge* / *pay*. Decline ⇒ *nothing is charged*. Revision ⇒ *the hold stays in place*. The same action keeps the same word from marketing copy through to the toast.
5. **`formatCents` everywhere, tabular, right-aligned in tables, never abbreviated.** No `$1.2k` on web — the compact format is a mobile-tile affordance and it stays there.
6. **The fee line uses a real minus sign (U+2212) and `--cd-text-secondary`, never `--cd-danger`.** The fee is not an error.
7. **There is no number that adds the fee on top, so never render one.** If a design needs a "total", the total is the accepted rate.
8. Amounts in prose keep cents (`$400.00`) when they appear next to another amount, and drop them (`$400`) only in headline and marketing prose where they stand alone.

---

## 9. Anti-template checklist

A reviewer agent runs these against the **redesign-owned file list** (`scripts/design-gate.sh` carries the allowlist: `app/styles/**`, `components/**`, every page and shell a work package owns, `lib/clerk-appearance.ts`, `lib/stripe-appearance.ts`) — **never** against `app/globals.css`, `app/(dashboard)/creator/**` or `app/internal/**`, which are frozen and would fail every rule by construction. Rules are **absolute zero for files the redesign creates** and a **ratchet against the Wave-0 baseline** for pre-existing in-scope files (the count may only fall, and must reach zero by the Phase 2 gate). Greppable checks give the command; the rest are eyeball checks with an explicit pass condition.

1. **No glass.** `grep -rn "backdrop-filter\|backdrop-blur" app/` → 0 hits.
2. **No blur.** `grep -rn "filter:\s*blur\|blur(" app/` → 0 hits.
3. **No orbs / radial washes.** `grep -rn "radial-gradient" app/` → 0 hits.
4. **Gradients are rationed.** `grep -rn "linear-gradient" app/ components/` → hits only in `components/ui/cover-art.tsx` and the art strip's edge mask. **Max one gradient-bearing element per viewport** outside cover art.
5. **Radii are from the scale.** `grep -rnE "border-radius:\s*(1[89]|2[0-9]|3[0-9]|40)px" app/` → 0 hits. `grep -rn "999px\|9999px" app/` → only `.avatar` and `.status-dot`.
6. **No shadows on dark surfaces below level 3.** `grep -rn "box-shadow" app/` → every hit is `--cd-elev-2` (light theme), `--cd-elev-3`, or the focus ring.
7. **No shouting labels.** `grep -rn "text-transform:\s*uppercase" app/` → 0. `grep -rnE "letter-spacing:\s*0?\.0[3-9]em|letter-spacing:\s*\.[1-9]" app/` → 0.
8. **No eyebrows.** `grep -rn "eyebrow" app/` → 0 hits; the class must not exist in the stylesheet.
9. **No `01/02/03`.** `grep -rn "'0[1-9]'" app/` → 0 step-marker hits. Step numbers are plain digits inside heading text.
10. **No emoji** in any JSX text node or CSS `content` under `app/**` (eyeball + a unicode-range grep).
11. **No arrows in labels.** `grep -rn "→\|←\|↦" app/` → 0 hits in button/link text. (The metric-trend indicators use `--cd-success`/`--cd-danger` colored words plus a 6px triangle glyph rendered as a CSS border, not `↑`/`↓`.)
12. **No 3-item middot meta strings** on marketing pages. `grep -rn " · " app/ components/` → hits only in the two-value money pair (`$X charged · $Y to Name`) and in table cells that genuinely join exactly two values. Three-or-more joined fragments are a fail; use columns (the campaign tile's meta row is two columns for exactly this reason).
13. **No scroll-triggered anything.** `grep -rn "IntersectionObserver\|animation-timeline\|data-aos\|scroll-behavior" app/` → 0 hits.
14. **No monospace.** `grep -rni "monospace\|ui-monospace\|font-mono\|Mono'" app/` → 0 hits. Money uses Archivo condensed tabular.
15. **Nothing wide is centered.** `grep -rn "text-align:\s*center\|textAlign: 'center'" app/` → hits only on `/sso-callback`, the waitlist success panel, and elements narrower than 480px.
16. **No SaaS card kit.** On any marketing page, three or more sibling elements must not share identical padding + radius + border + background. Marketing structure is tables, definition lists and ruled rows. (Eyeball; pass condition = at most two such sibling sets on the whole landing page, and the mosaic tiles do not count because their geometry varies.)
17. **No hover levitation.** `grep -rn "hover" app/` → no rule containing `translateY`, `translate3d`, `scale(1.0`, or a shadow change on `:hover`.
18. **No color literals in components.** `grep -rnE "#[0-9a-fA-F]{3,8}\b|rgba?\(" app/ --include=*.tsx` → 0 hits, except `app/icon.tsx` and the three `opengraph-image.tsx` files, which must import from `lib/design-tokens.ts` rather than inlining (so a grep for `import.*design-tokens` in those four files must succeed).
19. **Inline styles are geometry only.** `grep -rn "style={{" app/ --include=*.tsx` → every remaining hit assigns a CSS custom property (`'--x': …`) or a computed dimension/transform derived from data. No colors, no typography, no spacing literals. (Today there are dozens of inline color/type declarations; all of them go.)
20. **One saturated coral surface per page.** Eyeball: the landing has exactly one `--cd-accent-fill` background band; a dashboard screen has coral only on its single primary button (plus the accept-confirmation panel's `--cd-accent-soft`, which is a wash, not a fill).
21. **Old faces are gone.** `grep -rni "Inter\b\|Space Grotesk\|Plus Jakarta\|Manrope\|DM Sans\|Playfair" . --include=*.ts --include=*.tsx --include=*.css --exclude-dir=node_modules` → 0 hits.
22. **Blue is never an action.** `grep -rn "\-\-secondary" app/` → hits only on informational chips, in-copy links, and the "Revision requested" status. Zero button, CTA, or focus-ring usage.
23. **No tinted-black stand-ins.** `grep -rn "#0b0b0b\|#111\b\|#0a0a0a\|#1a1a1a" app/` → 0 hits. The only near-blacks are `--cd-bg`, `--cd-bg-element`, `--cd-bg-raised`, `--cd-bg-selected`.
24. **The theme cascade is intact.** `app/styles/tokens.css` defines the **complete** dark palette on `:root, [data-theme="dark"]`, the complete light palette on `[data-theme="light"]`, and the light palette again under `@media (prefers-color-scheme: light) :root:not([data-theme="dark"]):not([data-theme="light"])`. No color has its only definition inside a media query. `body:has(.cd-app)` sets an explicit token background; `lib/design-tokens.css.test.ts` proves all three blocks carry every token.
25. **The contrast test exists and passes.** `lib/design-tokens.contrast.test.ts` is present, derives ratios from the tokens (not hard-coded), and covers all ten pair groups from §2.
26. **The cover-art parity test exists and passes.** `lib/cover-art.parity.test.ts` proves web and mobile produce identical specs.
27. **No shimmer.** `grep -rn "shimmer" app/` → 0 hits; skeletons animate opacity only.
28. **Reduced motion is honored.** `grep -rn "prefers-reduced-motion" app/` → at least one block, and every `animation` / `transition` declaration in the stylesheet is inside a selector that block neutralizes.

---

## 10. Mockup artboard spec (Phase 1)

**Deliverable:** one design canvas (the `design` skill's multi-artboard canvas, published as an Artifact) of real HTML artboards — each a self-contained `.dc.html` file under `docs/web-redesign-2026-09/mockups/`, laid out by `canvas.json`. Real fonts loaded from the Google CSS2 URLs in §3, real token values from §2 written inline (a static artboard has no stylesheet pipeline, so hex literals and inline styles are **expected** here and the source gate is not run on this directory), real cover art from a ported `coverArtSpec`. Static HTML/CSS only, no framework, no app imports. Every artboard must be a *faithful preview of what Phase 2 will build*, not a sketch. Work package **WP-00** in `00-PLAN.md` owns this.

### Shared fixture content (use these exact values on every artboard)

**The brand persona: Ferrous Coffee — Bushwick, Brooklyn.**

Campaigns:
| Title | Niche | Budget | Status | Applicants | Deadline |
|---|---|---|---|---|---|
| Saturday brunch reels | Food | $400 | Active | 6 | 3d left |
| New cold brew tasting | Food | $300 | In progress | 4 | 12d left |
| Holiday hours announcement | Lifestyle | $250 | Complete | 1 | Closed |

Money (internally consistent — check every figure against these):
Committed **$950.00** · Still owed **$700.00** · Charged **$250.00** (incl. $37.50 platform fees) · To creators **$212.50**.
Ana Reyes accepted at **$400.00** → net **$340.00** (fee $60.00). Deshawn Pope accepted at **$300.00** → net **$255.00** (fee $45.00). Lucia Marchetti paid at **$250.00** → net **$212.50** (fee $37.50). Pending applicant Marcus Ilagan asks **$425.00** → net **$361.25** (fee $63.75).

Other local brands for the marketing mosaic:
| Brand | Campaign | Niche | Rate | Signal |
|---|---|---|---|---|
| Iron & Oak Strength — Sacramento, CA | 6am class energy, 3 clips | Fitness | $650 | 1 spot · 9d left |
| Wildflower Nail Studio — Portland, OR | Fall set showcase | Beauty | $275 | 3 spots · **Ends in 6h** (urgent badge) |
| Casa Duarte Home Services — Mesa, AZ | Before/after AC tune-up | Lifestyle | $500 | 1 spot · 5d left |
| Terrapin Bikes — Asheville, NC | Weekend trail loop | Lifestyle | $350 | 2 spots · New |
| Norr Boutique — Minneapolis, MN | Winter drop lookbook | Fashion | $900 | 2 spots · 14d left |
| Ferrous Coffee — Bushwick, NY | Saturday brunch reels | Food | $400 | 2 spots · 3d left |

All CTAs render in **invite mode** (`Request access` → `/waitlist`), with the open-mode label shown as an annotation beside the CTA, not as a second button.

### Artboards

| # | Artboard | Frame | Contents |
|---|---|---|---|
| 1 | `Main.dc.html` (landing, 1440) | 1440 × full scroll height, dark | The complete landing page with **Hero variant B**: nav, full-measure headline, lead + CTAs beside the slip, "what it costs you" band, "how it runs", the full-bleed art strip + 6-tile mosaic, the agency comparison table, the creators/iPhone row, FAQ, the left-aligned coral closing band, footer. |
| 1b | `HeroA.dc.html` | 1440 × 900, dark | The hero region only, **Variant A** (copy `1/span 7`, slip `8/span 5`) — the alternative the owner is choosing against. |
| 2 | `Landing390.dc.html` | 390 × full height, dark | The same page at iPhone width — hero stacks (slip below copy), mosaic single-column, the comparison table becomes stacked pairs, nav collapses to mark + CTA. |
| 3 | `Dashboard.dc.html` | 1440 × full height, **dark** | `/brand` home: sidebar, page header, the money strip (`Committed · Still owed · Charged · To creators`), "Needs you" (2 items), the campaigns table with cover-art thumbs and the urgent-deadline treatment, the pipeline bars. Include the `AdminViewBanner` at the top so its on-brand-but-obvious treatment can be judged. |
| 4 | `DashboardLight.dc.html` | 1440 × full height, **light** | Byte-for-byte the same markup with `data-theme="light"`. Light mode is a deliverable, not a promise. |
| 5 | `SignIn.dc.html` | 1440 × 900, dark | `/sign-in` split screen, with a **static faithful rendering** of the Clerk form (social buttons, divider, email field, primary button, footer link) styled with the §7 appearance mapping — not the live widget. |
| 6 | `Tokens.dc.html` | 1200 × full height | The specimen sheet: both palettes side by side, every swatch labelled with its hex and its **computed ratio against its intended ground**; the full type scale set in real Archivo/Schibsted at real sizes with the axis settings printed; the radius scale; the elevation levels in both themes; the money microcopy examples; a 32-cell grid of all 8 cover-art palettes × 4 patterns; and the brand-mark decision (below). |

### What the owner is being asked to approve on each

1. **`landing-1440`** — the hero risk (shopfront-scale expanded type + the receipt slip instead of a repeated-copy card); the decision to use tables and definition lists instead of card grids; the single left-aligned coral closing band; the full-bleed art strip as content rather than atmosphere; **which hero variant (A on artboard 1b, B on artboard 1)**.
2. **`landing-390`** — that the hero still lands when the slip drops below the fold; that the mosaic reads at one column.
3. **`dashboard-1440`** — that the marketing headline is gone; the money strip as one object; "Needs you" ranked above "Campaigns"; the campaigns *table* over a card list; the sidebar without the "System feel" filler.
4. **`dashboard-1440-light`** — that light mode is a real, shippable workspace and not an afterthought.
5. **`auth-1440`** — the Clerk retokenization (dark, coral, 6px radii) and the split-screen framing.
6. **`tokens.html`** — the two typefaces and the scale; the radius philosophy (rectangles, not pills); the two new tokens (`--cd-bg-raised`, `--cd-text-faint`) and the two alpha divergences from mobile (`--cd-accent-soft`); the `--cd-text-faint` demotion to non-text; the money microcopy formats; and the brand-mark decision.

Phase 1 ends with the owner's comments on these seven artboards (six plus the hero alternative). Phase 2 does not start on any page whose artboard was not approved.

---

## Guess list — what was unclear, and what I guessed

1. **Whether the owner wants the marketing site forcibly dark even when the OS is light.** The brief says "the marketing site is dark-first" and "the dashboard must also ship a working light mode." I interpreted that as: marketing and auth stamp `data-theme="dark"` unconditionally; the dashboard follows `prefers-color-scheme` with a settings override. If Jackson wants marketing to follow the OS too, §2's stamping rule and artboards 1–2 change.
2. **`--cd-text-faint` is unfixable as a text color in light mode.** To clear 4.5:1 on `#eef2f8` it would have to be essentially as dark as `--cd-text-secondary` (4.63:1), leaving no room for a third tier. I resolved this by demoting `--cd-text-faint` to a non-text (≥3:1) token and routing all caption text to `--cd-text-secondary`. That is a real behavioral change to many existing captions, and it deserves a yes/no from the owner rather than being buried in a token table.
3. **The `--cd-accent-soft` alphas diverge from mobile** (dark 0.16 → 0.10, light 0.10 → 0.06). Mobile's wash is explicitly rated icon-only at 3:1; the web needs accent-colored *text* on it for status pills, which mobile's alphas do not support (4.24:1 worst case). I changed alpha only — same hue, same base color. If the owner would rather keep pixel-identical alphas and introduce a second token, that is a defensible alternative I did not take.
4. **`--cd-bg-raised` is invented.** Mobile has three background levels; the brief asked for four. I proposed `#171a22` in dark and, in light, deliberately kept it equal to `--cd-bg-element` with elevation carried by shadow. The light-mode collapse is a design argument, not a measurement, and the owner may want four distinct light fills instead.
5. **Typeface pairing is a judgment call I cannot A/B here.** I verified both families load from Google Fonts (HTTP 200) and that `next/font/google` in the installed Next exposes `Archivo` with `axes: ['wdth']` and `Schibsted_Grotesk` (weights 400–900, no width axis). I have *not* seen them rendered together — Archivo Expanded vs Schibsted Grotesk could read as too similar at small sizes. Artboard 6 exists specifically to test that, and a Plan B display face should be identified if it fails.
6. **Clerk 7's `appearance` element keys.** I specified the mapping conceptually and reused the element names already in `lib/clerk-appearance.ts`, but I did not verify them against Clerk 7's current API, and I did not verify that Clerk's `variables` accept `var(--…)` references rather than resolved colors. If they do not, the appearance object must be built in a client component that reads the computed values. Flagged for the build agent.
7. **OG image fonts.** `ImageResponse` cannot use `next/font`, so I specified committed static subsets under `app/_fonts/`. I did not read `node_modules/next/dist/docs/` for this Next version's exact font-loading API for OG routes (AGENTS.md warns this version has breaking changes) — the build agent must.
8. **The brand mark.** Changing a logo is above a design brief's pay grade, so I surfaced it as a decision on artboard 6 rather than deciding it. But "D" in Arial in `app/icon.tsx` and `.brand-mark` is genuinely the weakest element in the identity and will undercut everything else.
9. **Real applicant/creator data shape.** I designed the "Needs you" list and the review workspace from the Prisma includes visible in the pages I read. I did not read the Prisma schema, so fields I assumed exist (creator handle, platform, submission file thumbnails, revision history) may not. Where a field turns out not to exist, **fall back to what the data supports and do not invent social proof** — the same rule `mobile/src/lib/campaign-signals.ts` already states.
10. **The four files the other live sessions have touched** (`sign-in`, `sign-up`, `campaigns/[id]/applications`, `submissions`, `WaitlistForm`) — I read them as they stand now. My §7 concepts for those pages describe the *target*, not a diff against current content, precisely so they survive whatever those sessions commit. If one of those sessions deletes the auth CSS from `globals.css`, nothing in this brief breaks, because the brief replaces that stylesheet wholesale.
11. **`/brand/campaigns/new` sticky preview seeding.** The live preview needs a stable id before the campaign exists. I specified a client-side uuid held in state; if the team prefers a server-generated draft id, the preview art changes on save unless the same id is used at creation. Worth deciding before the build.
12. **Whether the campaigns table should be sortable in v1.** I specified sortable headers because a brand with 20 campaigns will want it, but the current page has no sort and adding it is scope. Cut it if the owner wants a smaller Phase 2.