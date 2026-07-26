/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

// Matches app/globals.css on web — same brand, one design language across
// both surfaces. Web has no dark mode today; the dark palette here is a
// deliberate extension of the same accent/semantic colors, not a guess.
export const Colors = {
  light: {
    text: '#101828',
    textSecondary: '#667085',
    background: '#f5f7fb',
    backgroundElement: '#ffffff',
    backgroundSelected: '#eef2f8',
    border: 'rgba(15, 23, 42, 0.08)',
    accent: '#1371ff',
    accentSoft: 'rgba(19, 113, 255, 0.1)',
    success: '#0d9f6e',
    successSoft: 'rgba(13, 159, 110, 0.1)',
    warning: '#c8811a',
    warningSoft: 'rgba(200, 129, 26, 0.12)',
    danger: '#e11d48',
    dangerSoft: 'rgba(225, 29, 72, 0.1)',
  },
  dark: {
    text: '#f5f7fb',
    textSecondary: '#98a2b3',
    background: '#0b0e14',
    backgroundElement: '#161a23',
    backgroundSelected: '#1f2430',
    border: 'rgba(255, 255, 255, 0.08)',
    accent: '#3b82f6',
    accentSoft: 'rgba(59, 130, 246, 0.16)',
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
// regardless of light/dark mode, same as the web app treats it. Distinct
// from `accent`: coral is the brand identity/logo color, accent is the
// functional interactive color (buttons, links). Web keeps these separate
// too — the mark is coral, everything else interactive is blue.
export const Brand = {
  coral: '#ff503d',
  coralStrong: '#e63f2d',
  coralSoft: 'rgba(255, 80, 61, 0.12)',
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
