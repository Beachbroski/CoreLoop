import { useAuth, useSignIn } from '@clerk/clerk-expo';
import { Link, Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Logo } from '@/components/logo';
import { OAuthButtons } from '@/components/oauth-buttons';
import { PrimaryButton } from '@/components/primary-button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function SignInScreen() {
  const { isLoaded: authLoaded, isSignedIn } = useAuth();
  const { isLoaded, signIn, setActive } = useSignIn();
  const router = useRouter();
  const theme = useTheme();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (authLoaded && isSignedIn) return <Redirect href="/discover" />;

  async function onSubmit() {
    if (!isLoaded || submitting) return;
    setError(null);
    setSubmitting(true);

    try {
      const attempt = await signIn.create({ strategy: 'password', identifier: email, password });

      if (attempt.status === 'complete') {
        await setActive({ session: attempt.createdSessionId });
        router.replace('/discover');
      } else {
        setError('Additional verification is required. Please continue on the web.');
      }
    } catch (err) {
      const clerkError = err as { errors?: { message: string }[] };
      setError(clerkError.errors?.[0]?.message ?? 'Unable to sign in. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Logo size={44} />
          <ThemedText type="title" style={styles.title}>
            Sign in
          </ThemedText>

          <OAuthButtons onError={setError} />

          <View style={styles.dividerRow}>
            <View style={[styles.divider, { backgroundColor: theme.backgroundElement }]} />
            <ThemedText themeColor="textSecondary" type="small">
              or
            </ThemedText>
            <View style={[styles.divider, { backgroundColor: theme.backgroundElement }]} />
          </View>

          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="Email"
            placeholderTextColor={theme.textSecondary}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
          />
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            placeholderTextColor={theme.textSecondary}
            secureTextEntry
            autoComplete="password"
            style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
          />

          {error ? <ThemedText themeColor="textSecondary">{error}</ThemedText> : null}

          <PrimaryButton onPress={onSubmit} loading={submitting} loadingLabel="Signing in…">
            Sign in
          </PrimaryButton>

          <Link href="/sign-up" style={styles.link}>
            <ThemedText type="link" themeColor="textSecondary">
              Don&apos;t have an account? Sign up
            </ThemedText>
          </Link>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
  },
  title: {
    marginBottom: Spacing.two,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  divider: {
    flex: 1,
    height: 1,
  },
  input: {
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 16,
  },
  link: {
    alignSelf: 'center',
    marginTop: Spacing.two,
  },
});
