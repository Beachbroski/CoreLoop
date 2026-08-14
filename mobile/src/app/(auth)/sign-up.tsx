import { useAuth, useSignUp } from '@clerk/clerk-expo';
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

type Field = 'email' | 'password' | 'code';

export default function SignUpScreen() {
  const { isLoaded: authLoaded, isSignedIn } = useAuth();
  const { isLoaded, signUp, setActive } = useSignUp();
  const router = useRouter();
  const theme = useTheme();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [focusedField, setFocusedField] = useState<Field | null>(null);
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

  function inputStyle(field: Field) {
    return [
      styles.input,
      {
        color: theme.text,
        backgroundColor: theme.backgroundElement,
        borderColor: focusedField === field ? theme.accent : theme.border,
      },
    ];
  }

  const glow = (
    <LinearGradient
      colors={[Gradients.coralGlow[0], Gradients.coralGlow[1]]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={styles.glow}
      pointerEvents="none"
    />
  );

  if (pendingVerification) {
    return (
      <Screen edges={['top', 'bottom']}>
        {glow}
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
            <Logo size={56} />
            <ThemedText type="title" style={styles.title}>
              Check your email
            </ThemedText>
            <ThemedText themeColor="textSecondary">Enter the code we sent to {email}.</ThemedText>

            <TextInput
              value={code}
              onChangeText={setCode}
              onFocus={() => setFocusedField('code')}
              onBlur={() => setFocusedField(null)}
              placeholder="Verification code"
              placeholderTextColor={theme.textSecondary}
              keyboardType="number-pad"
              style={inputStyle('code')}
            />

            {error ? <ThemedText themeColor="danger">{error}</ThemedText> : null}

            <PrimaryButton onPress={onVerify} loading={submitting}>
              Verify
            </PrimaryButton>
          </ScrollView>
        </KeyboardAvoidingView>
      </Screen>
    );
  }

  return (
    <Screen edges={['top', 'bottom']}>
      {glow}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Logo size={56} />
          <ThemedText type="title" style={styles.title}>
            Create account
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
            autoComplete="password-new"
            style={inputStyle('password')}
          />

          {error ? <ThemedText themeColor="danger">{error}</ThemedText> : null}

          <PrimaryButton onPress={onCreateAccount} loading={submitting}>
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
