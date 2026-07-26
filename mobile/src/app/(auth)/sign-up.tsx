import { useAuth, useSignUp } from '@clerk/clerk-expo';
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

export default function SignUpScreen() {
  const { isLoaded: authLoaded, isSignedIn } = useAuth();
  const { isLoaded, signUp, setActive } = useSignUp();
  const router = useRouter();
  const theme = useTheme();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [pendingVerification, setPendingVerification] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (authLoaded && isSignedIn) return <Redirect href="/discover" />;

  async function onCreateAccount() {
    if (!isLoaded || submitting) return;
    setError(null);
    setSubmitting(true);

    try {
      await signUp.create({ emailAddress: email, password });
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      setPendingVerification(true);
    } catch (err) {
      const clerkError = err as { errors?: { message: string }[] };
      setError(clerkError.errors?.[0]?.message ?? 'Unable to sign up. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  async function onVerify() {
    if (!isLoaded || submitting) return;
    setError(null);
    setSubmitting(true);

    try {
      const attempt = await signUp.attemptEmailAddressVerification({ code });

      if (attempt.status === 'complete') {
        await setActive({ session: attempt.createdSessionId });
        router.replace('/discover');
      } else {
        setError('Verification incomplete. Please check the code and try again.');
      }
    } catch (err) {
      const clerkError = err as { errors?: { message: string }[] };
      setError(clerkError.errors?.[0]?.message ?? 'Invalid code. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (pendingVerification) {
    return (
      <Screen edges={['top', 'bottom']}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
            <Logo size={44} />
            <ThemedText type="title" style={styles.title}>
              Check your email
            </ThemedText>
            <ThemedText themeColor="textSecondary">Enter the code we sent to {email}.</ThemedText>

            <TextInput
              value={code}
              onChangeText={setCode}
              placeholder="Verification code"
              placeholderTextColor={theme.textSecondary}
              keyboardType="number-pad"
              style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
            />

            {error ? <ThemedText themeColor="textSecondary">{error}</ThemedText> : null}

            <PrimaryButton onPress={onVerify} loading={submitting} loadingLabel="Verifying…">
              Verify
            </PrimaryButton>
          </ScrollView>
        </KeyboardAvoidingView>
      </Screen>
    );
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Logo size={44} />
          <ThemedText type="title" style={styles.title}>
            Create account
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
            autoComplete="password-new"
            style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
          />

          {error ? <ThemedText themeColor="textSecondary">{error}</ThemedText> : null}

          <PrimaryButton onPress={onCreateAccount} loading={submitting} loadingLabel="Creating account…">
            Sign up
          </PrimaryButton>

          <Link href="/sign-in" style={styles.link}>
            <ThemedText type="link" themeColor="textSecondary">
              Already have an account? Sign in
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
