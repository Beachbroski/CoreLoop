import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { BackHeader } from '@/components/back-header';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
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
      <Screen edges={['top', 'bottom']}>
        <BackHeader />
        <View style={styles.centered}>
          <ThemedText themeColor="textSecondary">Loading…</ThemedText>
        </View>
      </Screen>
    );
  }

  if (error || !application) {
    return (
      <Screen edges={['top', 'bottom']}>
        <BackHeader />
        <View style={styles.centered}>
          <ThemedText themeColor="textSecondary">This application is no longer available.</ThemedText>
        </View>
      </Screen>
    );
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <BackHeader />
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText type="title">{application.campaign.title}</ThemedText>

        <View style={[styles.statusRow, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText type="smallBold">{application.status.replace('_', ' ')}</ThemedText>
          <ThemedText type="smallBold">{formatCents(application.proposedRate)}</ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText type="smallBold">Your pitch</ThemedText>
          <ThemedText themeColor="textSecondary">{application.pitch}</ThemedText>
        </View>

        {withdrawError ? <ThemedText themeColor="textSecondary">{withdrawError}</ThemedText> : null}
      </ScrollView>

      <View style={styles.footer}>
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
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
    paddingBottom: Spacing.four,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.four,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderRadius: Spacing.three,
    padding: Spacing.three,
  },
  section: {
    gap: Spacing.one,
  },
  footer: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    gap: Spacing.two,
  },
  button: {
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
});
