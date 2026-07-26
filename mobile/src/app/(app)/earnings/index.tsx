import * as WebBrowser from 'expo-web-browser';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/primary-button';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { loadErrorMessage } from '@/lib/api-error-message';
import { formatCents } from '@/lib/format-money';
import { usePayouts } from '@/lib/queries/use-payouts';
import { useStripeOnboard } from '@/lib/queries/use-stripe-onboard';
import { useStripeStatus } from '@/lib/queries/use-stripe-status';
import { formatStatus, statusSoftColor, statusTextColor } from '@/lib/status-presentation';
import type { Payout } from '@creatordocks/shared';

function PayoutRow({ payout }: { payout: Payout }) {
  const theme = useTheme();
  const softKey = statusSoftColor(payout.status);
  return (
    <View style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
      <ThemedText type="smallBold">{formatCents(payout.amount)}</ThemedText>
      <View style={[styles.statusPill, { backgroundColor: softKey ? theme[softKey] : theme.backgroundSelected }]}>
        <ThemedText themeColor={statusTextColor(payout.status)} type="small">
          {formatStatus(payout.status)}
        </ThemedText>
      </View>
    </View>
  );
}

function OnboardingPrompt() {
  const { mutate: onboard, isPending } = useStripeOnboard();
  const { refetch: refetchStatus } = useStripeStatus();

  async function onConnect() {
    onboard(undefined, {
      onSuccess: async ({ url }) => {
        await WebBrowser.openBrowserAsync(url);
        refetchStatus();
      },
    });
  }

  return (
    <Screen>
      <View style={styles.centered}>
        <ThemedText type="title">Get paid</ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.centeredText}>
          Connect a payout account to start earning from accepted campaigns.
        </ThemedText>
        <PrimaryButton onPress={onConnect} loading={isPending} loadingLabel="Connecting…">
          Connect payout account
        </PrimaryButton>
      </View>
    </Screen>
  );
}

export default function EarningsScreen() {
  const { data: status, isLoading: statusLoading, error: statusError } = useStripeStatus();
  const payouts = usePayouts();

  if (statusLoading) {
    return (
      <Screen>
        <View style={styles.centered}>
          <ThemedText themeColor="textSecondary">Loading…</ThemedText>
        </View>
      </Screen>
    );
  }

  if (statusError) {
    return (
      <Screen>
        <View style={styles.centered}>
          <ThemedText themeColor="textSecondary" style={styles.centeredText}>
            {loadErrorMessage(statusError)}
          </ThemedText>
        </View>
      </Screen>
    );
  }

  if (!status?.onboarded) {
    return <OnboardingPrompt />;
  }

  const lifetimeEarnings = (payouts.data?.data ?? [])
    .filter((payout) => payout.status === 'PAID')
    .reduce((sum, payout) => sum + payout.amount, 0);

  return (
    <Screen>
      <View style={styles.header}>
        <ScreenHeader title="Earnings" />
        <ThemedText themeColor="textSecondary" type="small">
          Lifetime paid out
        </ThemedText>
        <ThemedText type="title" themeColor="accent" style={styles.total}>
          {formatCents(lifetimeEarnings)}
        </ThemedText>
      </View>

      {payouts.error ? (
        <View style={styles.centered}>
          <ThemedText themeColor="textSecondary" style={styles.centeredText}>
            {loadErrorMessage(payouts.error)}
          </ThemedText>
        </View>
      ) : (
        <FlatList
          data={payouts.data?.data ?? []}
          keyExtractor={(payout) => payout.id}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={payouts.isRefetching} onRefresh={payouts.refetch} />}
          ItemSeparatorComponent={() => <View style={{ height: Spacing.two }} />}
          renderItem={({ item }) => <PayoutRow payout={item} />}
          ListEmptyComponent={
            <ThemedView style={styles.centered}>
              <ThemedText themeColor="textSecondary">No payouts yet.</ThemedText>
            </ThemedView>
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.four,
  },
  total: {
    fontSize: 40,
    lineHeight: 44,
  },
  listContent: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.four,
    flexGrow: 1,
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
  row: {
    borderRadius: Spacing.three,
    padding: Spacing.four,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: Spacing.two,
    paddingVertical: 4,
  },
});
