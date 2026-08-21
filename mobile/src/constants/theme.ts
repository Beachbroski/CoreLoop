/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

// Mobile deliberately diverges from web here (approved 2026-08): coral is the
// hero accent — buttons, money, highlights — with the old web blue demoted to
// `secondary` for informational chips. Dark is the flagship appearance.
//
// EVERY RATIO IN THIS FILE IS COMPUTED, NOT GUESSED — and since 2026-08 it is
// also ENFORCED. `theme.contrast.test.ts` re-derives every number below from
// these tokens (WCAG relative luminance, plus alpha compositing for the `*Soft`
// fills) and fails if one drifts. The first pass of this block documented the
// coral arithmetic beautifully and the semantic tokens still rotted, because a
// comment cannot fail a build. The comments explain WHY; the test keeps it true.
//
// Coral carries two jobs that need opposite luminances, so they are two tokens
// (WCAG AA, 4.5:1 for normal text):
//
//   `accent`      — coral as FOREGROUND: text, icon tints, focus rings, the tab
//                   bar's active tint. Must be dark enough to sit on our light
//                   surfaces. Light #bf3524 scores 5.60:1 on #ffffff, 5.22:1 on
//                   #f5f7fb, 4.98:1 on #eef2f8. Dark #ff503d is unchanged — it
//                   already clears AA on every dark surface (6.17 / 5.66 / 5.13).
//   `accentFill`  — coral as a SURFACE that carries white text: primary buttons,
//                   the tile price pill, the active category chip. Must be dark
//                   enough that #ffffff on it clears 4.5:1, which the foreground
//                   coral does not (white on #ff503d is only 3.25:1). Light
//                   #d83e2a = 4.52:1, dark #d64131 = 4.51:1 against white.
//   `accentStrong`— the pressed state of `accentFill`; still white-text safe
//                   (light 5.42:1, dark 5.41:1).
//   `onAccent`    — the label that rides ON `accentFill` / `accentStrong`:
//                   button text, the price-pill number, the loading spinner.
//                   #ffffff in both schemes, because both fills were picked
//                   precisely so white clears AA on them (the four ratios
//                   above). Seven screens hard-coded '#ffffff' for this, which
//                   meant the pairing was invisible to any audit; the token
//                   gives them one name so the test can watch it.
//   `accentSoft`  — coral as a 10%/16% WASH behind an accent-tinted ICON (the
//                   empty-state and upload-tile circles). Icons are non-text,
//                   so the bar is 3:1, and `accent` over this wash clears it
//                   everywhere (light 4.88 / 4.57 / 4.37, dark 5.28 / 4.72 /
//                   4.24). It is NOT rated for text — nothing puts text there.
//
// SEMANTIC TOKENS — `warning`, `success`, `secondary`, `danger`. These render
// as 14px/500 and 16px/500 text, so the bar is a flat 4.5:1, and they are read
// against SIX backgrounds each, not one:
//
//     raw  on background / backgroundElement / backgroundSelected
//     over its own `*Soft` fill composited on each of those three
//
// The `*Soft` case is the one that used to be missed. A status pill is its soft
// fill, and that fill lands on `backgroundElement` in a card, on `background` in
// a stale banner, and on `backgroundSelected` the moment an activity row is
// pressed — the last of which is always the worst pairing, because compositing
// a wash over the lightest surface moves the surface TOWARD the text in light
// mode and AWAY from it in dark mode. Every value below is sized against that
// worst case, so the comfortable cases come free.
//
// Only luminance moved. Hue is held to within 0.2° of the previous value on
// every token, and saturation within 0.5 points; these are the same colors,
// dimmed or lifted. What changed (worst-case ratio before → after):
//
//   light warning   #c8811a → #8d5b12   2.52 → 4.58   (L 44.3% → 31.2%)
//   light success   #0d9f6e → #0a7551   2.71 → 4.58   (L 33.7% → 24.9%)
//   light secondary #1371ff → #005be4   3.41 → 4.56   (L 53.7% → 44.7%)
//   light danger    #e11d48 → #c2193e   3.59 → 4.58   (L 49.8% → 42.9%)
//   dark  secondary #3b82f6 → #5895f7   3.69 → 4.56   (L 59.8% → 65.7%)
//   dark  danger    #f4436c → #f55b7f   4.01 → 4.57   (L 61.0% → 65.9%)
//   light textSec.  #667085 → #636d82   4.43 → 4.63   (L 46.1% → 44.9%)
//
// (`textSecondary` is in that list because it is the StatusPill's fallback text
// for an unrecognised status, sitting on `backgroundSelected` — 4.43:1, missed
// by the same blind spot. Three RGB units fixed it; it is not a visible change.)
//
// Dark `warning` and `success` were already clear by a wide margin (6.04 and
// 6.65 worst case) and were left exactly as designed.
//
// The `*Soft` alphas did NOT move, and the color inside each `*Soft` is still
// the ORIGINAL, brighter token — e.g. `warningSoft` is still built from the old
// amber #c8811a, not from the new #8d5b12. That is deliberate, and it is the
// same trick `accentSoft` has always used (its base #e0402c is neither `accent`
// nor `accentFill`). The wash and the text want opposite things: the wash needs
// to stay bright to read as "amber," the text needs to go dark to be legible on
// it. Rebuilding the wash from the darkened token would produce a muddy fill AND
// a lower ratio — worse on both axes. Lowering the alphas instead of darkening
// the text was also measured and rejected: reaching 4.5:1 that way needs alpha
// ≈ 0.01–0.02, at which point the pill is invisible and stops being a pill.
export const Colors = {
  light: {
    text: '#101828',
    textSecondary: '#636d82',
    background: '#f5f7fb',
    backgroundElement: '#ffffff',
    backgroundSelected: '#eef2f8',
    border: 'rgba(15, 23, 42, 0.08)',
    borderStrong: 'rgba(15, 23, 42, 0.48)',
    accent: '#bf3524',
    accentFill: '#d83e2a',
    accentStrong: '#c33625',
    accentSoft: 'rgba(224, 64, 44, 0.1)',
    onAccent: '#ffffff',
    secondary: '#005be4',
    secondarySoft: 'rgba(19, 113, 255, 0.1)',
    success: '#0a7551',
    successSoft: 'rgba(13, 159, 110, 0.1)',
    warning: '#8d5b12',
    warningSoft: 'rgba(200, 129, 26, 0.12)',
    danger: '#c2193e',
    dangerSoft: 'rgba(225, 29, 72, 0.1)',
  },
  dark: {
    text: '#f7f8fa',
    textSecondary: '#9ba1ae',
    background: '#07080b',
    backgroundElement: '#12141b',
    backgroundSelected: '#1b1e27',
    border: 'rgba(255, 255, 255, 0.1)',
    borderStrong: 'rgba(255, 255, 255, 0.36)',
    accent: '#ff503d',
    accentFill: '#d64131',
    accentStrong: '#c03a2c',
    accentSoft: 'rgba(255, 80, 61, 0.16)',
    onAccent: '#ffffff',
    secondary: '#5895f7',
    secondarySoft: 'rgba(59, 130, 246, 0.16)',
    success: '#2dd4a8',
    successSoft: 'rgba(45, 212, 168, 0.14)',
    warning: '#f0a93a',
    warningSoft: 'rgba(240, 169, 58, 0.16)',
    danger: '#f55b7f',
    dangerSoft: 'rgba(244, 67, 108, 0.14)',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

// TWO border tokens, because one token cannot honestly do both jobs.
//
// `border` is DECORATION: the hairline under the tab bar, the outline around a
// card, the rule between OAuth buttons and the email form. WCAG 1.4.11 does not
// apply to it — none of those components is *identified* by its outline (a card
// is identified by its fill, a divider carries no state), and 1.4.11 exempts
// what is purely decorative. It stays at 0.08 / 0.10 alpha (1.18:1 light,
// 1.31:1 dark) because that is the whisper the design asked for, and dragging
// every hairline in the app up to 3:1 would armor-plate the layout.
//
// `borderStrong` is a CONTROL BOUNDARY: text inputs, which draw a 1px outline
// and nothing else — no fill change, no underline, no label chrome. There the
// outline IS the affordance, 1.4.11 applies, and 1.18:1 meant the fields read
// as borderless. Alpha is sized so the composited line clears 3:1 against BOTH
// the field's own fill and the page behind it:
//
//   light rgba(15, 23, 42, 0.48) → #8c9099 on #ffffff (3.21:1),
//                                  #878b97 on #f5f7fb (3.16:1),
//                                  #838995 on #eef2f8 (3.13:1)
//   dark  rgba(255, 255, 255, 0.36) → #606163 on #07080b (3.23:1),
//                                     #67696d on #12141b (3.33:1),
//                                     #6d6f75 on #1b1e27 (3.31:1)
//
// That lands the light value next to Material 3's `outline` (#79747e, 3.4:1 on
// white), which is the same decision made for the same reason. Adopting it in
// the input components is a separate change; this file only supplies the token.
//
// Rule of thumb: if removing the line would leave the user unable to tell where
// to tap or type, use `borderStrong`. Otherwise use `border`.

// The logo mark's color (app/globals.css .brand-mark: #ff503d) — fixed
// regardless of light/dark mode. With coral promoted to `accent`, Brand is
// kept for the mark itself and for places that must stay coral even if the
// accent ever changes again.
export const Brand = {
  coral: '#ff503d',
  coralStrong: '#e63f2d',
  coralSoft: 'rgba(255, 80, 61, 0.12)',
} as const;

// Gradient stops for hero surfaces (buttons, avatar rings, earnings glow).
// Cover-art palettes live in lib/cover-art.ts so they stay unit-testable.
// coralHero carries the white avatar initial (32px — large text, 3:1), so its
// light stop is capped at 3.11:1 against #ffffff; the old #ff6a58 was 2.82:1.
export const Gradients = {
  coralHero: ['#f36453', '#e63f2d'],
  coralGlow: ['rgba(255, 80, 61, 0.22)', 'rgba(255, 80, 61, 0)'],
} as const;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

// `twoHalf` (12) exists because the scale jumps 8 → 16 and the layouts kept
// landing in the gap: sixteen call sites reach for arithmetic (`Spacing.three - 4`,
// `Spacing.two + 2`) rather than a name, and a value nobody can name is a value
// nobody keeps consistent.
//
// On the name: the ordinals are POSITIONS in this scale, not multipliers —
// `one` is 4 but `three` is 16, so "index × 4" already breaks at `three`. That
// makes inserting a step a naming problem rather than an arithmetic one: 12 sits
// between `two` and `three` and there is no free ordinal there. Renaming the
// existing keys is off the table (every screen imports them), so the step is
// named for where it sits — `twoHalf`, "two and a half". That does read
// awkwardly next to `half` (2), which means "half of `one`"; two conventions
// now share one object. It is the lesser cost: the call sites are unambiguous
// (`Spacing.half` is a hairline, `Spacing.twoHalf` is a gutter), whereas a
// rename would touch every screen for the sake of tidiness.
export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  twoHalf: 12,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
