import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { BackHeader } from '@/components/back-header';
import { ErrorState } from '@/components/error-state';
import { PrimaryButton } from '@/components/primary-button';
import { Screen } from '@/components/screen';
import { Skeleton } from '@/components/skeleton';
import { StatusPill } from '@/components/status-pill';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ApiError } from '@/lib/api-client';
import { formatCents } from '@/lib/format-money';
import { useApplication } from '@/lib/queries/use-application';
import { useWithdrawApplication } from '@/lib/queries/use-withdraw-application';

export default function ApplicationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: application, isLoading, isError, error, refetch } = useApplication(id);
  const { mutate: withdraw, isPending: withdrawing } = useWithdrawApplication();
  const theme = useTheme();
  const router = useRouter();
  const [withdrawError, setWithdrawError] = useState<string | null>(null);

  if (isLoading) {
    return (
      <Screen edges={['top', 'bottom']}>
        <BackHeader />
        <View style={styles.loading}>
          <Skeleton height={40} width="75%" />
          <Skeleton height={52} borderRadius={Spacing.three} />
          <Skeleton height={16} width="35%" />
          <Skeleton height={72} borderRadius={Spacing.two} />
        </View>
      </Screen>
    );
  }

  // A failed refetch keeps the last good `data`, so the application stays on
  // screen; only an outright absence takes over the layout. And a network blip
  // is not a deleted application — only a 404 says it's genuinely gone, so
  // anything else offers a retry against a message that admits it might come
  // back.
  if (!application) {
    const gone = !isError || (error instanceof ApiError && error.status === 404);
    return (
      <Screen edges={['top', 'bottom']}>
        <BackHeader />
        <ErrorState
          message={gone ? 'This application is no longer available.' : "Couldn't load this application."}
          onRetry={refetch}
        />
      </Screen>
    );
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <BackHeader />
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText type="title">{application.campaign.title}</ThemedText>

        <View style={[styles.statusRow, { backgroundColor: theme.backgroundElement }]}>
          <StatusPill status={application.status} />
          <ThemedText type="smallBold" themeColor="accent">
            {formatCents(application.proposedRate)}
          </ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText type="smallBold">Your pitch</ThemedText>
          <ThemedText themeColor="textSecondary">{application.pitch}</ThemedText>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        {/* Sits with the button that produced it. Inside the ScrollView this
            message could scroll out of sight while the action stayed pinned,
            so a failed withdrawal read as nothing happening at all. */}
        {withdrawError ? <ThemedText themeColor="danger">{withdrawError}</ThemedText> : null}

        {application.status === 'PENDING' && (
          <Pressable
            onPress={() =>
              Alert.alert(
                'Withdraw application?',
                `Your application to “${application.campaign.title}” will be withdrawn. This can't be undone.`,
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Withdraw',
                    style: 'destructive',
                    onPress: () =>
                      withdraw(application.id, {
                        onSuccess: () => router.back(),
                        onError: () => setWithdrawError('Unable to withdraw. Please try again.'),
                      }),
                  },
                ],
              )
            }
            disabled={withdrawing}
            style={[styles.button, { backgroundColor: theme.backgroundElement, opacity: withdrawing ? 0.6 : 1 }]}>
            <ThemedText type="smallBold">{withdrawing ? 'Withdrawing…' : 'Withdraw application'}</ThemedText>
          </Pressable>
        )}

        {application.status === 'ACCEPTED' && (
          <PrimaryButton onPress={() => router.push(`/activity/submissions/new?applicationId=${application.id}`)}>
            Submit content
          </PrimaryButton>
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
  loading: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    gap: Spacing.three,
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
