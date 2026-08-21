import * as Haptics from 'expo-haptics';
import { SymbolView } from 'expo-symbols';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ThemedText } from './themed-text';

/**
 * `push` — a pushed screen in a stack. Draws the chevron-left "Back" affordance.
 * `modal` — a sheet presented from the bottom. Draws a "Cancel" text button,
 * because a chevron-left promises a screen to go back TO and a sheet has none;
 * it slides back down where it came from. `router.back()` dismisses either.
 */
export type BackHeaderVariant = 'push' | 'modal';

/** Apple's floor, as a `minHeight` so a scaled title still fits. */
const MIN_TAP_TARGET = 44;

type BackHeaderProps = {
  /** Optional heading rendered beside the dismiss affordance. */
  title?: string;
  /** Defaults to `push`. Use `modal` on anything presented as a sheet. */
  variant?: BackHeaderVariant;
};

export function BackHeader({ title, variant = 'push' }: BackHeaderProps) {
  const router = useRouter();
  const theme = useTheme();
  const isModal = variant === 'modal';

  function onPress() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={isModal ? 'Cancel' : 'Back'}
      // The haptic used to be the only feedback: nothing on screen acknowledged
      // the tap, which reads as a dropped press on a slow push or dismiss.
      style={({ pressed }) => [styles.container, pressed && styles.pressed]}
      hitSlop={Spacing.three}>
      {isModal ? (
        // A text button, matching how iOS labels the leading control of a sheet.
        // `accent` is the foreground coral and clears AA on every surface.
        <ThemedText type="smallBold" themeColor="accent">
          Cancel
        </ThemedText>
      ) : (
        <SymbolView
          name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }}
          size={20}
          tintColor={theme.text}
        />
      )}
      {title ? (
        <ThemedText type="smallBold" style={styles.title}>
          {title}
        </ThemedText>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.three,
    minHeight: MIN_TAP_TARGET,
    // The row used to span the whole screen, which made every empty pixel of
    // the header a back button. Shrink-wrap the control and let `hitSlop` do
    // the reaching instead.
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  title: {
    // Wraps inside the row rather than pushing it past the screen edge, which
    // matters once the title scales with Dynamic Type.
    flexShrink: 1,
  },
  pressed: {
    opacity: 0.6,
  },
});
