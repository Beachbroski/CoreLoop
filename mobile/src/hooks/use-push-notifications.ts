import { useAuth } from '@clerk/clerk-expo';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';

import { registerForPushNotifications } from '@/lib/push';

// Foreground notifications still surface a banner (SDK 57 field names).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Registers the device for push once signed in and routes notification taps to
 * the screen named in the payload's `url`. Mounted once in the authed layout.
 *
 * `enabled` gates registration on the account row existing: POST /api/v1/devices
 * is the first authenticated call the app makes, and it 401s (silently) until
 * onboarding has created the row — so a brand-new creator would never register
 * for push at all.
 */
export function usePushNotifications(enabled = true) {
  const { isSignedIn, getToken } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isSignedIn || !enabled) return;
    registerForPushNotifications(getToken).catch((err) => {
      if (__DEV__) console.warn('[push] registration failed', err);
    });
  }, [isSignedIn, enabled, getToken]);

  useEffect(() => {
    let cancelled = false;

    function openFromResponse(response: Notifications.NotificationResponse | null) {
      const url = response?.notification.request.content.data?.url;
      // Deep-link payloads are untrusted. Only follow an in-app absolute path,
      // and reject '//host' which the browser/router would treat as external.
      if (typeof url !== 'string' || !url.startsWith('/') || url.startsWith('//')) return;
      router.push(url as Parameters<typeof router.push>[0]);
    }

    // A tap that LAUNCHES the app (the most common case — the app is usually
    // killed when a push arrives) never reaches the listener below; its
    // response is only retrievable via getLastNotificationResponseAsync.
    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (!cancelled) openFromResponse(response);
      })
      .catch(() => {
        // A missing launch response is normal — nothing to recover.
      });

    const subscription = Notifications.addNotificationResponseReceivedListener(openFromResponse);
    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, [router]);
}
