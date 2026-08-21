import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { z } from 'zod';

import { apiFetch } from './api-client';

type GetToken = () => Promise<string | null>;

/**
 * Why registration did — or did not — happen.
 *
 * Every early return below is a legitimate no-op, which makes a real failure
 * look exactly like a correct skip at the call site. Returning the outcome is
 * what lets a caller tell them apart; `denied` in particular is the only one
 * the creator can still act on, so a priming/re-ask UI needs to see it.
 */
export type PushRegistration =
  | { status: 'registered'; expoPushToken: string }
  | { status: 'unsupported' }
  | { status: 'unconfigured' }
  | { status: 'denied'; canAskAgain: boolean };

// The token this device last registered, kept so we can unregister it on
// sign-out (the DELETE needs a Clerk token, fetched before the session ends).
let registeredToken: string | null = null;

// `expo.extra` is free-form JSON that arrives untyped, so the projectId is
// validated at the boundary rather than handed straight to the SDK — a blank
// or non-string value would otherwise pass the old truthiness check on `''`'s
// cousins and fail much later, inside getExpoPushTokenAsync.
const projectIdSchema = z.string().trim().min(1);

/**
 * Reads the EAS projectId that `eas init` writes into `expo.extra.eas.projectId`
 * in app.json. Returns null rather than throwing when it is absent: a local dev
 * build with no EAS project is a legitimate state, not a bug.
 */
function readEasProjectId(): string | null {
  const parsed = projectIdSchema.safeParse(Constants.expoConfig?.extra?.eas?.projectId);
  return parsed.success ? parsed.data : null;
}

/**
 * Expo's own failure here reads "Encountered an error while fetching the
 * token", which sends people hunting a network problem. It is almost always
 * configuration — the build carries no APNs key, or the projectId names a
 * different EAS project than the one the build was signed for — so the throw
 * is re-worded to say that. The message has to stand on its own: Hermes may
 * drop `cause`, and the caller only logs.
 */
async function mintExpoPushToken(projectId: string): Promise<string> {
  try {
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return data;
  } catch (cause) {
    throw new Error(
      `[push] could not mint an Expo push token for EAS project ${projectId} — check that this build has push credentials (\`eas credentials\`) and that the projectId matches the project it was signed for`,
      { cause },
    );
  }
}

/**
 * Registers this device's Expo push token with the backend so the creator can
 * receive status-change notifications. Safe to call unconditionally: it reports
 * `unsupported` on the simulator (push tokens do not exist there) and
 * `unconfigured` until an EAS projectId is set, instead of failing.
 *
 * Throws only on a genuine failure — minting the token, or the POST — so the
 * caller can distinguish "nothing to do" from "this broke".
 */
export async function registerForPushNotifications(getToken: GetToken): Promise<PushRegistration> {
  if (!Device.isDevice) return { status: 'unsupported' };

  const projectId = readEasProjectId();
  if (!projectId) {
    // Nothing the creator can act on, but this silence has swallowed the whole
    // push feature before now — so it is loud in dev.
    if (__DEV__) {
      console.warn(
        '[push] expo.extra.eas.projectId is missing from app.json — run `eas init`. ' +
          'Until it exists no device can register and no notification can be delivered.',
      );
    }
    return { status: 'unconfigured' };
  }

  const existing = await Notifications.getPermissionsAsync();
  let granted = existing.granted;
  // Tracked separately from `granted` because a denial that can still be
  // re-asked (the creator has not seen the system prompt yet) is a different
  // situation from one iOS will never show again.
  let canAskAgain = existing.canAskAgain;

  if (!granted && existing.canAskAgain) {
    const requested = await Notifications.requestPermissionsAsync();
    granted = requested.granted;
    canAskAgain = requested.canAskAgain;
  }
  if (!granted) return { status: 'denied', canAskAgain: Boolean(canAskAgain) };

  const expoPushToken = await mintExpoPushToken(projectId);

  const authToken = await getToken();
  await apiFetch('/api/v1/devices', z.null(), {
    method: 'POST',
    body: { expoPushToken, platform: Platform.OS === 'android' ? 'android' : 'ios' },
    token: authToken,
  });
  registeredToken = expoPushToken;
  return { status: 'registered', expoPushToken };
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
  } catch (err) {
    // Best-effort — a dead token is pruned server-side on the next send anyway,
    // and a failed unregister must never block signing out. Still worth seeing
    // in dev, where it usually means the DELETE route or the token is wrong.
    if (__DEV__) console.warn('[push] unregister failed; server will prune the token', err);
  }
}
