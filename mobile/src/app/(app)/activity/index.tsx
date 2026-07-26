import { useRouter } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useApplications } from '@/lib/queries/use-applications';
import { useSubmissions } from '@/lib/queries/use-submissions';
import type { Application, Submission } from '@creatordocks/shared';

type Segment = 'applications' | 'submissions';

function SegmentTabs({ segment, onChange }: { segment: Segment; onChange: (segment: Segment) => void }) {
  const theme = useTheme();

  return (
    <View style={styles.segmentRow}>
      {(['applications', 'submissions'] as const).map((value) => (
        <Pressable
          key={value}
          onPress={() => onChange(value)}
          style={[
            styles.segmentButton,
            { backgroundColor: segment === value ? theme.text : theme.backgroundElement },
          ]}>
          <ThemedText themeColor={segment === value ? 'background' : 'text'} type="smallBold">
            {value === 'applications' ? 'Applications' : 'Submissions'}
          </ThemedText>
        </Pressable>
      ))}
    </View>
  );
}

function ApplicationRow({ application, onPress }: { application: Application; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
      <ThemedText type="smallBold">{application.campaign.title}</ThemedText>
      <ThemedText themeColor="textSecondary" type="small">
        {application.status}
      </ThemedText>
    </Pressable>
  );
}

function SubmissionRow({ submission, onPress }: { submission: Submission; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
      <ThemedText type="smallBold">{submission.application.campaign.title}</ThemedText>
      <ThemedText themeColor="textSecondary" type="small">
        {submission.status}
      </ThemedText>
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
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <ThemedText type="title">Activity</ThemedText>
        <SegmentTabs segment={segment} onChange={setSegment} />
      </View>

      {active.isLoading && (
        <ThemedView style={styles.centered}>
          <ThemedText themeColor="textSecondary">Loading…</ThemedText>
        </ThemedView>
      )}

      {active.error && (
        <ThemedView style={styles.centered}>
          <ThemedText themeColor="textSecondary">Couldn&apos;t load. Pull to retry.</ThemedText>
        </ThemedView>
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
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: Spacing.four,
    gap: Spacing.three,
  },
  segmentRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  segmentButton: {
    flex: 1,
    borderRadius: Spacing.two,
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
  row: {
    borderRadius: Spacing.three,
    padding: Spacing.four,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
