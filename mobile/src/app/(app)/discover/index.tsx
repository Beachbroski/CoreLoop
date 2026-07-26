import { useRouter } from 'expo-router';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';

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
      style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
      <ThemedText type="smallBold">{campaign.title}</ThemedText>
      <ThemedText themeColor="textSecondary">{campaign.brand.name ?? 'A brand'}</ThemedText>
      <View style={styles.cardRow}>
        <ThemedText type="small">{formatCents(campaign.budget)}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {campaign.niche}
        </ThemedText>
      </View>
    </Pressable>
  );
}

export default function DiscoverScreen() {
  const { data, isLoading, isRefetching, error, refetch } = useCampaigns();

  if (isLoading) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText themeColor="textSecondary">Loading campaigns…</ThemedText>
      </ThemedView>
    );
  }

  if (error) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText themeColor="textSecondary">Couldn&apos;t load campaigns. Pull to retry.</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={data?.data ?? []}
        keyExtractor={(campaign) => campaign.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
        renderItem={({ item }) => <CampaignCard campaign={item} />}
        ItemSeparatorComponent={() => <View style={{ height: Spacing.two }} />}
        ListEmptyComponent={
          <ThemedView style={styles.centered}>
            <ThemedText themeColor="textSecondary">No active campaigns right now.</ThemedText>
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
  listContent: {
    padding: Spacing.four,
    flexGrow: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.four,
  },
  card: {
    borderRadius: Spacing.three,
    padding: Spacing.four,
    gap: Spacing.one,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.two,
  },
});
