import * as Linking from 'expo-linking';
import { useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { BackHeader } from '@/components/back-header';
import { ContentUploadField } from '@/components/content-upload-field';
import { ErrorState } from '@/components/error-state';
import { PrimaryButton } from '@/components/primary-button';
import { Screen } from '@/components/screen';
import { Skeleton } from '@/components/skeleton';
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
  const { data: submission, isLoading, isError, error, refetch } = useSubmission(id);
  const { mutate: resubmit, isPending } = useResubmitSubmission(id);
  const theme = useTheme();

  const [contentUrl, setContentUrl] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [resubmitError, setResubmitError] = useState<string | null>(null);
  const [resubmitted, setResubmitted] = useState(false);

  if (isLoading) {
    return (
      <Screen edges={['top', 'bottom']}>
        <BackHeader />
        <View style={styles.loading}>
          <Skeleton height={40} width="75%" />
          <Skeleton height={44} borderRadius={Spacing.three} />
          <Skeleton height={16} width="30%" />
          <Skeleton height={16} width="85%" />
        </View>
      </Screen>
    );
  }

  // A failed refetch keeps the last good `data`, so the submission stays on
  // screen; only an outright absence takes over the layout. And a network blip
  // is not a deleted submission — only a 404 says it's genuinely gone, so
  // anything else offers a retry against a message that admits it might come
  // back.
  if (!submission) {
    const gone = !isError || (error instanceof ApiError && error.status === 404);
    return (
      <Screen edges={['top', 'bottom']}>
        <BackHeader />
        <ErrorState
          message={gone ? 'This submission is no longer available.' : "Couldn't load this submission."}
          onRetry={refetch}
        />
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
              onPress={() => {
                setLinkError(null);
                Linking.openURL(submission.contentUrl).catch(() => setLinkError("Couldn't open that link."));
              }}
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
            {/* Kept beside the link it belongs to. It used to share one state
                with the resubmit failures further down the scroll. */}
            {linkError ? (
              <ThemedText type="small" themeColor="danger">
                {linkError}
              </ThemedText>
            ) : null}
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
              <ContentUploadField value={contentUrl} onUploaded={setContentUrl} onError={setResubmitError} />

              {/* Directly above the button that produced it — from the top of
                  the scroll content this could be missed entirely. */}
              {resubmitError ? <ThemedText themeColor="danger">{resubmitError}</ThemedText> : null}

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
  loading: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    gap: Spacing.three,
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
