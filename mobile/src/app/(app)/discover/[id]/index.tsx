import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatCents } from '@/lib/format-money';
import { useCampaign } from '@/lib/queries/use-campaign';

export default function CampaignDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: campaign, isLoading, error } = useCampaign(id);
  const theme = useTheme();
  const router = useRouter();

  if (isLoading) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText themeColor="textSecondary">Loading…</ThemedText>
      </ThemedView>
    );
  }

  if (error || !campaign) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText themeColor="textSecondary">This campaign is no longer available.</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText type="title">{campaign.title}</ThemedText>
        <ThemedText themeColor="textSecondary">{campaign.brand.name ?? 'A brand'}</ThemedText>

        <View style={styles.row}>
          <ThemedText type="smallBold">{formatCents(campaign.budget)}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {campaign.niche}
          </ThemedText>
        </View>

        <ThemedText>{campaign.description}</ThemedText>

        {campaign.deliverables && (
          <View>
            <ThemedText type="smallBold">Deliverables</ThemedText>
            <ThemedText themeColor="textSecondary">{campaign.deliverables}</ThemedText>
          </View>
        )}

        {campaign.creatorRequirements && (
          <View>
            <ThemedText type="smallBold">Creator requirements</ThemedText>
            <ThemedText themeColor="textSecondary">{campaign.creatorRequirements}</ThemedText>
          </View>
        )}
      </ScrollView>

      <Pressable
        onPress={() => router.push(`/discover/${campaign.id}/apply`)}
        style={[styles.applyButton, { backgroundColor: theme.text }]}>
        <ThemedText themeColor="background" type="smallBold">
          Apply
        </ThemedText>
      </Pressable>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: Spacing.four,
    gap: Spacing.three,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.four,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  applyButton: {
    margin: Spacing.four,
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
});
