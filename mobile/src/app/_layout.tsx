import { ClerkProvider } from '@clerk/clerk-expo';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useColorScheme } from 'react-native';

import { VersionGate } from '@/components/version-gate';
import { secureTokenCache } from '@/lib/token-cache';

const queryClient = new QueryClient();

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
