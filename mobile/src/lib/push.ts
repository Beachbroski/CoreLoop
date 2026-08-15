import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { z } from 'zod';

import { apiFetch } from './api-client';

type GetToken = () => Promise<string | null>;

// The token this device last registered, kept so we can unregister it on
// sign-out (the DELETE needs a Clerk token, fetched before the session ends).
let registeredToken: string | null = null;

/**
 * Registers this device's Expo push token with the backend so the creator can
 * receive status-change notifications. No-ops on the simulator (push requires
 * a physical device) and when no EAS projectId is configured yet — so it's
 * safe to call unconditionally; it activates once the app has a device build
 * with push credentials.
 */
export async function registerForPushNotifications(getToken: GetToken): Promise<void> {
  if (!Device.isDevice) return;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) {
    if (__DEV__) console.warn('[push] no EAS projectId — skipping device registration');
    return;
  }

  const existing = await Notifications.getPermissionsAsync();
  let granted = existing.granted;
  if (!granted && existing.canAskAgain) {
    const requested = await Notifications.requestPermissionsAsync();
    granted = requested.granted;
  }
  if (!granted) return;

  const { data: expoPushToken } = await Notifications.getExpoPushTokenAsync({ projectId });

  const authToken = await getToken();
  await apiFetch('/api/v1/devices', z.null(), {
    method: 'POST',
    body: { expoPushToken, platform: Platform.OS === 'android' ? 'android' : 'ios' },
    token: authToken,
  });
  registeredToken = expoPushToken;
}

/** Best-effort unregister on sign-out so the old identity stops receiving pushes. */
export async function unregisterForPushNotifications(getToken: GetToken): Promise<void> {
  if (!registeredToken) return;

  const token = registeredToken;
  registeredToken = null;
  try {
    const authToken = await getToken();
    await apiFetch(`/api/v1/devices/${encodeURIComponent(token)}`, z.null(), {
      method: 'DELETE',
      token: authToken,
    });
  } catch {
    // Best-effort — a dead token is pruned server-side on the next send anyway.
  }
}
