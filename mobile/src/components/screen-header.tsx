import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { Logo } from './logo';
import { ThemedText } from './themed-text';

/** Small persistent brand mark + page title, matching web's nav-shell lockup on every screen. */
export function ScreenHeader({ title }: { title: string }) {
  return (
    <View style={styles.row}>
      <Logo size={26} />
      <ThemedText type="title">{title}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
});
