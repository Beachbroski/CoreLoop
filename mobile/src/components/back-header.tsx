import { SymbolView } from 'expo-symbols';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ThemedText } from './themed-text';

export function BackHeader({ title }: { title?: string }) {
  const router = useRouter();
  const theme = useTheme();

  return (
    <Pressable onPress={() => router.back()} style={styles.container} hitSlop={Spacing.three}>
      <SymbolView
        name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }}
        size={20}
        tintColor={theme.text}
      />
      {title ? <ThemedText type="smallBold">{title}</ThemedText> : null}
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
    minHeight: 44,
  },
});
