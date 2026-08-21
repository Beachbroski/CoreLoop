import { focusManager, QueryClient } from '@tanstack/react-query';
import { AppState, type AppStateStatus } from 'react-native';

import { ApiError } from './api-client';

/**
 * A 4xx from our own API (401/403/404/409/...) is never going to succeed on
 * retry — it's a permanent rejection, not a transient network blip. Retrying
 * it anyway (React Query's default) just re-hits a forbidden/missing
 * endpoint a few times with exponential backoff before finally giving up,
 * which is both wasted load and a slower, confusing loading state for
 * something that was never going to change.
 */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
    return false;
  }
  return failureCount < 2;
}

/** React Native's only "the user is looking at us again" signal. */
export function isForeground(status: AppStateStatus): boolean {
  return status === 'active';
}

/**
 * Teaches React Query when the app is in the foreground.
 *
 * Its stock focus listener is a DOM `visibilitychange` handler, which never
 * fires under React Native — so every query stays permanently "focused" and
 * `refetchOnWindowFocus` never fires. That is why a creator watching a PENDING
 * submission could background the app, come back, and read the same stale
 * verdict indefinitely: nothing on a detail screen ever asked the server again.
 *
 * `focusManager.setEventListener` replaces any previous listener and runs its
 * cleanup, so calling this more than once cannot leak an AppState subscription.
 */
export function bindAppFocus(): void {
  focusManager.setEventListener((handleFocus) => {
    const subscription = AppState.addEventListener('change', (status) => {
      handleFocus(isForeground(status));
    });
    return () => subscription.remove();
  });
}

/**
 * NOTE — connectivity is still unwired. React Query's `onlineManager` also
 * defaults to browser `online`/`offline` events, so on device it believes the
 * app is online forever: an offline request is fired anyway and fails as a
 * generic error instead of being paused until the radio comes back.
 *
 * Fixing it needs a connectivity source, and the only real ones
 * (@react-native-community/netinfo, expo-network) are native modules. Adding
 * one without rebuilding the dev client is a crash on launch rather than a
 * build error, so it is deliberately left out of this change. Once the module
 * is installed and the client rebuilt, the wiring is:
 *
 *   onlineManager.setEventListener((setOnline) =>
 *     NetInfo.addEventListener((state) => setOnline(Boolean(state.isConnected))),
 *   );
 */

export function createQueryClient(): QueryClient {
  // Bound here rather than in a layout effect: `focusManager` is a process-wide
  // singleton, this is the one place the app builds its client, and doing it at
  // construction means no screen has to remember to opt in.
  bindAppFocus();

  return new QueryClient({
    defaultOptions: {
      queries: { retry: shouldRetry },
      mutations: { retry: shouldRetry },
    },
  });
}
