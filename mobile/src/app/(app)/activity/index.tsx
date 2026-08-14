import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { CoverArt } from '@/components/cover-art';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { SegmentedControl } from '@/components/segmented-control';
import { SkeletonRow } from '@/components/skeleton';
import { StatusPill } from '@/components/status-pill';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { loadErrorMessage } from '@/lib/api-error-message';
import { formatDate } from '@/lib/format-date';
import { formatCents } from '@/lib/format-money';
import { useApplications } from '@/lib/queries/use-applications';
import { useSubmissions } from '@/lib/queries/use-submissions';
import type { Application, Submission } from '@creatordocks/shared';

type Segment = 'applications' | 'submissions';

const SEGMENT_OPTIONS = [
  { value: 'applications', label: 'Applications' },
  { value: 'submissions', label: 'Submissions' },
] as const;

function ActivityRow({
  title,
  subtitle,
  status,
  coverSeed,
  coverNiche,
  onPress,
}: {
  title: string;
  subtitle: string;
  status: string;
  coverSeed: string;
  coverNiche?: string;
  onPress: () => void;
}) {
  const theme = useTheme();

  function handlePress() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  }

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: pressed ? theme.backgroundSelected : theme.backgroundElement,
          borderColor: theme.border,
        },
      ]}>
      <CoverArt seed={coverSeed} niche={coverNiche} height={48} style={styles.rowCover} />
      <View style={styles.rowBody}>
        <ThemedText type="smallBold" numberOfLines={1}>
          {title}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {subtitle}
        </ThemedText>
      </View>
      <StatusPill status={status} />
    </Pressable>
  );
}

function ApplicationRow({ application, onPress }: { application: Application; onPress: () => void }) {
  return (
    <ActivityRow
      title={application.campaign.title}
      subtitle={`${formatCents(application.proposedRate)} · ${formatDate(application.createdAt)}`}
      status={application.status}
      coverSeed={application.campaign.id}
      coverNiche={application.campaign.niche}
      onPress={onPress}
    />
  );
}

function SubmissionRow({ submission, onPress }: { submission: Submission; onPress: () => void }) {
  return (
    <ActivityRow
      title={submission.application.campaign.title}
      subtitle={formatDate(submission.createdAt)}
      status={submission.status}
      coverSeed={submission.application.campaign.id}
      onPress={onPress}
    />
  );
}

export default function ActivityScreen() {
  const [segment, setSegment] = useState<Segment>('applications');
  const router = useRouter();
  const applications = useApplications();
  const submissions = useSubmissions();

  const active = segment === 'applications' ? applications : submissions;

  return (
    <Screen>
      <View style={styles.header}>
        <ScreenHeader title="Activity" />
        <SegmentedControl options={SEGMENT_OPTIONS} value={segment} onChange={setSegment} />
      </View>

      {active.isLoading && (
        <View style={styles.skeletons}>
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </View>
      )}

      {active.error && <ErrorState message={loadErrorMessage(active.error)} onRetry={active.refetch} />}

      {!active.isLoading && !active.error && segment === 'applications' && (
        <FlatList
          data={applications.data?.data ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={applications.isRefetching} onRefresh={applications.refetch} />
          }
          ItemSeparatorComponent={() => <View style={{ height: Spacing.two }} />}
          renderItem={({ item }) => (
            <ApplicationRow application={item} onPress={() => router.push(`/activity/applications/${item.id}`)} />
          )}
          ListEmptyComponent={
            <EmptyState
              symbol={{ ios: 'paperplane', android: 'send', web: 'send' }}
              title="No applications yet"
              message="Apply to a campaign from Discover and it'll show up here."
            />
          }
        />
      )}

      {!active.isLoading && !active.error && segment === 'submissions' && (
        <FlatList
          data={submissions.data?.data ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={submissions.isRefetching} onRefresh={submissions.refetch} />
          }
          ItemSeparatorComponent={() => <View style={{ height: Spacing.two }} />}
          renderItem={({ item }) => (
            <SubmissionRow submission={item} onPress={() => router.push(`/activity/submissions/${item.id}`)} />
          )}
          ListEmptyComponent={
            <EmptyState
              symbol={{ ios: 'film', android: 'movie', web: 'movie' }}
              title="No submissions yet"
              message="Once an application is accepted, submit your content here."
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
    gap: Spacing.three,
  },
  skeletons: {
    paddingHorizontal: Spacing.four,
    gap: Spacing.two,
  },
  listContent: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.four,
    flexGrow: 1,
  },
  row: {
    borderRadius: Spacing.three,
    borderWidth: 1,
    padding: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  rowCover: {
    width: 48,
    borderRadius: Spacing.two,
  },
  rowBody: {
    flex: 1,
    gap: 2,
  },
});
