import * as Haptics from 'expo-haptics';
import { SymbolView } from 'expo-symbols';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ThemedText } from './themed-text';

type SettingsRowProps = {
  label: string;
  onPress?: () => void;
  destructive?: boolean;
  /** Right-side content: a string renders as secondary text (e.g. version). */
  trailing?: ReactNode;
  disabled?: boolean;
};

/** Profile/settings list row: label, optional trailing value, chevron when tappable. */
export function SettingsRow({ label, onPress, destructive, trailing, disabled }: SettingsRowProps) {
  const theme = useTheme();

  const content = (
    <>
      <ThemedText type="smallBold" themeColor={destructive ? 'danger' : 'text'}>
        {label}
      </ThemedText>
      <View style={styles.trailing}>
        {typeof trailing === 'string' ? (
          <ThemedText type="small" themeColor="textSecondary">
            {trailing}
          </ThemedText>
        ) : (
          trailing
        )}
        {onPress ? (
          <SymbolView
            name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
            size={14}
            tintColor={theme.textSecondary}
          />
        ) : null}
      </View>
    </>
  );

  if (!onPress) {
    return <View style={[styles.row, { backgroundColor: theme.backgroundElement }]}>{content}</View>;
  }

  function handlePress() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress?.();
  }

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: pressed ? theme.backgroundSelected : theme.backgroundElement,
          opacity: disabled ? 0.6 : 1,
        },
      ]}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    minHeight: 52,
  },
  trailing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
});
