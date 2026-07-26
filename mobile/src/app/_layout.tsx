import { ClerkProvider } from '@clerk/clerk-expo';
import { QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useColorScheme } from 'react-native';

import { VersionGate } from '@/components/version-gate';
import { createQueryClient } from '@/lib/query-client';
import { secureTokenCache } from '@/lib/token-cache';

const queryClient = createQueryClient();

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ClerkProvider tokenCache={secureTokenCache}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <VersionGate>
            <Stack screenOptions={{ headerShown: false }} />
          </VersionGate>
        </ThemeProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}
