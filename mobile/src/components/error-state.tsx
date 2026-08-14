import * as Haptics from 'expo-haptics';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ThemedText } from './themed-text';

/**
 * Full-region error display with an actual Retry action — replaces the old
 * "Pull to retry" text that sat in unscrollable Views with nothing to pull.
 */
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const theme = useTheme();

  function handleRetry() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onRetry?.();
  }

  return (
    <View style={styles.container}>
      <SymbolView
        name={{ ios: 'exclamationmark.triangle', android: 'warning', web: 'warning' }}
        size={32}
        tintColor={theme.warning}
      />
      <ThemedText themeColor="textSecondary" style={styles.message}>
        {message}
      </ThemedText>
      {onRetry ? (
        <Pressable
          onPress={handleRetry}
          style={({ pressed }) => [
            styles.retry,
            {
              backgroundColor: pressed ? theme.backgroundSelected : theme.backgroundElement,
              borderColor: theme.border,
            },
          ]}>
          <ThemedText type="smallBold">Retry</ThemedText>
        </Pressable>
      ) : null}
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
  retry: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two + 2,
    minWidth: 120,
    alignItems: 'center',
  },
});
