import type { PropsWithChildren } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ThemedText } from './themed-text';

type PrimaryButtonProps = PropsWithChildren<{
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  loadingLabel?: string;
}>;

/** The one accent-filled button style used everywhere (apply, submit, sign in, connect payout, …). */
export function PrimaryButton({ onPress, disabled, loading, loadingLabel, children }: PrimaryButtonProps) {
  const theme = useTheme();
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={[styles.button, { backgroundColor: theme.accent, opacity: isDisabled ? 0.6 : 1 }]}>
      <ThemedText type="smallBold" style={styles.text}>
        {loading ? (loadingLabel ?? 'Please wait…') : children}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  text: {
    color: '#ffffff',
  },
});
