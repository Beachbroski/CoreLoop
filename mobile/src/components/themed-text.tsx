import { StyleSheet, Text, type TextProps } from 'react-native';

import { Fonts, ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextType = 'default' | 'title' | 'small' | 'smallBold' | 'subtitle' | 'link' | 'money';

export type ThemedTextProps = TextProps & {
  type?: ThemedTextType;
  themeColor?: ThemeColor;
};

// DYNAMIC TYPE POLICY — the app had none, and "none" is not neutral.
//
// React Native scales every `<Text>` with the system content-size category by
// default (`allowFontScaling` defaults to true), so the app already responds to
// Dynamic Type. What it lacked was a decision about WHERE that scaling stops,
// which meant the answer varied per component by accident. This is the
// decision. Three rules, in priority order:
//
//   1. BODY TEXT SCALES WITHOUT A CAP. `default`, `small`, `smallBold`, `link`.
//      These are the variants that carry meaning a creator has to read — pitch
//      copy, campaign titles, error messages, settings labels — and they live in
//      flow layouts that grow. Capping them is the accessibility failure this
//      policy exists to prevent (WCAG 1.4.4 wants 200% and iOS asks for more),
//      so the cap is deliberately absent rather than merely unset.
//
//   2. DISPLAY TEXT IS CAPPED AT `DISPLAY_MAX_SCALE`. `title` (48pt),
//      `subtitle` (32pt), `money` (the earnings hero renders it at 52pt). These
//      are already 2–3x body size, so the accessibility categories multiply an
//      existing exaggeration: at iOS's largest size a 48pt title reaches ~150pt,
//      which is two characters per line on a 393pt screen. Apple caps its own
//      display type far harder — the system Large Title goes 34pt → 44pt across
//      the whole range, a mere 1.29x — so 1.6 is the generous end of the
//      precedent, not a shortcut. A capped title is still legible: it stays
//      larger than uncapped body text at every size.
//
//   3. TEXT INSIDE A FIXED-SIZE BOX DOES NOT SCALE AT ALL, and it is the CALL
//      SITE that opts out with `allowFontScaling={false}` — never this file.
//      The only legitimate cases are glyphs whose box cannot grow and whose
//      content is duplicated in real text nearby (the campaign tile's 18pt
//      brand-initial disc, whose brand name sits right beside it). If text is
//      the only way to get the information, rule 3 does not apply — unclip the
//      container instead.
//
// COROLLARY FOR EVERY OTHER COMPONENT (Wave 3, this means you): a container
// around scaling text gets `minHeight`, never `height`. A fixed `height` with a
// `<Text>` inside is a clipping bug at the first accessibility size, not a
// styling preference. `category-chips`, `ui/collapsible` and the Discover search
// box each had exactly that bug.
//
// Overrides ride on `{...rest}`, which is spread last, so a call site that
// genuinely needs a different ceiling can pass its own `maxFontSizeMultiplier`
// or `allowFontScaling` and win.
const DISPLAY_MAX_SCALE = 1.6;

const MAX_FONT_SCALE: Partial<Record<ThemedTextType, number>> = {
  title: DISPLAY_MAX_SCALE,
  subtitle: DISPLAY_MAX_SCALE,
  money: DISPLAY_MAX_SCALE,
};

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();

  return (
    <Text
      // `undefined` for the body variants is the *absence* of a ceiling, which
      // is rule 1 — not an omission.
      maxFontSizeMultiplier={MAX_FONT_SCALE[type]}
      style={[
        { color: theme[themeColor ?? 'text'] },
        type === 'default' && styles.default,
        type === 'title' && styles.title,
        type === 'small' && styles.small,
        type === 'smallBold' && styles.smallBold,
        type === 'subtitle' && styles.subtitle,
        type === 'link' && styles.link,
        type === 'money' && styles.money,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  small: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: 500,
  },
  smallBold: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: 700,
  },
  default: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: 500,
  },
  title: {
    fontFamily: Fonts.rounded,
    fontSize: 48,
    fontWeight: 600,
    lineHeight: 52,
  },
  subtitle: {
    fontFamily: Fonts.rounded,
    fontSize: 32,
    lineHeight: 44,
    fontWeight: 600,
  },
  link: {
    lineHeight: 30,
    fontSize: 14,
  },
  money: {
    fontFamily: Fonts.rounded,
    fontWeight: 700,
    fontSize: 14,
    lineHeight: 20,
  },
});
