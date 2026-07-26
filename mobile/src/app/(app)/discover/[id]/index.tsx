import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { BackHeader } from '@/components/back-header';
import { PrimaryButton } from '@/components/primary-button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatCentsCompact } from '@/lib/format-money';
import { useCampaign } from '@/lib/queries/use-campaign';

export default function CampaignDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: campaign, isLoading, error } = useCampaign(id);
  const theme = useTheme();
  const router = useRouter();

  if (isLoading) {
    return (
      <Screen edges={['top', 'bottom']}>
        <BackHeader />
        <View style={styles.centered}>
          <ThemedText themeColor="textSecondary">Loading…</ThemedText>
        </View>
      </Screen>
    );
  }

  if (error || !campaign) {
    return (
      <Screen edges={['top', 'bottom']}>
        <BackHeader />
        <View style={styles.centered}>
          <ThemedText themeColor="textSecondary">This campaign is no longer available.</ThemedText>
        </View>
      </Screen>
    );
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <BackHeader />
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText type="title">{campaign.title}</ThemedText>
        <ThemedText themeColor="textSecondary">{campaign.brand.name ?? 'A brand'}</ThemedText>

        <View style={[styles.statsRow, { backgroundColor: theme.backgroundElement }]}>
          <View>
            <ThemedText type="small" themeColor="textSecondary">
              Budget
            </ThemedText>
            <ThemedText type="money" themeColor="accent">
              {formatCentsCompact(campaign.budget)}
            </ThemedText>
          </View>
          <View>
            <ThemedText type="small" themeColor="textSecondary">
              Niche
            </ThemedText>
            <ThemedText type="smallBold">{campaign.niche}</ThemedText>
          </View>
        </View>

        <ThemedText>{campaign.description}</ThemedText>

        {campaign.deliverables && (
          <View style={styles.section}>
            <ThemedText type="smallBold">Deliverables</ThemedText>
            <ThemedText themeColor="textSecondary">{campaign.deliverables}</ThemedText>
          </View>
        )}

        {campaign.creatorRequirements && (
          <View style={styles.section}>
            <ThemedText type="smallBold">Creator requirements</ThemedText>
            <ThemedText themeColor="textSecondary">{campaign.creatorRequirements}</ThemedText>
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <PrimaryButton onPress={() => router.push(`/discover/${campaign.id}/apply`)}>Apply</PrimaryButton>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
    paddingBottom: Spacing.four,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.four,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderRadius: Spacing.three,
    padding: Spacing.three,
  },
  section: {
    gap: Spacing.half,
  },
  footer: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
  },
});
