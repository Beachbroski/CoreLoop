import { useSSO } from '@clerk/clerk-expo';
import type { OAuthStrategy } from '@clerk/types';
import * as Haptics from 'expo-haptics';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { isSessionExistsError } from '@/lib/clerk-errors';
import { isUserCancellation, isUserCancelledError } from '@/lib/sso-cancellation';
import { ThemedText } from './themed-text';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const PROVIDERS: { strategy: OAuthStrategy; label: string }[] = [
  { strategy: 'oauth_google', label: 'Continue with Google' },
  { strategy: 'oauth_tiktok', label: 'Continue with TikTok' },
];

function ProviderButton({
  strategy,
  label,
  isPending,
  disabled,
  onPress,
}: {
  strategy: OAuthStrategy;
  label: string;
  isPending: boolean;
  disabled: boolean;
  onPress: (strategy: OAuthStrategy) => void;
}) {
  const theme = useTheme();
  const pressed = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(pressed.value, [0, 1], [1, 0.97]) }],
  }));

  function onPressIn() {
    // eslint-disable-next-line react-hooks/immutability -- Reanimated shared values are mutated by design
    pressed.value = withTiming(1, { duration: 120 });
  }

  function onPressOut() {
    // eslint-disable-next-line react-hooks/immutability -- Reanimated shared values are mutated by design
    pressed.value = withTiming(0, { duration: 120 });
  }

  function handlePress() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress(strategy);
  }

  return (
    <AnimatedPressable
      onPress={handlePress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, busy: isPending }}
      style={[styles.button, animatedStyle, { backgroundColor: theme.backgroundElement, opacity: disabled ? 0.6 : 1 }]}>
      <ThemedText type="smallBold">{isPending ? 'Connecting…' : label}</ThemedText>
    </AnimatedPressable>
  );
}

export function OAuthButtons({ onError }: { onError: (message: string) => void }) {
  const { startSSOFlow } = useSSO();
  const router = useRouter();
  const [pendingStrategy, setPendingStrategy] = useState<OAuthStrategy | null>(null);

  async function onPress(strategy: OAuthStrategy) {
    setPendingStrategy(strategy);
    try {
      const { createdSessionId, setActive, authSessionResult } = await startSSOFlow({
        strategy,
        redirectUrl: Linking.createURL('/sso-callback', { scheme: 'creatordocks' }),
      });

      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
        router.replace('/discover');
      } else if (!isUserCancellation(authSessionResult)) {
        // Authenticated but no usable session. The usual cause is a Clerk
        // session task (e.g. `choose-organization`) leaving the session
        // `pending` — Clerk treats that as signed-out, so say so plainly
        // rather than looking like a random failure.
        onError("Sign-in couldn't be completed for this account. Please contact support.");
      }
    } catch (err) {
      if (isSessionExistsError(err)) {
        // A session is already active on this device — nothing to fix, just go.
        router.replace('/discover');
      } else if (!isUserCancelledError(err)) {
        // Keep the diagnostic locally — the user-facing copy stays generic.
        if (__DEV__) console.error('[sso] flow failed', JSON.stringify(err, null, 2), err);
        onError('Unable to continue. Please try again.');
      }
    } finally {
      setPendingStrategy(null);
    }
  }

  return (
    <View style={styles.container}>
      {PROVIDERS.map(({ strategy, label }) => (
        <ProviderButton
          key={strategy}
          strategy={strategy}
          label={label}
          isPending={pendingStrategy === strategy}
          disabled={pendingStrategy !== null}
          onPress={onPress}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.two,
  },
  button: {
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
});
