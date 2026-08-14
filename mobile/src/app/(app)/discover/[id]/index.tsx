import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { BackHeader } from '@/components/back-header';
import { CoverArt } from '@/components/cover-art';
import { ErrorState } from '@/components/error-state';
import { PrimaryButton } from '@/components/primary-button';
import { Screen } from '@/components/screen';
import { Skeleton } from '@/components/skeleton';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatDeadline } from '@/lib/format-date';
import { formatCentsCompact } from '@/lib/format-money';
import { useCampaign } from '@/lib/queries/use-campaign';

function StatChip({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  const theme = useTheme();

  return (
    <View style={[styles.statChip, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type={accent ? 'money' : 'smallBold'} themeColor={accent ? 'accent' : 'text'}>
        {value}
      </ThemedText>
    </View>
  );
}

function Section({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.section}>
      <ThemedText type="smallBold">{title}</ThemedText>
      <ThemedText themeColor="textSecondary">{body}</ThemedText>
    </View>
  );
}

export default function CampaignDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: campaign, isLoading, error, refetch } = useCampaign(id);
  const theme = useTheme();
  const router = useRouter();

  if (isLoading) {
    return (
      <Screen edges={['top', 'bottom']}>
        <BackHeader />
        <View style={styles.skeletons}>
          <Skeleton height={180} borderRadius={Spacing.four} />
          <Skeleton height={36} width="75%" />
          <Skeleton height={64} />
          <Skeleton height={16} width="90%" />
          <Skeleton height={16} width="80%" />
        </View>
      </Screen>
    );
  }

  if (error || !campaign) {
    return (
      <Screen edges={['top', 'bottom']}>
        <BackHeader />
        <ErrorState message="This campaign couldn't be loaded — it may no longer be available." onRetry={refetch} />
      </Screen>
    );
  }

  const sections = [
    { title: 'About this campaign', body: campaign.description },
    { title: 'Objective', body: campaign.objective },
    { title: 'Deliverables', body: campaign.deliverables },
    { title: 'Target audience', body: campaign.targetAudience },
    { title: 'Creator requirements', body: campaign.creatorRequirements },
    { title: 'Call to action', body: campaign.callToAction },
    { title: 'Usage rights', body: campaign.usageRights },
  ].filter((section): section is { title: string; body: string } => Boolean(section.body));

  return (
    <Screen edges={['top', 'bottom']}>
      <BackHeader />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <CoverArt
          seed={campaign.id}
          niche={campaign.niche}
          height={180}
          style={styles.hero}
          overlayStyle={styles.heroOverlay}>
          <View style={styles.nicheChip}>
            <ThemedText type="small" style={styles.nicheChipText}>
              {campaign.niche}
            </ThemedText>
          </View>
        </CoverArt>

        <View style={styles.titleBlock}>
          <ThemedText type="subtitle">{campaign.title}</ThemedText>
          <ThemedText themeColor="textSecondary">{campaign.brand.name ?? 'A brand'}</ThemedText>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.statsRow}>
          <StatChip label="Budget" value={formatCentsCompact(campaign.budget)} accent />
          <StatChip label="Deadline" value={formatDeadline(campaign.deadline)} />
          {campaign.creatorsNeeded ? (
            <StatChip label="Creators" value={String(campaign.creatorsNeeded)} />
          ) : null}
          {campaign.platforms.length > 0 && (
            <StatChip label="Platforms" value={campaign.platforms.join(' · ')} />
          )}
        </ScrollView>

        {sections.map((section) => (
          <Section key={section.title} title={section.title} body={section.body} />
        ))}
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: theme.border, backgroundColor: theme.background }]}>
        <PrimaryButton onPress={() => router.push(`/discover/${campaign.id}/apply`)}>Apply</PrimaryButton>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  skeletons: {
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
  content: {
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
    paddingBottom: Spacing.four,
  },
  hero: {
    borderRadius: Spacing.four,
  },
  heroOverlay: {
    padding: Spacing.three,
  },
  titleBlock: {
    gap: Spacing.one,
  },
  statsRow: {
    gap: Spacing.two,
  },
  statChip: {
    borderRadius: Spacing.three,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
    gap: 2,
    minWidth: 96,
  },
  section: {
    gap: Spacing.half,
  },
  footer: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    borderTopWidth: 1,
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
