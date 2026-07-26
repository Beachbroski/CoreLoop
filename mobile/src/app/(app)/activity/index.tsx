import { useRouter } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ApiError } from '@/lib/api-client';
import { useApplications } from '@/lib/queries/use-applications';
import { useSubmissions } from '@/lib/queries/use-submissions';
import type { Application, Submission } from '@creatordocks/shared';

type Segment = 'applications' | 'submissions';

const STATUS_COLORS: Record<string, 'text' | 'textSecondary'> = {
  PENDING: 'textSecondary',
  ACCEPTED: 'text',
  APPROVED: 'text',
  REJECTED: 'textSecondary',
  REVISION_REQUESTED: 'textSecondary',
};

function loadErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 403) {
    return 'This account isn’t a creator account, so there’s nothing to show here.';
  }
  return "Couldn't load. Pull to retry.";
}

function SegmentTabs({ segment, onChange }: { segment: Segment; onChange: (segment: Segment) => void }) {
  const theme = useTheme();

  return (
    <View style={[styles.segmentRow, { backgroundColor: theme.backgroundElement }]}>
      {(['applications', 'submissions'] as const).map((value) => (
        <Pressable
          key={value}
          onPress={() => onChange(value)}
          style={[styles.segmentButton, segment === value && { backgroundColor: theme.background }]}>
          <ThemedText type="smallBold">{value === 'applications' ? 'Applications' : 'Submissions'}</ThemedText>
        </Pressable>
      ))}
    </View>
  );
}

function StatusPill({ status }: { status: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.statusPill, { backgroundColor: theme.backgroundSelected }]}>
      <ThemedText type="small" themeColor={STATUS_COLORS[status] ?? 'textSecondary'}>
        {status.replace('_', ' ')}
      </ThemedText>
    </View>
  );
}

function ApplicationRow({ application, onPress }: { application: Application; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
      <ThemedText type="smallBold" style={styles.rowTitle} numberOfLines={1}>
        {application.campaign.title}
      </ThemedText>
      <StatusPill status={application.status} />
    </Pressable>
  );
}

function SubmissionRow({ submission, onPress }: { submission: Submission; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
      <ThemedText type="smallBold" style={styles.rowTitle} numberOfLines={1}>
        {submission.application.campaign.title}
      </ThemedText>
      <StatusPill status={submission.status} />
    </Pressable>
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
        <ThemedText type="title">Activity</ThemedText>
        <SegmentTabs segment={segment} onChange={setSegment} />
      </View>

      {active.isLoading && (
        <View style={styles.centered}>
          <ThemedText themeColor="textSecondary">Loading…</ThemedText>
        </View>
      )}

      {active.error && (
        <View style={styles.centered}>
          <ThemedText themeColor="textSecondary" style={styles.centeredText}>
            {loadErrorMessage(active.error)}
          </ThemedText>
        </View>
      )}

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
            <ThemedView style={styles.centered}>
              <ThemedText themeColor="textSecondary">No applications yet.</ThemedText>
            </ThemedView>
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
            <ThemedView style={styles.centered}>
              <ThemedText themeColor="textSecondary">No submissions yet.</ThemedText>
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
    gap: Spacing.three,
  },
  segmentRow: {
    flexDirection: 'row',
    borderRadius: Spacing.two,
    padding: 4,
  },
  segmentButton: {
    flex: 1,
    borderRadius: Spacing.two - 4,
    paddingVertical: Spacing.two,
    alignItems: 'center',
  },
  listContent: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.four,
    flexGrow: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.four,
  },
  centeredText: {
    textAlign: 'center',
  },
  row: {
    borderRadius: Spacing.three,
    padding: Spacing.four,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
  },
  rowTitle: {
    flex: 1,
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: Spacing.two,
    paddingVertical: 4,
  },
});
