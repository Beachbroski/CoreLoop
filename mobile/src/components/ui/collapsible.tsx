import * as Haptics from 'expo-haptics';
import { SymbolView } from 'expo-symbols';
import { PropsWithChildren, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Apple's minimum tap target — a `minHeight` so the row grows with Dynamic Type. */
const HEADER_MIN_HEIGHT = 44;

export function Collapsible({ children, title }: PropsWithChildren & { title: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const theme = useTheme();

  function toggle() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsOpen((value) => !value);
  }

  return (
    <ThemedView>
      <Pressable
        // The header was a bare Pressable: no role, so VoiceOver announced it as
        // plain text with no hint it could be tapped, and no `expanded` state, so
        // nothing told a screen-reader user whether the section was already open.
        accessibilityRole="button"
        accessibilityState={{ expanded: isOpen }}
        // The row's content is a 24pt disc and one line of 14pt text, so it was a
        // ~24pt target. `minHeight` fixes the layout; `hitSlop` covers the
        // horizontal edges the row's own width does not reach.
        hitSlop={Spacing.two}
        style={({ pressed }) => [styles.heading, pressed && styles.pressedHeading]}
        onPress={toggle}>
        <ThemedView type="backgroundElement" style={styles.button}>
          <SymbolView
            name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
            size={14}
            weight="bold"
            tintColor={theme.text}
            style={{ transform: [{ rotate: isOpen ? '-90deg' : '90deg' }] }}
          />
        </ThemedView>

        <ThemedText type="small" style={styles.title}>
          {title}
        </ThemedText>
      </Pressable>
      {isOpen && (
        <Animated.View entering={FadeIn.duration(200)}>
          <ThemedView type="backgroundElement" style={styles.content}>
            {children}
          </ThemedView>
        </Animated.View>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: HEADER_MIN_HEIGHT,
  },
  pressedHeading: {
    opacity: 0.7,
  },
  title: {
    // Long titles wrap rather than pushing the row wider than its parent, and
    // the row's `minHeight` lets it grow to fit.
    flexShrink: 1,
  },
  button: {
    width: Spacing.four,
    height: Spacing.four,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    marginTop: Spacing.three,
    borderRadius: Spacing.three,
    marginLeft: Spacing.four,
    padding: Spacing.four,
  },
});
