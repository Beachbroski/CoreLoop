import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatStatus, statusSoftColor, statusTextColor } from '@/lib/status-presentation';
import { ThemedText } from './themed-text';

/**
 * The one way a status renders anywhere in the app: soft tinted pill,
 * semantic text color, title-cased label.
 *
 * The label is not decoration. It is what keeps the pill clear of WCAG 1.4.1
 * (Use of Color): the tint alone would make "approved" and "rejected"
 * indistinguishable to a red-green colorblind creator, and every call site —
 * the activity row, the payout row, and both detail headers — renders this
 * component rather than a bare colored dot, so the word is always there.
 * Anything that drops the label to save width re-opens 1.4.1.
 *
 * Contrast, recomputed against Wave 1's tokens (each `*Soft` wash composited
 * over `background`, `backgroundElement` and `backgroundSelected` in turn, and
 * reported as the worst of the three, because an activity row swaps to
 * `backgroundSelected` while pressed with this pill sitting inside it):
 * warning 4.58 light / 6.04 dark, success 4.58 / 6.65, danger 4.58 / 4.57.
 * The unrecognised-status fallback — `textSecondary` on the opaque
 * `backgroundSelected` — is 4.63 light / 6.42 dark. All clear AA for normal
 * text; `theme.contrast.test.ts` holds them there.
 */
export function StatusPill({ status }: { status: string }) {
  const theme = useTheme();
  const softKey = statusSoftColor(status);

  // Announced as "Status: Approved" — the bare word on its own gave no hint
  // that it described the row's state.
  return (
    <View
      accessible
      accessibilityLabel={`Status: ${formatStatus(status)}`}
      style={[styles.pill, { backgroundColor: softKey ? theme[softKey] : theme.backgroundSelected }]}>
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
    paddingVertical: Spacing.one,
    alignSelf: 'flex-start',
  },
});
