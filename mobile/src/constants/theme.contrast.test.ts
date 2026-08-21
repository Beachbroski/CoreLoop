/**
 * Contrast contract for the design tokens.
 *
 * The comment block in `theme.ts` documented its arithmetic carefully and the
 * semantic tokens drifted anyway, because prose cannot fail a build. This file
 * is that arithmetic, executable: it re-derives every ratio from the tokens
 * themselves — including alpha compositing for the low-alpha `*Soft` fills —
 * and fails the moment a token stops clearing its bar.
 *
 * TO ADD A PAIRING: find the table below that matches how the color is used
 * (text on a surface, text on a soft wash, text on an opaque fill, non-text)
 * and add a row. Nothing else changes; the cases are generated from the tables.
 * If you add a new `*Soft` token and forget, the coverage guard at the bottom
 * fails on your behalf.
 */

import { Colors, Gradients } from './theme';

// --- WCAG 2.2 constants -----------------------------------------------------
// https://www.w3.org/TR/WCAG22/#dfn-relative-luminance and #dfn-contrast-ratio.
const CHANNEL_MAX = 255;
const LINEAR_SEGMENT_CUTOFF = 0.03928;
const LINEAR_SEGMENT_DIVISOR = 12.92;
const GAMMA_OFFSET = 0.055;
const GAMMA_SCALE = 1.055;
const GAMMA_EXPONENT = 2.4;
const LUMINANCE_WEIGHT_RED = 0.2126;
const LUMINANCE_WEIGHT_GREEN = 0.7152;
const LUMINANCE_WEIGHT_BLUE = 0.0722;
const CONTRAST_OFFSET = 0.05;

/**
 * 1.4.3 Contrast (Minimum). Everything the semantic tokens render is
 * ThemedText `small` (14px/500) or `default` (16px/500) — under the 18pt /
 * 14pt-bold large-text cutoff, so all of them take the strict bar.
 */
const AA_NORMAL_TEXT = 4.5;

/**
 * 1.4.3 for large text (>= 18pt) plus 1.4.11 Non-text Contrast, which is what
 * icons and control boundaries answer to.
 */
const AA_LARGE_OR_NON_TEXT = 3;

// --- Color plumbing ---------------------------------------------------------

type Rgb = readonly [number, number, number];
type Rgba = readonly [number, number, number, number];

const HEX_PATTERN = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i;
const RGBA_PATTERN = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/i;
const HEX_RADIX = 16;
const OPAQUE = 1;

/** Accepts the two notations the palette actually uses: `#rrggbb` and `rgba(...)`. */
function parseColor(value: string): Rgba {
  const hex = HEX_PATTERN.exec(value);
  if (hex) {
    const [, red, green, blue] = hex;
    return [parseInt(red, HEX_RADIX), parseInt(green, HEX_RADIX), parseInt(blue, HEX_RADIX), OPAQUE];
  }

  const rgba = RGBA_PATTERN.exec(value);
  if (rgba) {
    const [, red, green, blue, alpha] = rgba;
    return [Number(red), Number(green), Number(blue), alpha === undefined ? OPAQUE : Number(alpha)];
  }

  throw new Error(`Unparseable color token: "${value}". Extend parseColor if a new notation is intended.`);
}

function toRgb(value: string): Rgb {
  const [red, green, blue] = parseColor(value);
  return [red, green, blue];
}

/** Source-over compositing of a translucent fill onto an opaque surface. */
function composite(fill: Rgba, surface: Rgb): Rgb {
  const [red, green, blue, alpha] = fill;
  const blend = (channel: number, base: number): number => channel * alpha + base * (OPAQUE - alpha);
  return [blend(red, surface[0]), blend(green, surface[1]), blend(blue, surface[2])];
}

function linearize(channel: number): number {
  const normalized = channel / CHANNEL_MAX;
  return normalized <= LINEAR_SEGMENT_CUTOFF
    ? normalized / LINEAR_SEGMENT_DIVISOR
    : ((normalized + GAMMA_OFFSET) / GAMMA_SCALE) ** GAMMA_EXPONENT;
}

function relativeLuminance([red, green, blue]: Rgb): number {
  return (
    LUMINANCE_WEIGHT_RED * linearize(red) +
    LUMINANCE_WEIGHT_GREEN * linearize(green) +
    LUMINANCE_WEIGHT_BLUE * linearize(blue)
  );
}

/** Deliberately unrounded: rounding 4.4951 up to 4.5 would pass a real failure. */
function contrastRatio(a: Rgb, b: Rgb): number {
  const first = relativeLuminance(a);
  const second = relativeLuminance(b);
  return (Math.max(first, second) + CONTRAST_OFFSET) / (Math.min(first, second) + CONTRAST_OFFSET);
}

// --- Token plumbing ---------------------------------------------------------

type Scheme = keyof typeof Colors;
type Token = keyof (typeof Colors)['light'] & keyof (typeof Colors)['dark'];
type Pairing = { readonly foreground: Token; readonly fill: Token };

const SCHEMES = Object.keys(Colors) as readonly Scheme[];

/** The pixels actually behind the text: a surface, optionally washed by a fill. */
function backdrop(scheme: Scheme, surface: Token, fill?: Token): Rgb {
  const base = toRgb(Colors[scheme][surface]);
  return fill ? composite(parseColor(Colors[scheme][fill]), base) : base;
}

function ratioOf(scheme: Scheme, foreground: Token, surface: Token, fill?: Token): number {
  return contrastRatio(toRgb(Colors[scheme][foreground]), backdrop(scheme, surface, fill));
}

// --- What the app actually renders ------------------------------------------

/**
 * Every opaque surface a foreground can land on. `backgroundSelected` counts as
 * much as the other two: activity rows, settings rows and the upload tile swap
 * to it while pressed, and a StatusPill is sitting inside them when they do.
 */
const SURFACES = ['background', 'backgroundElement', 'backgroundSelected'] as const satisfies readonly Token[];

/** Normal-size text placed straight on a surface. */
const TEXT_ON_SURFACE = [
  'text',
  'textSecondary',
  'accent',
  'secondary',
  'success',
  'warning',
  'danger',
] as const satisfies readonly Token[];

/**
 * Normal-size text inside its own low-alpha wash: StatusPill, the stale-data
 * banners, the rejection callout. The wash pulls a light surface down toward
 * dark text and a dark surface up toward light text, so it always costs
 * contrast — this is the pairing the original audit missed.
 */
const TEXT_ON_SOFT_FILL = [
  { foreground: 'secondary', fill: 'secondarySoft' },
  { foreground: 'success', fill: 'successSoft' },
  { foreground: 'warning', fill: 'warningSoft' },
  { foreground: 'danger', fill: 'dangerSoft' },
] as const satisfies readonly Pairing[];

/**
 * Non-text foregrounds on a wash. `accentSoft` backs a SymbolView glyph in the
 * empty state and the upload tile — pictorial, never lettering — so 1.4.11's
 * 3:1 applies rather than 1.4.3's 4.5:1. Put text there and move it up a table.
 */
const NON_TEXT_ON_SOFT_FILL = [
  { foreground: 'accent', fill: 'accentSoft' },
] as const satisfies readonly Pairing[];

/**
 * Text on an opaque accent fill — primary buttons, the price pill, the active
 * category chip. Surface-independent, because the fill is fully opaque.
 */
const TEXT_ON_OPAQUE_FILL = [
  { foreground: 'onAccent', fill: 'accentFill' },
  { foreground: 'onAccent', fill: 'accentStrong' },
] as const satisfies readonly Pairing[];

// --- The contract -----------------------------------------------------------

describe.each(SCHEMES)('%s scheme', (scheme) => {
  describe.each(SURFACES)('on %s', (surface) => {
    it.each(TEXT_ON_SURFACE)('%s clears AA as normal text', (foreground) => {
      expect(ratioOf(scheme, foreground, surface)).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
    });

    it.each(TEXT_ON_SOFT_FILL)('$foreground on $fill clears AA as normal text', ({ foreground, fill }) => {
      expect(ratioOf(scheme, foreground, surface, fill)).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
    });

    it.each(NON_TEXT_ON_SOFT_FILL)('$foreground on $fill clears the non-text bar', ({ foreground, fill }) => {
      expect(ratioOf(scheme, foreground, surface, fill)).toBeGreaterThanOrEqual(AA_LARGE_OR_NON_TEXT);
    });

    it('borderStrong reads as a control boundary against the surface it separates', () => {
      const line = backdrop(scheme, surface, 'borderStrong');
      expect(contrastRatio(line, toRgb(Colors[scheme][surface]))).toBeGreaterThanOrEqual(AA_LARGE_OR_NON_TEXT);
    });
  });

  it.each(TEXT_ON_OPAQUE_FILL)('$foreground on $fill clears AA as normal text', ({ foreground, fill }) => {
    const ratio = contrastRatio(toRgb(Colors[scheme][foreground]), toRgb(Colors[scheme][fill]));
    expect(ratio).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
  });

  /**
   * `border` sits below the non-text bar on purpose — it is decoration
   * (hairlines, card outlines, the tab-bar rule), and 1.4.11 exempts
   * decoration. This pins the two tokens apart so nobody collapses them back
   * into one and quietly un-fixes the text inputs.
   */
  it('keeps the decorative border weaker than borderStrong', () => {
    const surface: Token = 'backgroundElement';
    const base = toRgb(Colors[scheme][surface]);
    const decorative = contrastRatio(backdrop(scheme, surface, 'border'), base);
    const structural = contrastRatio(backdrop(scheme, surface, 'borderStrong'), base);
    expect(decorative).toBeLessThan(structural);
    expect(decorative).toBeLessThan(AA_LARGE_OR_NON_TEXT);
  });
});

/**
 * The avatar initial is 32px white on the gradient's lightest stop — large
 * text, so 3:1. The other stop is darker still and rides along.
 */
describe('gradients', () => {
  it('coralHero carries white large text on its lightest stop', () => {
    const [lightestStop] = Gradients.coralHero;
    expect(contrastRatio(toRgb(Colors.light.onAccent), toRgb(lightestStop))).toBeGreaterThanOrEqual(
      AA_LARGE_OR_NON_TEXT,
    );
  });
});

/**
 * Coverage guards. The failure mode this file exists to prevent is a token
 * arriving with nobody checking it, so the tables are verified against the
 * palette rather than trusted.
 */
describe('coverage', () => {
  it('exposes the same token names in both schemes', () => {
    expect(Object.keys(Colors.dark).sort()).toEqual(Object.keys(Colors.light).sort());
  });

  it('rates every soft fill in at least one pairing table', () => {
    const rated = new Set<string>([...TEXT_ON_SOFT_FILL, ...NON_TEXT_ON_SOFT_FILL].map((pairing) => pairing.fill));
    const declared = Object.keys(Colors.light).filter((token) => token.endsWith('Soft'));
    expect(declared.filter((token) => !rated.has(token))).toEqual([]);
  });

  it('parses every color token in the palette', () => {
    const values = SCHEMES.flatMap((scheme) => Object.values(Colors[scheme]));
    expect(() => values.forEach(parseColor)).not.toThrow();
  });
});
