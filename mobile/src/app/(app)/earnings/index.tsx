import * as WebBrowser from 'expo-web-browser';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { Screen } from '@/components/screen';
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
      <View style={[styles.statusPill, { backgroundColor: theme.backgroundSelected }]}>
        <ThemedText themeColor="textSecondary" type="small">
          {payout.status}
        </ThemedText>
      </View>
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
    <Screen>
      <View style={styles.centered}>
        <ThemedText type="title">Get paid</ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.centeredText}>
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
      </View>
    </Screen>
  );
}

export default function EarningsScreen() {
  const { data: status, isLoading: statusLoading } = useStripeStatus();
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

  if (!status?.onboarded) {
    return <OnboardingPrompt />;
  }

  const lifetimeEarnings = (payouts.data?.data ?? [])
    .filter((payout) => payout.status === 'PAID')
    .reduce((sum, payout) => sum + payout.amount, 0);

  return (
    <Screen>
      <View style={styles.header}>
        <ThemedText type="title">Earnings</ThemedText>
        <ThemedText themeColor="textSecondary" type="small">
          Lifetime paid out
        </ThemedText>
        <ThemedText type="title" style={styles.total}>
          {formatCents(lifetimeEarnings)}
        </ThemedText>
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
  button: {
    marginTop: Spacing.three,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
});
