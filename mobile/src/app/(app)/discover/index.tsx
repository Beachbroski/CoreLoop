import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { FlatList, Platform, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatCentsCompact } from '@/lib/format-money';
import { useCampaigns } from '@/lib/queries/use-campaigns';
import type { CampaignListItem } from '@creatordocks/shared';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function CampaignCard({ campaign }: { campaign: CampaignListItem }) {
  const theme = useTheme();
  const router = useRouter();
  const pressed = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(pressed.value, [0, 1], [1, 0.97]) }],
  }));

  function onPressIn() {
    // eslint-disable-next-line react-hooks/immutability -- Reanimated shared values are mutated by design
    pressed.value = withTiming(1, { duration: 120 });
  }

  function onPressOut() {
    // eslint-disable-next-line react-hooks/immutability -- Reanimated shared values are mutated by design
    pressed.value = withTiming(0, { duration: 120 });
  }

  function onPress() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/discover/${campaign.id}`);
  }

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={[styles.card, { backgroundColor: theme.backgroundElement }, animatedStyle]}>
      <View style={styles.cardHeader}>
        <ThemedText type="smallBold" numberOfLines={1} style={styles.cardTitle}>
          {campaign.title}
        </ThemedText>
        <View style={[styles.badge, { backgroundColor: theme.accentSoft }]}>
          <ThemedText type="small" themeColor="accent">
            {campaign.niche}
          </ThemedText>
        </View>
      </View>
      <ThemedText themeColor="textSecondary" type="small">
        {campaign.brand.name ?? 'A brand'}
      </ThemedText>
      <ThemedText type="money" themeColor="accent" style={styles.cardBudget}>
        {formatCentsCompact(campaign.budget)}
      </ThemedText>
    </AnimatedPressable>
  );
}

export default function DiscoverScreen() {
  const { data, isLoading, isRefetching, error, refetch } = useCampaigns();
  const theme = useTheme();

  return (
    <Screen>
      <View style={styles.header}>
        <ScreenHeader title="Discover" />
      </View>

      {isLoading && (
        <View style={styles.centered}>
          <ThemedText themeColor="textSecondary">Loading campaigns…</ThemedText>
        </View>
      )}

      {error && (
        <View style={styles.centered}>
          <ThemedText themeColor="textSecondary">Couldn&apos;t load campaigns. Pull to retry.</ThemedText>
        </View>
      )}

      {!isLoading && !error && (
        <FlatList
          data={data?.data ?? []}
          keyExtractor={(campaign) => campaign.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.accent} />
          }
          renderItem={({ item }) => <CampaignCard campaign={item} />}
          ItemSeparatorComponent={() => <View style={{ height: Spacing.three }} />}
          ListEmptyComponent={
            <ThemedView style={styles.centered}>
              <ThemedText themeColor="textSecondary">No active campaigns right now.</ThemedText>
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
    paddingBottom: Spacing.three,
  },
  listContent: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.five,
    flexGrow: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.four,
  },
  card: {
    borderRadius: Spacing.four,
    padding: Spacing.four,
    gap: Spacing.one,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.06,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
      },
      android: { elevation: 2 },
    }),
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  cardTitle: {
    flex: 1,
  },
  cardBudget: {
    fontSize: 22,
    lineHeight: 28,
    marginTop: Spacing.one,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: Spacing.two,
    paddingVertical: 4,
  },
});
