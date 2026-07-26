import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { StyleSheet, View } from 'react-native';

// Clerk's SSO flow completes inside the useSSO() promise (see
// components/oauth-buttons.tsx) — expo-web-browser intercepts the redirect
// before the app router sees it. This route exists only as a safe landing
// spot in case that interception doesn't happen for some reason.
export default function SSOCallbackScreen() {
  return (
    <Screen edges={['top', 'bottom']}>
      <View style={styles.container}>
        <ThemedText themeColor="textSecondary">Finishing sign in…</ThemedText>
      </View>
    </Screen>
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
