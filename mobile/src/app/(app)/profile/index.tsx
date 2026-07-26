import { useAuth } from '@clerk/clerk-expo';
import { Pressable, StyleSheet, View } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatRoleLabel } from '@/lib/format-role';
import { useMe } from '@/lib/queries/use-me';

export default function ProfileScreen() {
  const theme = useTheme();
  const { signOut } = useAuth();
  const { data: me, isLoading, error } = useMe();

  return (
    <Screen>
      <View style={styles.header}>
        <ThemedText type="title">Profile</ThemedText>
      </View>

      <View style={styles.content}>
        {isLoading && <ThemedText themeColor="textSecondary">Loading…</ThemedText>}
        {error && <ThemedText themeColor="textSecondary">Couldn&apos;t load your profile.</ThemedText>}

        {me && (
          <View style={styles.identity}>
            <View style={[styles.avatar, { backgroundColor: theme.backgroundElement }]}>
              <ThemedText type="title" style={styles.avatarInitial}>
                {(me.name ?? me.email).charAt(0).toUpperCase()}
              </ThemedText>
            </View>
            <View>
              <ThemedText type="smallBold">{me.name ?? me.email}</ThemedText>
              <ThemedText themeColor="textSecondary" type="small">
                {formatRoleLabel(me.role)}
              </ThemedText>
            </View>
          </View>
        )}
      </View>

      <View style={styles.footer}>
        <Pressable
          onPress={() => signOut()}
          style={[styles.button, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText type="smallBold">Sign out</ThemedText>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.three,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.four,
  },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    fontSize: 22,
    lineHeight: 26,
  },
  footer: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.four,
  },
  button: {
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
});
