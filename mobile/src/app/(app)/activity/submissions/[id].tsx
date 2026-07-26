import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ApiError } from '@/lib/api-client';
import { useResubmitSubmission } from '@/lib/queries/use-resubmit-submission';
import { useSubmission } from '@/lib/queries/use-submission';

const RESUBMITTABLE_STATUSES = new Set(['REVISION_REQUESTED', 'REJECTED']);

export default function SubmissionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: submission, isLoading, error } = useSubmission(id);
  const { mutate: resubmit, isPending } = useResubmitSubmission(id);
  const theme = useTheme();

  const [contentUrl, setContentUrl] = useState('');
  const [resubmitError, setResubmitError] = useState<string | null>(null);
  const [resubmitted, setResubmitted] = useState(false);

  if (isLoading) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText themeColor="textSecondary">Loading…</ThemedText>
      </ThemedView>
    );
  }

  if (error || !submission) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText themeColor="textSecondary">This submission is no longer available.</ThemedText>
      </ThemedView>
    );
  }

  function onResubmit() {
    setResubmitError(null);

    if (!contentUrl.trim()) {
      setResubmitError('Enter a link to your updated content.');
      return;
    }

    resubmit(
      { contentUrl: contentUrl.trim() },
      {
        onSuccess: () => setResubmitted(true),
        onError: (err) => {
          setResubmitError(err instanceof ApiError ? err.message : 'Unable to resubmit.');
        },
      },
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">{submission.application.campaign.title}</ThemedText>
      <ThemedText themeColor="textSecondary">{submission.status}</ThemedText>
      <ThemedText>{submission.contentUrl}</ThemedText>

      {submission.reviewNote && (
        <ThemedView style={[styles.noteBox, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText type="smallBold">Feedback</ThemedText>
          <ThemedText themeColor="textSecondary">{submission.reviewNote}</ThemedText>
        </ThemedView>
      )}

      {resubmitted && <ThemedText themeColor="textSecondary">Resubmitted for review.</ThemedText>}

      {!resubmitted && RESUBMITTABLE_STATUSES.has(submission.status) && (
        <>
          <TextInput
            value={contentUrl}
            onChangeText={setContentUrl}
            placeholder="Updated content link"
            placeholderTextColor={theme.textSecondary}
            autoCapitalize="none"
            style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
          />

          {resubmitError ? <ThemedText themeColor="textSecondary">{resubmitError}</ThemedText> : null}

          <Pressable
            onPress={onResubmit}
            disabled={isPending}
            style={[styles.button, { backgroundColor: theme.text, opacity: isPending ? 0.6 : 1 }]}>
            <ThemedText themeColor="background" type="smallBold">
              {isPending ? 'Resubmitting…' : 'Resubmit'}
            </ThemedText>
          </Pressable>
        </>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: Spacing.three,
    padding: Spacing.four,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.four,
  },
  noteBox: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  input: {
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 16,
  },
  button: {
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
});
