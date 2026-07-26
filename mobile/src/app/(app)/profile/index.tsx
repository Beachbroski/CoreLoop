import { useAuth } from '@clerk/clerk-expo';
import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatRoleLabel } from '@/lib/format-role';
import { useMe } from '@/lib/queries/use-me';

export default function ProfileScreen() {
  const theme = useTheme();
  const { signOut } = useAuth();
  const { data: me, isLoading, error } = useMe();

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">Profile</ThemedText>

      {isLoading && <ThemedText themeColor="textSecondary">Loading…</ThemedText>}
      {error && <ThemedText themeColor="textSecondary">Couldn&apos;t load your profile.</ThemedText>}
      {me && (
        <ThemedText themeColor="textSecondary">
          {me.name ?? me.email} · {formatRoleLabel(me.role)}
        </ThemedText>
      )}

      <Pressable
        onPress={() => signOut()}
        style={[styles.button, { backgroundColor: theme.backgroundElement }]}>
        <ThemedText type="smallBold">Sign out</ThemedText>
      </Pressable>
    </ThemedView>
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
  button: {
    marginTop: Spacing.four,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
});
