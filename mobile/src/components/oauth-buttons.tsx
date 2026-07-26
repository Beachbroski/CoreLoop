import { useSSO } from '@clerk/clerk-expo';
import type { OAuthStrategy } from '@clerk/types';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ThemedText } from './themed-text';

const PROVIDERS: { strategy: OAuthStrategy; label: string }[] = [
  { strategy: 'oauth_google', label: 'Continue with Google' },
  { strategy: 'oauth_tiktok', label: 'Continue with TikTok' },
];

export function OAuthButtons({ onError }: { onError: (message: string) => void }) {
  const { startSSOFlow } = useSSO();
  const router = useRouter();
  const theme = useTheme();
  const [pendingStrategy, setPendingStrategy] = useState<OAuthStrategy | null>(null);

  async function onPress(strategy: OAuthStrategy) {
    setPendingStrategy(strategy);
    try {
      const { createdSessionId, setActive } = await startSSOFlow({
        strategy,
        redirectUrl: Linking.createURL('/sso-callback', { scheme: 'creatordocks' }),
      });

      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
        router.replace('/discover');
      }
    } catch {
      onError('Unable to continue. Please try again.');
    } finally {
      setPendingStrategy(null);
    }
  }

  return (
    <View style={styles.container}>
      {PROVIDERS.map(({ strategy, label }) => (
        <Pressable
          key={strategy}
          onPress={() => onPress(strategy)}
          disabled={pendingStrategy !== null}
          style={[
            styles.button,
            { backgroundColor: theme.backgroundElement, opacity: pendingStrategy !== null ? 0.6 : 1 },
          ]}>
          <ThemedText type="smallBold">
            {pendingStrategy === strategy ? 'Connecting…' : label}
          </ThemedText>
        </Pressable>
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
