import Constants from 'expo-constants';
import type { PropsWithChildren } from 'react';
import { StyleSheet } from 'react-native';

import { useMeta } from '@/lib/queries/use-meta';
import { isVersionBelow } from '@/lib/version-gate';
import { Spacing } from '@/constants/theme';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

function BlockingMessage({ title, body }: { title: string; body: string }) {
  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">{title}</ThemedText>
      <ThemedText themeColor="textSecondary">{body}</ThemedText>
    </ThemedView>
  );
}

/**
 * Blocks the app on launch per /api/v1/meta — a maintenance window or a
 * build below the minimum supported version. Fails open on network errors
 * (offline shouldn't brick the app); the meta check just doesn't happen
 * that session.
 */
export function VersionGate({ children }: PropsWithChildren) {
  const { data: meta } = useMeta();
  const currentVersion = Constants.expoConfig?.version ?? '0.0.0';

  if (meta?.maintenanceMode) {
    return (
      <BlockingMessage
        title="Down for maintenance"
        body="CreatorDocks is briefly unavailable. Please check back soon."
      />
    );
  }

  if (meta && isVersionBelow(currentVersion, meta.minSupportedAppVersion)) {
    return (
      <BlockingMessage
        title="Update required"
        body="A newer version of CreatorDocks is required to continue. Please update from the App Store."
      />
    );
  }

  return children;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.four,
  },
});
