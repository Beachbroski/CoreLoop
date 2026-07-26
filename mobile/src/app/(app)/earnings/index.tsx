import * as WebBrowser from 'expo-web-browser';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatCents } from '@/lib/format-money';
import { usePayouts } from '@/lib/queries/use-payouts';
import { useStripeOnboard } from '@/lib/queries/use-stripe-onboard';
import { useStripeStatus } from '@/lib/queries/use-stripe-status';
import type { Payout } from '@creatordocks/shared';

function PayoutRow({ payout }: { payout: Payout }) {
  const theme = useTheme();
  return (
    <View style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
      <ThemedText type="smallBold">{formatCents(payout.amount)}</ThemedText>
      <ThemedText themeColor="textSecondary" type="small">
        {payout.status}
      </ThemedText>
    </View>
  );
}

function OnboardingPrompt() {
  const theme = useTheme();
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
    <ThemedView style={styles.centered}>
      <ThemedText type="title">Get paid</ThemedText>
      <ThemedText themeColor="textSecondary">
        Connect a payout account to start earning from accepted campaigns.
      </ThemedText>
      <Pressable
        onPress={onConnect}
        disabled={isPending}
        style={[styles.button, { backgroundColor: theme.text, opacity: isPending ? 0.6 : 1 }]}>
        <ThemedText themeColor="background" type="smallBold">
          {isPending ? 'Connecting…' : 'Connect payout account'}
        </ThemedText>
      </Pressable>
    </ThemedView>
  );
}

export default function EarningsScreen() {
  const { data: status, isLoading: statusLoading } = useStripeStatus();
  const payouts = usePayouts();

  if (statusLoading) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText themeColor="textSecondary">Loading…</ThemedText>
      </ThemedView>
    );
  }

  if (!status?.onboarded) {
    return <OnboardingPrompt />;
  }

  const lifetimeEarnings = (payouts.data?.data ?? [])
    .filter((payout) => payout.status === 'PAID')
    .reduce((sum, payout) => sum + payout.amount, 0);

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <ThemedText type="title">Earnings</ThemedText>
        <ThemedText themeColor="textSecondary">{formatCents(lifetimeEarnings)} paid out</ThemedText>
      </View>

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
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: Spacing.four,
    gap: Spacing.one,
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
  row: {
    borderRadius: Spacing.three,
    padding: Spacing.four,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  button: {
    marginTop: Spacing.three,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
});
