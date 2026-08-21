import * as Haptics from 'expo-haptics';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ThemedText } from './themed-text';

/** Apple's minimum touch target (HIG, Layout); the padding alone gives 40pt. */
const MIN_TOUCH_TARGET = 44;

/** Keeps the two pills the same width when a screen offers Retry and an exit. */
const MIN_ACTION_WIDTH = 120;

const DEFAULT_DISMISS_LABEL = 'Go back';

export type ErrorStateProps = {
  message: string;
  /**
   * Offers a Retry. OMIT IT for a terminal error — a confirmed 404, where the
   * resource is genuinely gone. A Retry there can only fail again, and a
   * control that cannot succeed is worse than no control: it reads as "the app
   * is broken" rather than "the thing you wanted no longer exists".
   */
  onRetry?: () => void;
  /**
   * The way out when there is nothing to retry. Detail screens pushed on a
   * stack pass `router.back` — without it a terminal error strands the creator
   * on a dead screen whose only escape is a system gesture.
   *
   * Independent of `onRetry`: pass both when a failure is recoverable *and*
   * the screen is escapable, and the Retry renders first as the primary act.
   */
  onDismiss?: () => void;
  /** Override when "Go back" is a lie — e.g. a root tab with nowhere to go. */
  dismissLabel?: string;
};

type ErrorActionProps = {
  label: string;
  onPress: () => void;
};

/**
 * Both controls are the same outlined pill. The distinction between them is
 * which one is offered, not how loudly — a terminal error should not shout an
 * escape hatch at someone who was only trying to read a page.
 */
function ErrorAction({ label, onPress }: ErrorActionProps) {
  const theme = useTheme();

  function handlePress() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  }

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.action,
        {
          backgroundColor: pressed ? theme.backgroundSelected : theme.backgroundElement,
          borderColor: theme.border,
        },
      ]}>
      <ThemedText type="smallBold">{label}</ThemedText>
    </Pressable>
  );
}

/**
 * Full-region error display — replaces the old "Pull to retry" text that sat in
 * unscrollable Views with nothing to pull.
 *
 * The `alert` role rides the message rather than the container: a View only
 * exposes its role when it is itself an accessibility element, and making the
 * container one would swallow the Retry beneath it.
 */
export function ErrorState({ message, onRetry, onDismiss, dismissLabel }: ErrorStateProps) {
  const theme = useTheme();

  return (
    <View accessibilityLiveRegion="polite" style={styles.container}>
      {/* Decorative: the message text below says the same thing. */}
      <SymbolView
        name={{ ios: 'exclamationmark.triangle', android: 'warning', web: 'warning' }}
        size={32}
        tintColor={theme.warning}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
      <ThemedText themeColor="textSecondary" accessibilityRole="alert" style={styles.message}>
        {message}
      </ThemedText>
      {onRetry ? <ErrorAction label="Retry" onPress={onRetry} /> : null}
      {onDismiss ? <ErrorAction label={dismissLabel ?? DEFAULT_DISMISS_LABEL} onPress={onDismiss} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
  },
  message: {
    textAlign: 'center',
  },
  action: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.twoHalf,
    minWidth: MIN_ACTION_WIDTH,
    minHeight: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
