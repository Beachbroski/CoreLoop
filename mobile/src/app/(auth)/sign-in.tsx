import { useAuth, useSignIn } from '@clerk/clerk-expo';
import { LinearGradient } from 'expo-linear-gradient';
import { Link, Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Logo } from '@/components/logo';
import { OAuthButtons } from '@/components/oauth-buttons';
import { PrimaryButton } from '@/components/primary-button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Gradients, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { isPendingSessionStatus, isSessionExistsError } from '@/lib/clerk-errors';

export default function SignInScreen() {
  const { isLoaded: authLoaded, isSignedIn } = useAuth();
  const { isLoaded, signIn, setActive } = useSignIn();
  const router = useRouter();
  const theme = useTheme();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [focusedField, setFocusedField] = useState<'email' | 'password' | null>(null);
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
      } else if (isPendingSessionStatus(attempt.status)) {
        // Clerk authenticated the user but the session is held by an
        // unfinished task (e.g. `choose-organization`), which Clerk treats as
        // signed-out. Without this branch it reads as a mystery failure.
        setError("Sign-in couldn't be completed for this account. Please contact support.");
      } else {
        setError('Additional verification is required. Please continue on the web.');
      }
    } catch (err) {
      if (isSessionExistsError(err)) {
        router.replace('/discover');
        return;
      }
      const clerkError = err as { errors?: { message: string }[] };
      setError(clerkError.errors?.[0]?.message ?? 'Unable to sign in. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  function inputStyle(field: 'email' | 'password') {
    return [
      styles.input,
      {
        color: theme.text,
        backgroundColor: theme.backgroundElement,
        borderColor: focusedField === field ? theme.accent : theme.border,
      },
    ];
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <LinearGradient
        colors={[Gradients.coralGlow[0], Gradients.coralGlow[1]]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.glow}
        pointerEvents="none"
      />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Logo size={56} />
          <ThemedText type="title" style={styles.title}>
            Sign in
          </ThemedText>

          <OAuthButtons onError={setError} />

          <View style={styles.dividerRow}>
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            <ThemedText themeColor="textSecondary" type="small">
              or
            </ThemedText>
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
          </View>

          <TextInput
            value={email}
            onChangeText={setEmail}
            onFocus={() => setFocusedField('email')}
            onBlur={() => setFocusedField(null)}
            placeholder="Email"
            placeholderTextColor={theme.textSecondary}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            style={inputStyle('email')}
          />
          <TextInput
            value={password}
            onChangeText={setPassword}
            onFocus={() => setFocusedField('password')}
            onBlur={() => setFocusedField(null)}
            placeholder="Password"
            placeholderTextColor={theme.textSecondary}
            secureTextEntry
            autoComplete="password"
            style={inputStyle('password')}
          />

          {error ? <ThemedText themeColor="danger">{error}</ThemedText> : null}

          <PrimaryButton onPress={onSubmit} loading={submitting}>
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
  glow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 320,
  },
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
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 16,
  },
  link: {
    alignSelf: 'center',
    marginTop: Spacing.two,
  },
});
