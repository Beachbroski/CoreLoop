import * as Linking from 'expo-linking';
import { useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { BackHeader } from '@/components/back-header';
import { ContentUploadField } from '@/components/content-upload-field';
import { PrimaryButton } from '@/components/primary-button';
import { Screen } from '@/components/screen';
import { StatusPill } from '@/components/status-pill';
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

  const [contentUrl, setContentUrl] = useState<string | null>(null);
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

    if (!contentUrl) {
      setResubmitError('Upload your updated content first.');
      return;
    }

    resubmit(
      { contentUrl },
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
            <StatusPill status={submission.status} />
          </View>

          <View style={styles.section}>
            <ThemedText type="smallBold">Content</ThemedText>
            <Pressable
              onPress={() =>
                Linking.openURL(submission.contentUrl).catch(() =>
                  setResubmitError("Couldn't open that link."),
                )
              }
              style={styles.contentLink}>
              <ThemedText themeColor="accent" numberOfLines={1} style={styles.contentLinkText}>
                {submission.contentUrl}
              </ThemedText>
              <SymbolView
                name={{ ios: 'arrow.up.right', android: 'open_in_new', web: 'open_in_new' }}
                size={14}
                tintColor={theme.accent}
              />
            </Pressable>
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

          {resubmitError ? <ThemedText themeColor="danger">{resubmitError}</ThemedText> : null}

          {resubmitted && <ThemedText themeColor="textSecondary">Resubmitted for review.</ThemedText>}

          {!resubmitted && RESUBMITTABLE_STATUSES.has(submission.status) && (
            <View style={styles.section}>
              <ContentUploadField value={contentUrl} onUploaded={setContentUrl} onError={setResubmitError} />

              <PrimaryButton onPress={onResubmit} loading={isPending}>
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
  contentLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  contentLinkText: {
    flexShrink: 1,
  },
});
