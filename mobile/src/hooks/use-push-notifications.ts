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
 */
export function usePushNotifications() {
  const { isSignedIn, getToken } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isSignedIn) return;
    registerForPushNotifications(getToken).catch((err) => {
      if (__DEV__) console.warn('[push] registration failed', err);
    });
  }, [isSignedIn, getToken]);

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const url = response.notification.request.content.data?.url;
      // Deep-link params are untrusted: only follow an internal app path.
      if (typeof url === 'string' && url.startsWith('/')) {
        router.push(url as Parameters<typeof router.push>[0]);
      }
    });
    return () => subscription.remove();
  }, [router]);
}
