import * as Haptics from 'expo-haptics';
import { Pressable, ScrollView, StyleSheet } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ThemedText } from './themed-text';

export const ALL_CATEGORIES = 'All';

/** The chip's resting height at the default text size. It grows from here. */
const CHIP_MIN_HEIGHT = 34;

/**
 * Horizontal niche filter. Options are derived from the campaigns actually
 * loaded, so a chip never promises a category with nothing behind it.
 */
export function CategoryChips({
  categories,
  value,
  onChange,
}: {
  categories: readonly string[];
  value: string;
  onChange: (category: string) => void;
}) {
  const theme = useTheme();

  function handlePress(category: string) {
    if (category === value) return;
    Haptics.selectionAsync();
    onChange(category);
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      keyboardShouldPersistTaps="handled">
      {categories.map((category) => {
        const active = category === value;
        return (
          <Pressable
            key={category}
            onPress={() => handlePress(category)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            // The chip's resting height is 34pt; hitSlop lifts the tappable
            // area past Apple's 44pt minimum. It grows from there with Dynamic
            // Type, and the slop rides along.
            hitSlop={{ top: Spacing.two, bottom: Spacing.two }}
            style={({ pressed }) => [
              styles.chip,
              {
                // Active chips carry a white label, so they take the darker
                // `accentFill` rather than the foreground `accent`.
                backgroundColor: active
                  ? theme.accentFill
                  : pressed
                    ? theme.backgroundSelected
                    : theme.backgroundElement,
                borderColor: active ? theme.accentFill : theme.border,
              },
            ]}>
            <ThemedText type="smallBold" themeColor={active ? 'onAccent' : 'textSecondary'}>
              {category}
            </ThemedText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    // Symmetric vertical padding gives the chips' hitSlop somewhere to land:
    // a touch above the ScrollView's own frame never reaches its children, so
    // without this the slop above each chip would be clipped away.
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
  },
  chip: {
    // `minHeight`, not `height`: the label scales with Dynamic Type and a fixed
    // 34pt box clipped it at the very first accessibility size — the filter
    // read as a row of half-eaten words. The vertical padding keeps the
    // resting height at 34 so nothing moves at the default text size.
    minHeight: CHIP_MIN_HEIGHT,
    paddingHorizontal: Spacing.three - 1,
    paddingVertical: Spacing.one + 1,
    // A capsule rather than the old fixed 17pt corner, which stopped being a
    // half-height radius the moment the chip was allowed to grow.
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
