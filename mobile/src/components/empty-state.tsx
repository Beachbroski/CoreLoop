import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ThemedText } from './themed-text';

type EmptyStateProps = {
  symbol: SymbolViewProps['name'];
  title: string;
  message?: string;
};

/** Friendly empty-list display: icon in a soft circle, title, optional hint. */
export function EmptyState({ symbol, title, message }: EmptyStateProps) {
  const theme = useTheme();

  // One accessible element: title and message are a single thought, and the
  // symbol only restates them pictorially.
  //
  // The live region is the counterpart to `SkeletonGroup`'s busy state. An
  // empty state is something that *arrives* — the list resolves and the
  // placeholders are swapped out underneath a screen reader whose focus is
  // elsewhere. Without it the announcement stops at "Loading campaigns" and
  // never says what loading found.
  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLiveRegion="polite"
      accessibilityLabel={message ? `${title}, ${message}` : title}
      style={styles.container}>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[styles.iconCircle, { backgroundColor: theme.accentSoft }]}>
        <SymbolView name={symbol} size={28} tintColor={theme.accent} />
      </View>
      <ThemedText type="smallBold">{title}</ThemedText>
      {message ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.message}>
          {message}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.four,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.one,
  },
  message: {
    textAlign: 'center',
  },
});
