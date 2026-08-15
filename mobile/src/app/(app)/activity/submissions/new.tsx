import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput } from 'react-native';

import { BackHeader } from '@/components/back-header';
import { ContentUploadField } from '@/components/content-upload-field';
import { PrimaryButton } from '@/components/primary-button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ApiError } from '@/lib/api-client';
import { useCreateSubmission } from '@/lib/queries/use-create-submission';

type Field = 'caption' | 'notes';

export default function NewSubmissionScreen() {
  const { applicationId } = useLocalSearchParams<{ applicationId: string }>();
  const theme = useTheme();
  const router = useRouter();
  const { mutate, isPending } = useCreateSubmission();

  const [contentUrl, setContentUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [notes, setNotes] = useState('');
  const [focusedField, setFocusedField] = useState<Field | null>(null);
  const [error, setError] = useState<string | null>(null);

  function onSubmit() {
    setError(null);

    if (!contentUrl) {
      setError('Upload your content first.');
      return;
    }

    mutate(
      {
        applicationId,
        contentUrl,
        caption: caption.trim() || undefined,
        notes: notes.trim() || undefined,
      },
      {
        onSuccess: () => router.replace('/activity'),
        onError: (err) => setError(err instanceof ApiError ? err.message : 'Unable to submit content.'),
      },
    );
  }

  function fieldStyle(field: Field) {
    return {
      color: theme.text,
      backgroundColor: theme.backgroundElement,
      borderColor: focusedField === field ? theme.accent : theme.border,
    };
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <BackHeader />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <ThemedText type="title">Submit content</ThemedText>

          <ContentUploadField value={contentUrl} onUploaded={setContentUrl} onError={setError} />

          <TextInput
            value={caption}
            onChangeText={setCaption}
            onFocus={() => setFocusedField('caption')}
            onBlur={() => setFocusedField(null)}
            placeholder="Caption (optional)"
            placeholderTextColor={theme.textSecondary}
            style={[styles.input, fieldStyle('caption')]}
          />
          <TextInput
            value={notes}
            onChangeText={setNotes}
            onFocus={() => setFocusedField('notes')}
            onBlur={() => setFocusedField(null)}
            placeholder="Notes for the brand (optional)"
            placeholderTextColor={theme.textSecondary}
            multiline
            numberOfLines={4}
            style={[styles.textArea, fieldStyle('notes')]}
          />

          {error ? <ThemedText themeColor="danger">{error}</ThemedText> : null}

          <PrimaryButton onPress={onSubmit} loading={isPending}>
            Submit
          </PrimaryButton>
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
  input: {
    borderRadius: Spacing.two,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 16,
  },
  textArea: {
    borderRadius: Spacing.two,
    borderWidth: 1,
    padding: Spacing.three,
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
  },
});
