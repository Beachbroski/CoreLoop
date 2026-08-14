import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatStatus, statusSoftColor, statusTextColor } from '@/lib/status-presentation';
import { ThemedText } from './themed-text';

/**
 * The one way a status renders anywhere in the app: soft tinted pill,
 * semantic text color, title-cased label.
 */
export function StatusPill({ status }: { status: string }) {
  const theme = useTheme();
  const softKey = statusSoftColor(status);

  return (
    <View style={[styles.pill, { backgroundColor: softKey ? theme[softKey] : theme.backgroundSelected }]}>
      <ThemedText type="small" themeColor={statusTextColor(status)}>
        {formatStatus(status)}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    borderRadius: 999,
    paddingHorizontal: Spacing.two,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
});
