import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ThemedText } from './themed-text';

/**
 * Apple's minimum touch target (HIG, Layout). The label alone is a 20pt line
 * box; the four screens that hand-rolled this banner stretched it with an 8pt
 * `hitSlop` and landed at 36pt. `hitSlop` is also the wrong instrument here —
 * it grows the tap area invisibly, so the control still *looks* 20pt tall and
 * a creator aiming at it with one thumb on a bus aims at what they can see.
 */
const MIN_TOUCH_TARGET = 44;

export type StaleDataBannerProps = {
  /** What failed. Usually `loadErrorMessage(error)` or a screen-specific line. */
  message: string;
  onRetry: () => void;
  /** Screen-supplied placement (margins). The banner owns its own padding. */
  style?: StyleProp<ViewStyle>;
};

/**
 * Non-destructive refetch failure notice, shared by every screen that keeps
 * content on screen through a failed refresh.
 *
 * React Query holds the previously fetched `data` alongside the `error`, so a
 * refetch that fails on bad signal must leave the loaded view intact — this
 * slim banner reports the failure instead of taking the content away. It lived
 * in four screens as four identical copies, which is how all four inherited the
 * same 36pt Retry target and the same sub-AA amber.
 *
 * Contrast (computed against `warningSoft` composited on each surface the
 * banner can sit on, worst case of the three): `warning` text clears 4.58:1
 * light and 6.04:1 dark, and the pressed Retry swaps to an opaque
 * `backgroundElement` chip where the same amber reads 5.77:1 / 9.15:1. The
 * measured 2.63:1 in the audit was the pre-Wave-1 amber; the token moved, the
 * markup did not need to.
 */
export function StaleDataBanner({ message, onRetry, style }: StaleDataBannerProps) {
  const theme = useTheme();

  function handleRetry() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onRetry();
  }

  // The `alert` role rides the message, not the row. Two reasons, and the
  // second is the one that bites: a View only exposes its role when it is
  // itself an accessibility element, so `accessibilityRole` on a plain layout
  // View is silently inert — and making the row accessible to fix that would
  // swallow the Retry, announcing a failure the creator then cannot act on.
  // A Text is an accessibility element already, so the role lands for free and
  // the button stays a separate stop.
  return (
    <View
      accessibilityLiveRegion="polite"
      style={[styles.banner, { backgroundColor: theme.warningSoft }, style]}>
      <ThemedText type="small" themeColor="warning" accessibilityRole="alert" style={styles.message}>
        {message}
      </ThemedText>
      <Pressable
        onPress={handleRetry}
        accessibilityRole="button"
        accessibilityLabel="Retry"
        style={({ pressed }) => [
          styles.retry,
          pressed ? { backgroundColor: theme.backgroundElement } : null,
        ]}>
        <ThemedText type="smallBold" themeColor="warning">
          Retry
        </ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.twoHalf,
    borderRadius: Spacing.three,
    // Asymmetric on purpose: the Retry carries its own 12pt of padding out to
    // the edge of its touch target, so matching the text's 16pt on the right
    // would read as 28pt of dead space.
    paddingLeft: Spacing.three,
    paddingRight: Spacing.one,
    // The 44pt Retry sets the row height; more than this stretches the banner
    // into a card.
    paddingVertical: Spacing.one,
  },
  message: {
    flexShrink: 1,
  },
  retry: {
    minHeight: MIN_TOUCH_TARGET,
    minWidth: MIN_TOUCH_TARGET,
    paddingHorizontal: Spacing.twoHalf,
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
