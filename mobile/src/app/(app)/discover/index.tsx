import { SymbolView } from 'expo-symbols';
import { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';

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
import { tileAspectRatio } from '@/lib/campaign-signals';
import { useCampaigns } from '@/lib/queries/use-campaigns';

import type { CampaignListItem } from '@creatordocks/shared';

const GUTTER = Spacing.three - 4;
const SCREEN_PADDING = Spacing.four;
const CAPTION_HEIGHT = 86; // approximate, only used to balance column heights

export default function DiscoverScreen() {
  const { data, isLoading, isRefetching, error, refetch } = useCampaigns();
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

  const columnWidth = Math.floor((screenWidth - SCREEN_PADDING * 2 - GUTTER) / 2);

  // Shortest-column-first packing keeps the two columns visually even.
  const columns = useMemo(
    () =>
      balanceColumns<CampaignListItem>(
        filtered,
        (campaign) => columnWidth / tileAspectRatio(campaign.id) + CAPTION_HEIGHT,
        2,
      ),
    [filtered, columnWidth],
  );

  const showEmpty = !isLoading && !error && filtered.length === 0;
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

      {error && <ErrorState message="Couldn't load campaigns." onRetry={refetch} />}

      {!isLoading && !error && (
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
                  {filtered.length} live
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
                        index={rowIndex * 2 + columnIndex}
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
