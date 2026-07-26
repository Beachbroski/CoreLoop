import { useAuth, useSignUp } from '@clerk/clerk-expo';
import { Link, Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { OAuthButtons } from '@/components/oauth-buttons';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
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
      <ThemedView style={styles.container}>
        <ThemedText type="title">Check your email</ThemedText>
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

        <Pressable
          onPress={onVerify}
          disabled={submitting}
          style={[styles.button, { backgroundColor: theme.text, opacity: submitting ? 0.6 : 1 }]}>
          <ThemedText themeColor="background" type="smallBold">
            {submitting ? 'Verifying…' : 'Verify'}
          </ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">Create account</ThemedText>

      <OAuthButtons onError={setError} />

      <View style={[styles.divider, { backgroundColor: theme.backgroundElement }]} />

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

      <Pressable
        onPress={onCreateAccount}
        disabled={submitting}
        style={[styles.button, { backgroundColor: theme.text, opacity: submitting ? 0.6 : 1 }]}>
        <ThemedText themeColor="background" type="smallBold">
          {submitting ? 'Creating account…' : 'Sign up'}
        </ThemedText>
      </Pressable>

      <Link href="/sign-in">
        <ThemedText type="link" themeColor="textSecondary">
          Already have an account? Sign in
        </ThemedText>
      </Link>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
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
  divider: {
    height: 1,
  },
});
