import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { Logo } from './logo';
import { ThemedText } from './themed-text';

/** Small persistent brand mark + page title, matching web's nav-shell lockup on every screen. */
export function ScreenHeader({ title }: { title: string }) {
  return (
    <View style={styles.row}>
      <Logo size={26} />
      {/* The one heading on each tab screen — gives VoiceOver's rotor something
          to navigate by. The mark beside it is hidden as decoration. */}
      <ThemedText type="title" accessibilityRole="header">
        {title}
      </ThemedText>
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
