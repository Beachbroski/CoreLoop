import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatCents } from '@/lib/format-money';
import { useApplication } from '@/lib/queries/use-application';
import { useWithdrawApplication } from '@/lib/queries/use-withdraw-application';

export default function ApplicationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: application, isLoading, error } = useApplication(id);
  const { mutate: withdraw, isPending: withdrawing } = useWithdrawApplication();
  const theme = useTheme();
  const router = useRouter();
  const [withdrawError, setWithdrawError] = useState<string | null>(null);

  if (isLoading) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText themeColor="textSecondary">Loading…</ThemedText>
      </ThemedView>
    );
  }

  if (error || !application) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText themeColor="textSecondary">This application is no longer available.</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">{application.campaign.title}</ThemedText>
      <ThemedText themeColor="textSecondary">{application.status}</ThemedText>
      <ThemedText type="smallBold">{formatCents(application.proposedRate)}</ThemedText>
      <ThemedText>{application.pitch}</ThemedText>

      {withdrawError ? <ThemedText themeColor="textSecondary">{withdrawError}</ThemedText> : null}

      {application.status === 'PENDING' && (
        <Pressable
          onPress={() =>
            withdraw(application.id, {
              onSuccess: () => router.back(),
              onError: () => setWithdrawError('Unable to withdraw. Please try again.'),
            })
          }
          disabled={withdrawing}
          style={[styles.button, { backgroundColor: theme.backgroundElement, opacity: withdrawing ? 0.6 : 1 }]}>
          <ThemedText type="smallBold">{withdrawing ? 'Withdrawing…' : 'Withdraw application'}</ThemedText>
        </Pressable>
      )}

      {application.status === 'ACCEPTED' && (
        <Pressable
          onPress={() => router.push(`/activity/submissions/new?applicationId=${application.id}`)}
          style={[styles.button, { backgroundColor: theme.text }]}>
          <ThemedText themeColor="background" type="smallBold">
            Submit content
          </ThemedText>
        </Pressable>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: Spacing.three,
    padding: Spacing.four,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.four,
  },
  button: {
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
});
