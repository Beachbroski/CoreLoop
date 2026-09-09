import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';

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
import { STRIPE_RETURN_DEEP_LINK, type Payout } from '@creatordocks/shared';

/**
 * Non-destructive refetch failure notice. React Query keeps the previously
 * fetched `data` alongside the `error`, so a refetch that fails on bad signal
 * must leave the loaded earnings on screen — this slim banner reports the
 * failure instead of taking the content away.
 */
function StaleDataBanner({ message, onRetry }: { message: string; onRetry: () => void }) {
  const theme = useTheme();

  function handleRetry() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onRetry();
  }

  return (
    <View style={[styles.staleBanner, { backgroundColor: theme.warningSoft }]}>
      <ThemedText type="small" themeColor="warning" style={styles.staleBannerText}>
        {message}
      </ThemedText>
      <Pressable onPress={handleRetry} hitSlop={Spacing.two} accessibilityRole="button">
        <ThemedText type="smallBold" themeColor="warning">
          Retry
        </ThemedText>
      </Pressable>
    </View>
  );
}

/** Loading shape for the hero total plus the payout rows beneath it. */
function EarningsSkeleton() {
  return (
    <View style={styles.skeletons}>
      <Skeleton height={110} borderRadius={Spacing.four} />
      <SkeletonRow />
      <SkeletonRow />
      <SkeletonRow />
    </View>
  );
}

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
  const [error, setError] = useState<string | null>(null);

  function onConnect() {
    setError(null);
    onboard(undefined, {
      // This is the only path to getting paid — a silent failure here leaves
      // the creator tapping a button that appears to do nothing.
      onSuccess: async ({ url }) => {
        try {
          // `openAuthSessionAsync`, not `openBrowserAsync`. Stripe finishes by
          // sending the creator to our `/stripe/return` page, which redirects
          // to STRIPE_RETURN_DEEP_LINK; only an auth session watches for that
          // scheme and closes itself. With a plain browser the sheet stays
          // open on a redirect the creator has to dismiss by hand, which reads
          // as the app having hung at the end of payout setup.
          await WebBrowser.openAuthSessionAsync(url, STRIPE_RETURN_DEEP_LINK);
        } catch {
          setError("Couldn't open Stripe. Please try again.");
          return;
        }
        // Deliberately unconditional — not gated on a `success` result.
        // Dismissing the sheet early still leaves whatever Stripe already
        // saved, and the refresh path comes back as a cancellation while
        // having created a real account. The server decides, by retrieving the
        // live account; this only asks it to look again.
        refetchStatus();
      },
      onError: () => setError("Couldn't start payout setup. Please try again."),
    });
  }

  return (
    <View style={styles.centered}>
      <ThemedText type="subtitle">Get paid</ThemedText>
      <ThemedText themeColor="textSecondary" style={styles.centeredText}>
        Connect a payout account to start earning from accepted campaigns.
      </ThemedText>
      {error ? <ThemedText themeColor="danger">{error}</ThemedText> : null}
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

  // Server-aggregated across ALL payouts. Summing the returned page would
  // undercount any creator with more payouts than the page limit (20), and the
  // number is silently wrong when it does — so only fall back to the page sum
  // if an older server hasn't sent the aggregate yet.
  const lifetimeEarnings =
    payouts.data?.meta?.lifetimePaidAmount ??
    (payouts.data?.data ?? [])
      .filter((payout) => payout.status === 'PAID')
      .reduce((sum, payout) => sum + payout.amount, 0);

  // A failed refetch keeps the last good `data` in place, so a full-screen error
  // only earns the layout when the query has nothing to show at all. An error
  // arriving on top of already-loaded data goes in the banner instead, leaving
  // the numbers the creator was reading exactly where they were.
  const staleStatusError = status !== undefined ? statusError : null;
  const stalePayoutsError = payouts.data !== undefined ? payouts.error : null;
  const staleError = staleStatusError ?? stalePayoutsError;
  const retryStale = staleStatusError ? refetchStatus : payouts.refetch;

  // The header always renders — only the content region below it switches
  // between skeleton / error / onboarding / list states.
  let content;
  if (statusLoading) {
    content = <EarningsSkeleton />;
  } else if (statusError && status === undefined) {
    content = <ErrorState message={loadErrorMessage(statusError)} onRetry={refetchStatus} />;
  } else if (!status?.onboarded) {
    content = <OnboardingPrompt />;
  } else if (payouts.isLoading) {
    // Without this branch an in-flight payouts query renders a confident lie:
    // $0.00 in the hero and "No payouts yet" beneath it, which then flips to the
    // real figures a moment later.
    content = <EarningsSkeleton />;
  } else if (payouts.isError && payouts.data === undefined) {
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
      {staleError ? <StaleDataBanner message={loadErrorMessage(staleError)} onRetry={retryStale} /> : null}
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
  staleBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    marginHorizontal: Spacing.four,
    marginBottom: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.three,
  },
  staleBannerText: {
    flexShrink: 1,
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
