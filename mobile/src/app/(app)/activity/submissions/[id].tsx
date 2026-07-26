import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { BackHeader } from '@/components/back-header';
import { PrimaryButton } from '@/components/primary-button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
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
      <Screen edges={['top', 'bottom']}>
        <BackHeader />
        <View style={styles.centered}>
          <ThemedText themeColor="textSecondary">Loading…</ThemedText>
        </View>
      </Screen>
    );
  }

  if (error || !submission) {
    return (
      <Screen edges={['top', 'bottom']}>
        <BackHeader />
        <View style={styles.centered}>
          <ThemedText themeColor="textSecondary">This submission is no longer available.</ThemedText>
        </View>
      </Screen>
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
    <Screen edges={['top', 'bottom']}>
      <BackHeader />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedText type="title">{submission.application.campaign.title}</ThemedText>

          <View style={[styles.statusRow, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText type="smallBold">{submission.status.replace('_', ' ')}</ThemedText>
          </View>

          <View style={styles.section}>
            <ThemedText type="smallBold">Content</ThemedText>
            <ThemedText themeColor="textSecondary">{submission.contentUrl}</ThemedText>
          </View>

          {submission.reviewNote && (
            <View
              style={[
                styles.noteBox,
                { backgroundColor: submission.status === 'REJECTED' ? theme.dangerSoft : theme.warningSoft },
              ]}>
              <ThemedText type="smallBold" themeColor={submission.status === 'REJECTED' ? 'danger' : 'warning'}>
                Feedback
              </ThemedText>
              <ThemedText themeColor="textSecondary">{submission.reviewNote}</ThemedText>
            </View>
          )}

          {resubmitted && <ThemedText themeColor="textSecondary">Resubmitted for review.</ThemedText>}

          {!resubmitted && RESUBMITTABLE_STATUSES.has(submission.status) && (
            <View style={styles.section}>
              <TextInput
                value={contentUrl}
                onChangeText={setContentUrl}
                placeholder="Updated content link"
                placeholderTextColor={theme.textSecondary}
                autoCapitalize="none"
                style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
              />

              {resubmitError ? <ThemedText themeColor="textSecondary">{resubmitError}</ThemedText> : null}

              <PrimaryButton onPress={onResubmit} loading={isPending} loadingLabel="Resubmitting…">
                Resubmit
              </PrimaryButton>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
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
  statusRow: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
  },
  section: {
    gap: Spacing.two,
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
});
