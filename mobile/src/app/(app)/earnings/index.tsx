import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { AnimatedMoney } from '@/components/animated-money';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { PrimaryButton } from '@/components/primary-button';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { SkeletonRow, Skeleton } from '@/components/skeleton';
import { StatusPill } from '@/components/status-pill';
import { ThemedText } from '@/components/themed-text';
import { Gradients, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { loadErrorMessage } from '@/lib/api-error-message';
import { formatDate } from '@/lib/format-date';
import { formatCents } from '@/lib/format-money';
import { usePayouts } from '@/lib/queries/use-payouts';
import { useStripeOnboard } from '@/lib/queries/use-stripe-onboard';
import { useStripeStatus } from '@/lib/queries/use-stripe-status';
import type { Payout } from '@creatordocks/shared';

function PayoutRow({ payout }: { payout: Payout }) {
  const theme = useTheme();

  return (
    <View style={[styles.row, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      <View style={styles.rowBody}>
        <ThemedText type="money" style={styles.rowAmount}>
          {formatCents(payout.amount)}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {formatDate(payout.createdAt)}
        </ThemedText>
      </View>
      <StatusPill status={payout.status} />
    </View>
  );
}

function OnboardingPrompt() {
  const { mutate: onboard, isPending } = useStripeOnboard();
  const { refetch: refetchStatus } = useStripeStatus();

  function onConnect() {
    onboard(undefined, {
      onSuccess: async ({ url }) => {
        await WebBrowser.openBrowserAsync(url);
        refetchStatus();
      },
    });
  }

  return (
    <View style={styles.centered}>
      <ThemedText type="subtitle">Get paid</ThemedText>
      <ThemedText themeColor="textSecondary" style={styles.centeredText}>
        Connect a payout account to start earning from accepted campaigns.
      </ThemedText>
      <View style={styles.onboardButton}>
        <PrimaryButton onPress={onConnect} loading={isPending}>
          Connect payout account
        </PrimaryButton>
      </View>
    </View>
  );
}

export default function EarningsScreen() {
  const theme = useTheme();
  const { data: status, isLoading: statusLoading, error: statusError, refetch: refetchStatus } = useStripeStatus();
  const payouts = usePayouts();

  const lifetimeEarnings = (payouts.data?.data ?? [])
    .filter((payout) => payout.status === 'PAID')
    .reduce((sum, payout) => sum + payout.amount, 0);

  // The header always renders — only the content region below it switches
  // between skeleton / error / onboarding / list states.
  let content;
  if (statusLoading) {
    content = (
      <View style={styles.skeletons}>
        <Skeleton height={110} borderRadius={Spacing.four} />
        <SkeletonRow />
        <SkeletonRow />
        <SkeletonRow />
      </View>
    );
  } else if (statusError) {
    content = <ErrorState message={loadErrorMessage(statusError)} onRetry={refetchStatus} />;
  } else if (!status?.onboarded) {
    content = <OnboardingPrompt />;
  } else if (payouts.error) {
    content = <ErrorState message={loadErrorMessage(payouts.error)} onRetry={payouts.refetch} />;
  } else {
    content = (
      <FlatList
        data={payouts.data?.data ?? []}
        keyExtractor={(payout) => payout.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={payouts.isRefetching} onRefresh={payouts.refetch} tintColor={theme.accent} />
        }
        ItemSeparatorComponent={() => <View style={{ height: Spacing.two }} />}
        ListHeaderComponent={
          <View style={[styles.heroCard, { borderColor: theme.border }]}>
            <LinearGradient
              colors={[Gradients.coralGlow[0], Gradients.coralGlow[1]]}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <ThemedText type="small" themeColor="textSecondary">
              Lifetime paid out
            </ThemedText>
            <AnimatedMoney cents={lifetimeEarnings} style={styles.heroAmount} />
          </View>
        }
        renderItem={({ item }) => <PayoutRow payout={item} />}
        ListEmptyComponent={
          <EmptyState
            symbol={{ ios: 'dollarsign.circle', android: 'paid', web: 'paid' }}
            title="No payouts yet"
            message="Approved submissions turn into payouts right here."
          />
        }
      />
    );
  }

  return (
    <Screen>
      <View style={styles.header}>
        <ScreenHeader title="Earnings" />
      </View>
      {content}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.three,
  },
  skeletons: {
    paddingHorizontal: Spacing.four,
    gap: Spacing.two,
  },
  listContent: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.four,
    flexGrow: 1,
    gap: Spacing.two,
  },
  heroCard: {
    borderRadius: Spacing.four,
    borderWidth: 1,
    padding: Spacing.four,
    gap: Spacing.one,
    overflow: 'hidden',
    marginBottom: Spacing.two,
  },
  heroAmount: {
    fontSize: 52,
    lineHeight: 58,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.four,
  },
  centeredText: {
    textAlign: 'center',
  },
  onboardButton: {
    alignSelf: 'stretch',
    marginTop: Spacing.two,
  },
  row: {
    borderRadius: Spacing.three,
    borderWidth: 1,
    padding: Spacing.three,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
  },
  rowBody: {
    gap: 2,
  },
  rowAmount: {
    fontSize: 17,
    lineHeight: 22,
  },
});
