import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, TextInput, View } from 'react-native';

import { BackHeader } from '@/components/back-header';
import { PrimaryButton } from '@/components/primary-button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ApiError } from '@/lib/api-client';
import { useCreateApplication } from '@/lib/queries/use-create-application';

const PITCH_MIN_LENGTH = 20;

export default function ApplyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const router = useRouter();
  const { mutate, isPending } = useCreateApplication();

  const [pitch, setPitch] = useState('');
  const [proposedRate, setProposedRate] = useState('');
  const [focusedField, setFocusedField] = useState<'pitch' | 'rate' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pitchLength = pitch.trim().length;
  const pitchLongEnough = pitchLength >= PITCH_MIN_LENGTH;

  function onSubmit() {
    setError(null);

    const rateCents = Math.round(Number(proposedRate) * 100);
    if (!proposedRate || Number.isNaN(rateCents) || rateCents <= 0) {
      setError('Enter a valid rate.');
      return;
    }
    if (!pitchLongEnough) {
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

  function inputBorder(field: 'pitch' | 'rate') {
    return { borderColor: focusedField === field ? theme.accent : theme.border };
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <BackHeader />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}>
        <ThemedText type="title">Apply</ThemedText>

        <View style={styles.field}>
          <TextInput
            value={pitch}
            onChangeText={setPitch}
            onFocus={() => setFocusedField('pitch')}
            onBlur={() => setFocusedField(null)}
            placeholder="Tell the brand why you're a fit…"
            placeholderTextColor={theme.textSecondary}
            multiline
            numberOfLines={6}
            style={[
              styles.textArea,
              { color: theme.text, backgroundColor: theme.backgroundElement },
              inputBorder('pitch'),
            ]}
          />
          <ThemedText type="small" themeColor={pitchLongEnough ? 'success' : 'textSecondary'}>
            {pitchLength} / {PITCH_MIN_LENGTH} min
          </ThemedText>
        </View>

        <View
          style={[
            styles.rateRow,
            { backgroundColor: theme.backgroundElement },
            inputBorder('rate'),
          ]}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            $
          </ThemedText>
          <TextInput
            value={proposedRate}
            onChangeText={setProposedRate}
            onFocus={() => setFocusedField('rate')}
            onBlur={() => setFocusedField(null)}
            placeholder="Your rate (USD)"
            placeholderTextColor={theme.textSecondary}
            keyboardType="decimal-pad"
            style={[styles.rateInput, { color: theme.text }]}
          />
        </View>

        {error ? <ThemedText themeColor="danger">{error}</ThemedText> : null}

        <PrimaryButton onPress={onSubmit} loading={isPending}>
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
  field: {
    gap: Spacing.one,
  },
  textArea: {
    borderRadius: Spacing.two,
    borderWidth: 1,
    padding: Spacing.three,
    fontSize: 16,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  rateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    borderRadius: Spacing.two,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
  },
  rateInput: {
    flex: 1,
    paddingVertical: Spacing.three,
    fontSize: 16,
  },
});
