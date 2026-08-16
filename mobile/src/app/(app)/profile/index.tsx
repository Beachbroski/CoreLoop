import { useAuth } from '@clerk/clerk-expo';
import { useQueryClient } from '@tanstack/react-query';
import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { ErrorState } from '@/components/error-state';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { SettingsRow } from '@/components/settings-row';
import { Skeleton } from '@/components/skeleton';
import { ThemedText } from '@/components/themed-text';
import { Gradients, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatRoleLabel } from '@/lib/format-role';
import { unregisterForPushNotifications } from '@/lib/push';
import { useDeleteAccount } from '@/lib/queries/use-delete-account';
import { useMe } from '@/lib/queries/use-me';

export default function ProfileScreen() {
  const theme = useTheme();
  const { signOut, getToken } = useAuth();
  const queryClient = useQueryClient();
  const { data: me, isLoading, error, refetch } = useMe();
  const { mutate: deleteAccount, isPending: deleting } = useDeleteAccount();
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  // Stop pushes to this identity before the session ends (needs a token, so it
  // must run before signOut), then drop every cached query. The QueryClient is
  // module-scoped and the keys aren't namespaced by user, so skipping the clear
  // would show the NEXT person to sign in on this device the previous user's
  // profile, applications and payout amounts until each refetch lands.
  async function signOutAndUnregister() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await unregisterForPushNotifications(getToken);
      await signOut();
      queryClient.clear();
    } catch {
      setSignOutError("Couldn't sign out. Please try again.");
      setSigningOut(false);
    }
  }

  function confirmDelete() {
    Alert.alert('Delete your account?', "Your profile, applications, and submissions will be permanently deleted. This can't be undone.", [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Continue',
        style: 'destructive',
        onPress: () =>
          Alert.alert('Are you absolutely sure?', 'This is permanent. There is no way to recover a deleted account.', [
            { text: 'Keep my account', style: 'cancel' },
            {
              text: 'Delete forever',
              style: 'destructive',
              onPress: () => {
                setDeleteError(null);
                deleteAccount(undefined, {
                  onSuccess: async () => {
                    queryClient.clear();
                    await signOut();
                  },
                  onError: () => setDeleteError("Couldn't delete your account. Please try again."),
                });
              },
            },
          ]),
      },
    ]);
  }

  return (
    <Screen>
      <View style={styles.header}>
        <ScreenHeader title="Profile" />
      </View>

      <View style={styles.content}>
        {isLoading && (
          <View style={styles.identityCard}>
            <Skeleton height={64} width={64} borderRadius={32} />
            <View style={styles.identitySkeleton}>
              <Skeleton height={16} width="55%" />
              <Skeleton height={12} width="30%" />
            </View>
          </View>
        )}

        {error && <ErrorState message="Couldn't load your profile." onRetry={refetch} />}

        {me && (
          <>
            <View
              style={[styles.identityCard, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
              <View style={styles.avatar}>
                <LinearGradient
                  colors={[Gradients.coralHero[0], Gradients.coralHero[1]]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                <ThemedText type="subtitle" style={styles.avatarInitial}>
                  {(me.name ?? me.email).charAt(0).toUpperCase()}
                </ThemedText>
              </View>
              <View style={styles.identityBody}>
                <ThemedText type="smallBold" numberOfLines={1} style={styles.identityName}>
                  {me.name ?? me.email}
                </ThemedText>
                <ThemedText themeColor="textSecondary" type="small">
                  {formatRoleLabel(me.role)}
                </ThemedText>
              </View>
            </View>

            <View style={styles.settings}>
              <SettingsRow label="App version" trailing={Constants.expoConfig?.version ?? '—'} />
              <SettingsRow
                label={signingOut ? 'Signing out…' : 'Sign out'}
                onPress={signOutAndUnregister}
                disabled={signingOut}
              />
              <SettingsRow label="Delete account" destructive onPress={confirmDelete} disabled={deleting} />
            </View>

            {signOutError ? <ThemedText themeColor="danger">{signOutError}</ThemedText> : null}
            {deleteError ? <ThemedText themeColor="danger">{deleteError}</ThemedText> : null}
          </>
        )}
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
    gap: Spacing.three,
  },
  identityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: Spacing.four,
    borderWidth: 1,
    padding: Spacing.four,
  },
  identitySkeleton: {
    flex: 1,
    gap: Spacing.two,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarInitial: {
    color: '#ffffff',
  },
  identityBody: {
    flex: 1,
    gap: 2,
  },
  identityName: {
    fontSize: 17,
    lineHeight: 22,
  },
  settings: {
    gap: Spacing.two,
  },
});
