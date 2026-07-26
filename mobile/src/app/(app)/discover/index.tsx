import { useRouter } from 'expo-router';
import { FlatList, Platform, Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatCents } from '@/lib/format-money';
import { useCampaigns } from '@/lib/queries/use-campaigns';
import type { CampaignListItem } from '@creatordocks/shared';

function CampaignCard({ campaign }: { campaign: CampaignListItem }) {
  const theme = useTheme();
  const router = useRouter();

  return (
    <Pressable
      onPress={() => router.push(`/discover/${campaign.id}`)}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.7 : 1 },
      ]}>
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
      <ThemedText type="title" themeColor="accent" style={styles.cardBudget}>
        {formatCents(campaign.budget)}
      </ThemedText>
    </Pressable>
  );
}

export default function DiscoverScreen() {
  const { data, isLoading, isRefetching, error, refetch } = useCampaigns();
  const theme = useTheme();

  return (
    <Screen>
      <View style={styles.header}>
        <ThemedText type="title">Discover</ThemedText>
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
