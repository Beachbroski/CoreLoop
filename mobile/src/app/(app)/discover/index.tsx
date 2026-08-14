import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { FlatList, Platform, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import Animated, {
  FadeInDown,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { CoverArt } from '@/components/cover-art';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { SkeletonCard } from '@/components/skeleton';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatDeadline } from '@/lib/format-date';
import { formatCentsCompact } from '@/lib/format-money';
import { useCampaigns } from '@/lib/queries/use-campaigns';
import type { CampaignListItem } from '@creatordocks/shared';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const ENTRANCE_STAGGER_MS = 60;
const ENTRANCE_STAGGER_CAP = 8;

function BrandRow({ brand }: { brand: CampaignListItem['brand'] }) {
  const theme = useTheme();
  const name = brand.name ?? 'A brand';

  return (
    <View style={styles.brandRow}>
      {brand.avatarUrl ? (
        <Image source={{ uri: brand.avatarUrl }} style={styles.brandAvatar} contentFit="cover" />
      ) : (
        <View style={[styles.brandAvatar, { backgroundColor: theme.secondarySoft }]}>
          <ThemedText type="small" themeColor="secondary" style={styles.brandInitial}>
            {name.charAt(0).toUpperCase()}
          </ThemedText>
        </View>
      )}
      <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} style={styles.brandName}>
        {name}
      </ThemedText>
    </View>
  );
}

function CampaignCard({ campaign, index }: { campaign: CampaignListItem; index: number }) {
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

  const meta = [formatDeadline(campaign.deadline), ...campaign.platforms.slice(0, 2)];
  if (campaign.creatorsNeeded) {
    meta.push(`${campaign.creatorsNeeded} creator${campaign.creatorsNeeded === 1 ? '' : 's'}`);
  }

  return (
    <Animated.View
      entering={FadeInDown.duration(320).delay(Math.min(index, ENTRANCE_STAGGER_CAP) * ENTRANCE_STAGGER_MS)}>
      <AnimatedPressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={[
          styles.card,
          { backgroundColor: theme.backgroundElement, borderColor: theme.border },
          animatedStyle,
        ]}>
        <CoverArt seed={campaign.id} niche={campaign.niche}>
          <View style={styles.nicheChip}>
            <ThemedText type="small" style={styles.nicheChipText}>
              {campaign.niche}
            </ThemedText>
          </View>
        </CoverArt>
        <View style={styles.cardBody}>
          <BrandRow brand={campaign.brand} />
          <ThemedText numberOfLines={2} style={styles.cardTitle}>
            {campaign.title}
          </ThemedText>
          <View style={styles.cardFooter}>
            <ThemedText type="money" themeColor="accent" style={styles.cardBudget}>
              {formatCentsCompact(campaign.budget)}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} style={styles.cardMeta}>
              {meta.join(' · ')}
            </ThemedText>
          </View>
        </View>
      </AnimatedPressable>
    </Animated.View>
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
        <View style={styles.skeletons}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </View>
      )}

      {error && <ErrorState message="Couldn't load campaigns." onRetry={refetch} />}

      {!isLoading && !error && (
        <FlatList
          data={data?.data ?? []}
          keyExtractor={(campaign) => campaign.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.accent} />
          }
          renderItem={({ item, index }) => <CampaignCard campaign={item} index={index} />}
          ItemSeparatorComponent={() => <View style={{ height: Spacing.three }} />}
          ListEmptyComponent={
            <EmptyState
              symbol={{ ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' }}
              title="No campaigns right now"
              message="New campaigns drop all the time — check back soon."
            />
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
  skeletons: {
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
  listContent: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.five,
    flexGrow: 1,
  },
  card: {
    borderRadius: Spacing.four,
    borderWidth: 1,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.18,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 8 },
      },
      android: { elevation: 3 },
    }),
  },
  cardBody: {
    padding: Spacing.four,
    gap: Spacing.two,
  },
  cardTitle: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  cardBudget: {
    fontSize: 26,
    lineHeight: 30,
  },
  cardMeta: {
    flexShrink: 1,
    textAlign: 'right',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  brandAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  brandInitial: {
    fontSize: 11,
    lineHeight: 13,
  },
  brandName: {
    flexShrink: 1,
  },
  nicheChip: {
    backgroundColor: 'rgba(7, 8, 11, 0.55)',
    borderRadius: 999,
    paddingHorizontal: Spacing.two + 2,
    paddingVertical: 4,
  },
  nicheChipText: {
    color: '#ffffff',
  },
});
