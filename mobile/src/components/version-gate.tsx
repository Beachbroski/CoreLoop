import Constants from 'expo-constants';
import * as Haptics from 'expo-haptics';
import * as Linking from 'expo-linking';
import { useState, type PropsWithChildren, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { z } from 'zod';

import { useMeta } from '@/lib/queries/use-meta';
import { isVersionBelow } from '@/lib/version-gate';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { PrimaryButton } from './primary-button';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

// This value comes out of app.json and is handed straight to Linking.openURL,
// so it is validated as an Apple listing URL rather than trusted — anything
// else is either a typo or a way to send a blocked creator somewhere they
// never asked to go.
const appStoreUrlSchema = z
  .string()
  .trim()
  .regex(/^(https:\/\/apps\.apple\.com\/|itms-apps:\/\/)/);

/**
 * The App Store listing for this app, from `expo.extra.appStoreUrl`.
 *
 * Null until someone fills it in: App Store Connect only assigns the numeric
 * app ID the URL needs once the app record exists, and a guessed ID would
 * deep-link blocked creators into a stranger's listing. The gate degrades to
 * written instructions plus a re-check rather than offering a link that lies.
 */
function readAppStoreUrl(): string | null {
  const parsed = appStoreUrlSchema.safeParse(Constants.expoConfig?.extra?.appStoreUrl);
  return parsed.success ? parsed.data : null;
}

type BlockingMessageProps = {
  title: string;
  body: string;
  onRecheck: () => void;
  isRechecking: boolean;
  action?: ReactNode;
  notice?: string | null;
};

/**
 * A blocked launch is the one screen with no navigation, no tab bar and no
 * pull-to-refresh, so whatever it offers is the creator's only move. It always
 * offers at least a re-check: both block conditions are server-side and can
 * clear while the app sits on this screen.
 */
function BlockingMessage({ title, body, onRecheck, isRechecking, action, notice }: BlockingMessageProps) {
  const theme = useTheme();

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title" style={styles.centered}>
        {title}
      </ThemedText>
      <ThemedText themeColor="textSecondary" style={styles.centered}>
        {body}
      </ThemedText>

      <View style={styles.actions}>
        {action}
        <Pressable
          onPress={onRecheck}
          disabled={isRechecking}
          accessibilityRole="button"
          accessibilityLabel="Check again"
          accessibilityState={{ disabled: isRechecking, busy: isRechecking }}
          style={({ pressed }) => [
            styles.recheck,
            {
              backgroundColor: pressed ? theme.backgroundSelected : theme.backgroundElement,
              borderColor: theme.border,
            },
            isRechecking && styles.recheckBusy,
          ]}>
          <ThemedText type="smallBold">{isRechecking ? 'Checking…' : 'Check again'}</ThemedText>
        </Pressable>
      </View>

      {notice ? (
        <ThemedText type="small" themeColor="danger" style={styles.centered}>
          {notice}
        </ThemedText>
      ) : null}
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
  const { data: meta, refetch, isFetching } = useMeta();
  const [linkError, setLinkError] = useState<string | null>(null);
  const currentVersion = Constants.expoConfig?.version ?? '0.0.0';
  const appStoreUrl = readAppStoreUrl();

  function handleRecheck() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLinkError(null);
    // react-query reports query failures through the result rather than this
    // promise, but a rejected refetch still must not surface as an unhandled
    // rejection — and a re-check that fails leaves the gate exactly as it was.
    refetch().catch((err: unknown) => {
      if (__DEV__) console.warn('[version-gate] meta re-check failed', err);
    });
  }

  function handleOpenAppStore() {
    if (!appStoreUrl) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Linking.openURL(appStoreUrl).catch(() =>
      setLinkError("Couldn't open the App Store. Search for CreatorDocks there to update."),
    );
  }

  if (meta?.maintenanceMode) {
    return (
      <BlockingMessage
        title="Down for maintenance"
        body="CreatorDocks is briefly unavailable. Check again in a few minutes."
        onRecheck={handleRecheck}
        isRechecking={isFetching}
      />
    );
  }

  if (meta && isVersionBelow(currentVersion, meta.minSupportedAppVersion)) {
    return (
      <BlockingMessage
        title="Update required"
        body={
          appStoreUrl
            ? 'A newer version of CreatorDocks is required to continue.'
            : 'A newer version of CreatorDocks is required to continue. Update it from the App Store, then check again.'
        }
        onRecheck={handleRecheck}
        isRechecking={isFetching}
        notice={linkError}
        action={
          appStoreUrl ? <PrimaryButton onPress={handleOpenAppStore}>Open the App Store</PrimaryButton> : undefined
        }
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
  centered: {
    textAlign: 'center',
  },
  actions: {
    alignSelf: 'center',
    alignItems: 'stretch',
    // PrimaryButton has no width of its own — it fills whatever it is given —
    // so the column is capped rather than stretched edge to edge on a phone.
    maxWidth: 320,
    width: '100%',
    marginTop: Spacing.two,
    gap: Spacing.two,
  },
  recheck: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two + 2,
    // 44pt is Apple's minimum touch target; the padding alone gave 40pt.
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recheckBusy: {
    opacity: 0.6,
  },
});
