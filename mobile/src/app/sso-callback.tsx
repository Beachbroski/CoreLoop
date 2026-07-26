import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { StyleSheet } from 'react-native';

// Clerk's SSO flow completes inside the useSSO() promise (see
// components/oauth-buttons.tsx) — expo-web-browser intercepts the redirect
// before the app router sees it. This route exists only as a safe landing
// spot in case that interception doesn't happen for some reason.
export default function SSOCallbackScreen() {
  return (
    <ThemedView style={styles.container}>
      <ThemedText themeColor="textSecondary">Finishing sign in…</ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.four,
  },
});
