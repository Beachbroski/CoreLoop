import * as Haptics from 'expo-haptics';
import { SymbolView } from 'expo-symbols';
import { useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';

import { CampaignTile } from '@/components/campaign-tile';
import { ALL_CATEGORIES, CategoryChips } from '@/components/category-chips';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { SkeletonCard } from '@/components/skeleton';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { balanceColumns } from '@/lib/masonry';
import { deadlineSignal, tileAspectRatio } from '@/lib/campaign-signals';
import { useCampaigns } from '@/lib/queries/use-campaigns';

import type { CampaignListItem } from '@creatordocks/shared';

const GUTTER = Spacing.three - 4;
const SCREEN_PADDING = Spacing.four;
const CAPTION_HEIGHT = 86; // approximate, only used to balance column heights
/** At or below this many results, show full-width cards instead of a grid. */
const SPARSE_THRESHOLD = 2;
/** Keeps a full-width hero card from becoming a tall slab. */
const SPARSE_MAX_ART_HEIGHT = 210;

/**
 * Non-destructive refetch failure notice. React Query keeps the previously
 * fetched `data` alongside the `error`, so a refetch that fails on bad signal
 * must leave the loaded feed on screen — this slim banner reports the failure
 * instead of taking the content away.
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

export default function DiscoverScreen() {
  const { data, isLoading, isRefetching, isError, refetch } = useCampaigns();
  const theme = useTheme();
  const { width: screenWidth } = useWindowDimensions();

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string>(ALL_CATEGORIES);
  const [searchFocused, setSearchFocused] = useState(false);

  const campaigns = useMemo(() => data?.data ?? [], [data]);

  const categories = useMemo(() => {
    const niches = Array.from(new Set(campaigns.map((campaign) => campaign.niche))).sort();
    return [ALL_CATEGORIES, ...niches];
  }, [campaigns]);

  // A refetch can narrow the feed to niches that no longer include the selected
  // category. The chip row hides itself at two options or fewer, so the stale
  // selection would keep filtering the feed down to "Nothing matches yet" with
  // no visible control left to clear it. Adjusting state during render (rather
  // than in an effect) re-renders before paint, so the dead filter is never
  // shown. `categories` always contains ALL_CATEGORIES, so this settles in one
  // extra pass.
  if (!categories.includes(category)) {
    setCategory(ALL_CATEGORIES);
  }

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return campaigns.filter((campaign) => {
      if (category !== ALL_CATEGORIES && campaign.niche !== category) return false;
      if (!needle) return true;
      return (
        campaign.title.toLowerCase().includes(needle) ||
        campaign.niche.toLowerCase().includes(needle) ||
        (campaign.brand.name ?? '').toLowerCase().includes(needle)
      );
    });
  }, [campaigns, category, query]);

  // "N live" counts what a creator can actually apply to, which is not the same
  // as what is on screen. The API filters expired campaigns out of the feed, but
  // React Query keeps serving the last fetched page while it refetches, so a
  // deadline can pass while its tile is still up — the tile relabels itself
  // "Closed" and the count has to agree with it rather than overstate the feed.
  const liveCount = useMemo(
    () => filtered.filter((campaign) => !deadlineSignal(campaign.deadline).passed).length,
    [filtered],
  );

  // A two-column mosaic needs enough tiles to read as a grid — with one or two
  // campaigns it just looks broken, so the feed falls back to full-width hero
  // cards until there's enough to fill it.
  const isSparse = filtered.length <= SPARSE_THRESHOLD;
  const columnCount = isSparse ? 1 : 2;
  const columnWidth = isSparse
    ? screenWidth - SCREEN_PADDING * 2
    : Math.floor((screenWidth - SCREEN_PADDING * 2 - GUTTER) / 2);

  // Shortest-column-first packing keeps the columns visually even.
  const columns = useMemo(
    () =>
      balanceColumns<CampaignListItem>(
        filtered,
        (campaign) => columnWidth / tileAspectRatio(campaign.id) + CAPTION_HEIGHT,
        columnCount,
      ),
    [filtered, columnWidth, columnCount],
  );

  // A failed refetch keeps the last good `data` in place, so the full-screen
  // error only earns the layout when there is genuinely nothing to show.
  const hasLoadedFeed = data !== undefined;
  const showErrorState = isError && !hasLoadedFeed;
  const showStaleBanner = isError && hasLoadedFeed;
  const showEmpty = !isLoading && !showErrorState && filtered.length === 0;
  const hasFilters = query.trim().length > 0 || category !== ALL_CATEGORIES;

  return (
    <Screen>
      <View style={styles.header}>
        <ScreenHeader title="Discover" />
        <View
          style={[
            styles.search,
            {
              backgroundColor: theme.backgroundElement,
              borderColor: searchFocused ? theme.accent : theme.border,
            },
          ]}>
          <SymbolView
            name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }}
            size={17}
            tintColor={theme.textSecondary}
          />
          <TextInput
            value={query}
            onChangeText={setQuery}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            placeholder="Search brands, niches, payouts…"
            placeholderTextColor={theme.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            clearButtonMode="while-editing"
            style={[styles.searchInput, { color: theme.text }]}
          />
        </View>
      </View>

      {categories.length > 2 && (
        <CategoryChips categories={categories} value={category} onChange={setCategory} />
      )}

      {isLoading && (
        <View style={styles.skeletons}>
          <SkeletonCard />
          <SkeletonCard />
        </View>
      )}

      {showStaleBanner && <StaleDataBanner message="Couldn't refresh campaigns." onRetry={refetch} />}

      {showErrorState && <ErrorState message="Couldn't load campaigns." onRetry={refetch} />}

      {!isLoading && !showErrorState && (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.accent} />
          }>
          {showEmpty ? (
            <EmptyState
              symbol={{ ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' }}
              title={hasFilters ? 'Nothing matches yet' : 'No campaigns right now'}
              message={
                hasFilters
                  ? 'Try a different search or category.'
                  : "New campaigns drop all the time — check back soon."
              }
            />
          ) : (
            <>
              <View style={styles.sectionHead}>
                <ThemedText type="smallBold" style={styles.sectionTitle}>
                  {category === ALL_CATEGORIES ? 'Fresh drops' : category}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {liveCount} live
                </ThemedText>
              </View>

              <View style={styles.masonry}>
                {columns.map((column, columnIndex) => (
                  <View key={columnIndex} style={styles.column}>
                    {column.map((campaign, rowIndex) => (
                      <CampaignTile
                        key={campaign.id}
                        campaign={campaign}
                        width={columnWidth}
                        index={rowIndex * columnCount + columnIndex}
                        maxArtHeight={isSparse ? SPARSE_MAX_ART_HEIGHT : undefined}
                      />
                    ))}
                  </View>
                ))}
              </View>
            </>
          )}
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.three,
    gap: Spacing.three,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    height: 44,
    paddingHorizontal: Spacing.three - 1,
    borderRadius: Spacing.two + 7,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 15.5,
    paddingVertical: 0,
  },
  skeletons: {
    paddingHorizontal: SCREEN_PADDING,
    gap: GUTTER,
  },
  staleBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    marginHorizontal: SCREEN_PADDING,
    marginBottom: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.three,
  },
  staleBannerText: {
    flexShrink: 1,
  },
  scroll: {
    paddingBottom: Spacing.five,
    flexGrow: 1,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: SCREEN_PADDING,
    paddingBottom: Spacing.two + 2,
  },
  sectionTitle: {
    fontSize: 17,
    lineHeight: 21,
  },
  masonry: {
    flexDirection: 'row',
    paddingHorizontal: SCREEN_PADDING,
    gap: GUTTER,
    alignItems: 'flex-start',
  },
  column: {
    flex: 1,
    gap: GUTTER,
  },
});
