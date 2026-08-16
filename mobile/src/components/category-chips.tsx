import * as Haptics from 'expo-haptics';
import { Pressable, ScrollView, StyleSheet } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ThemedText } from './themed-text';

export const ALL_CATEGORIES = 'All';

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
            style={({ pressed }) => [
              styles.chip,
              {
                backgroundColor: active
                  ? theme.accent
                  : pressed
                    ? theme.backgroundSelected
                    : theme.backgroundElement,
                borderColor: active ? theme.accent : theme.border,
              },
            ]}>
            <ThemedText type="smallBold" style={active ? styles.activeLabel : undefined} themeColor={active ? undefined : 'textSecondary'}>
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
    paddingBottom: Spacing.two,
  },
  chip: {
    height: 34,
    paddingHorizontal: Spacing.three - 1,
    borderRadius: 17,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeLabel: {
    color: '#ffffff',
  },
});
