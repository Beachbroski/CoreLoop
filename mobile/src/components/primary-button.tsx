import * as Haptics from 'expo-haptics';
import type { PropsWithChildren } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ThemedText } from './themed-text';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type PrimaryButtonProps = PropsWithChildren<{
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
}>;

/** The one accent-filled button style used everywhere (apply, submit, sign in, connect payout, …). */
export function PrimaryButton({ onPress, disabled, loading, children }: PrimaryButtonProps) {
  const theme = useTheme();
  const isDisabled = disabled || loading;
  const pressed = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(pressed.value, [0, 1], [1, 0.97]) }],
    // `accentFill`, not `accent`: this surface carries `onAccent` label text,
    // which needs the darker fill coral to clear 4.5:1.
    backgroundColor: interpolateColor(pressed.value, [0, 1], [theme.accentFill, theme.accentStrong]),
  }));

  function onPressIn() {
    // eslint-disable-next-line react-hooks/immutability -- Reanimated shared values are mutated by design
    pressed.value = withTiming(1, { duration: 120 });
  }

  function onPressOut() {
    // eslint-disable-next-line react-hooks/immutability -- Reanimated shared values are mutated by design
    pressed.value = withTiming(0, { duration: 120 });
  }

  function handlePress() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  }

  return (
    <AnimatedPressable
      onPress={handlePress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(isDisabled), busy: Boolean(loading) }}
      style={[styles.button, animatedStyle, isDisabled && styles.disabled]}>
      {/* The label Text is the only accessible child, so VoiceOver reads the
          button's own wording — the spinner stays out of the tree. */}
      <View style={styles.content}>
        {loading && (
          <ActivityIndicator color={theme.onAccent} accessibilityElementsHidden importantForAccessibility="no" />
        )}
        <ThemedText type="smallBold" themeColor="onAccent">
          {children}
        </ThemedText>
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 999,
    minHeight: 52,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.6,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
});
