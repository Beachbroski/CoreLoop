import { ClerkProvider } from '@clerk/clerk-expo';
import { QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useColorScheme } from 'react-native';

import { VersionGate } from '@/components/version-gate';
import { Colors } from '@/constants/theme';
import { createQueryClient } from '@/lib/query-client';
import { secureTokenCache } from '@/lib/token-cache';

const queryClient = createQueryClient();

// Navigation-level colors must match our token sets, or stock navigator
// grays flash behind screens during transitions.
const navDark = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: Colors.dark.accent,
    background: Colors.dark.background,
    card: Colors.dark.backgroundElement,
    border: Colors.dark.border,
    text: Colors.dark.text,
  },
};

const navLight = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: Colors.light.accent,
    background: Colors.light.background,
    card: Colors.light.backgroundElement,
    border: Colors.light.border,
    text: Colors.light.text,
  },
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ClerkProvider tokenCache={secureTokenCache}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider value={colorScheme === 'dark' ? navDark : navLight}>
          <VersionGate>
            <Stack screenOptions={{ headerShown: false }} />
          </VersionGate>
        </ThemeProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}
