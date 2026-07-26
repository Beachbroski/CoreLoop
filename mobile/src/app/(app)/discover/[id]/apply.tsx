import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, TextInput } from 'react-native';

import { BackHeader } from '@/components/back-header';
import { PrimaryButton } from '@/components/primary-button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ApiError } from '@/lib/api-client';
import { useCreateApplication } from '@/lib/queries/use-create-application';

export default function ApplyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const router = useRouter();
  const { mutate, isPending } = useCreateApplication();

  const [pitch, setPitch] = useState('');
  const [proposedRate, setProposedRate] = useState('');
  const [error, setError] = useState<string | null>(null);

  function onSubmit() {
    setError(null);

    const rateCents = Math.round(Number(proposedRate) * 100);
    if (!proposedRate || Number.isNaN(rateCents) || rateCents <= 0) {
      setError('Enter a valid rate.');
      return;
    }
    if (pitch.trim().length < 20) {
      setError('Your pitch needs to be at least 20 characters.');
      return;
    }

    mutate(
      { campaignId: id, pitch: pitch.trim(), proposedRate: rateCents },
      {
        onSuccess: () => router.replace('/activity'),
        onError: (err) => {
          setError(err instanceof ApiError ? err.message : 'Unable to submit your application.');
        },
      },
    );
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <BackHeader />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}>
        <ThemedText type="title">Apply</ThemedText>

        <TextInput
          value={pitch}
          onChangeText={setPitch}
          placeholder="Tell the brand why you're a fit…"
          placeholderTextColor={theme.textSecondary}
          multiline
          numberOfLines={6}
          style={[styles.textArea, { color: theme.text, backgroundColor: theme.backgroundElement }]}
        />

        <TextInput
          value={proposedRate}
          onChangeText={setProposedRate}
          placeholder="Your rate (USD)"
          placeholderTextColor={theme.textSecondary}
          keyboardType="decimal-pad"
          style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
        />

        {error ? <ThemedText themeColor="textSecondary">{error}</ThemedText> : null}

        <PrimaryButton onPress={onSubmit} loading={isPending} loadingLabel="Submitting…">
          Submit application
        </PrimaryButton>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  input: {
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 16,
  },
  textArea: {
    borderRadius: Spacing.two,
    padding: Spacing.three,
    fontSize: 16,
    minHeight: 120,
    textAlignVertical: 'top',
  },
});
