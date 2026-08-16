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
// Coral carries two jobs that need opposite luminances, so they are two tokens
// (WCAG AA, 4.5:1 for normal text — every ratio below is computed, not guessed):
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
//
// Only luminance moves — the hue is the same coral in every token.
export const Colors = {
  light: {
    text: '#101828',
    textSecondary: '#667085',
    background: '#f5f7fb',
    backgroundElement: '#ffffff',
    backgroundSelected: '#eef2f8',
    border: 'rgba(15, 23, 42, 0.08)',
    accent: '#bf3524',
    accentFill: '#d83e2a',
    accentStrong: '#c33625',
    accentSoft: 'rgba(224, 64, 44, 0.1)',
    secondary: '#1371ff',
    secondarySoft: 'rgba(19, 113, 255, 0.1)',
    success: '#0d9f6e',
    successSoft: 'rgba(13, 159, 110, 0.1)',
    warning: '#c8811a',
    warningSoft: 'rgba(200, 129, 26, 0.12)',
    danger: '#e11d48',
    dangerSoft: 'rgba(225, 29, 72, 0.1)',
  },
  dark: {
    text: '#f7f8fa',
    textSecondary: '#9ba1ae',
    background: '#07080b',
    backgroundElement: '#12141b',
    backgroundSelected: '#1b1e27',
    border: 'rgba(255, 255, 255, 0.1)',
    accent: '#ff503d',
    accentFill: '#d64131',
    accentStrong: '#c03a2c',
    accentSoft: 'rgba(255, 80, 61, 0.16)',
    secondary: '#3b82f6',
    secondarySoft: 'rgba(59, 130, 246, 0.16)',
    success: '#2dd4a8',
    successSoft: 'rgba(45, 212, 168, 0.14)',
    warning: '#f0a93a',
    warningSoft: 'rgba(240, 169, 58, 0.16)',
    danger: '#f4436c',
    dangerSoft: 'rgba(244, 67, 108, 0.14)',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

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

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
