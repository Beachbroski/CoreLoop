import type { ErrorBoundaryProps } from 'expo-router';
import { useEffect } from 'react';

import { ErrorState } from '@/components/error-state';
import { Screen } from '@/components/screen';

/** What a creator sees when a screen throws. Not the error text — that is ours to read, not theirs. */
export const CRASH_MESSAGE = 'Something went wrong on this screen.';

/**
 * The one place a render crash is written down.
 *
 * There is no crash reporter in the app yet (audit H5). Until Sentry lands,
 * `console.error` is what a Metro session and the device console can show, and
 * this function is the single call site that has to change when it does.
 */
export function reportRenderError(error: Error): void {
  console.error('[error-boundary] uncaught render error', error);
}

export type AppErrorBoundaryProps = ErrorBoundaryProps & {
  /** Override when "this screen" is a lie — e.g. the root boundary, where the whole app went. */
  message?: string;
};

/**
 * Rendered by expo-router in place of a route whose render threw.
 *
 * The mechanism is opt-in and easy to miss: `useScreens.fromImport` wraps a
 * route in `<Try catch={ErrorBoundary}>` **only if that route file exports a
 * component named `ErrorBoundary`** (node_modules/expo-router/build/useScreens.js:141-160).
 * Without the export there is no boundary at all, and an uncaught render error
 * in a release build tears down the React tree and closes the app — which is
 * exactly what this app did before this component existed.
 *
 * `retry` is expo-router's: it clears the caught error so the route re-mounts
 * and re-renders. For a transient failure (a bad payload that a refetch fixes)
 * that genuinely recovers; for a deterministic crash it fails again into the
 * same screen, which is still strictly better than the app disappearing.
 */
export function AppErrorBoundary({ error, retry, message = CRASH_MESSAGE }: AppErrorBoundaryProps) {
  useEffect(() => {
    reportRenderError(error);
  }, [error]);

  function handleRetry() {
    // `retry` resolves after the re-render; a rejection here would otherwise be
    // an unhandled promise rejection on top of the crash we are recovering from.
    retry().catch((err: unknown) => {
      if (__DEV__) console.warn('[error-boundary] retry failed', err);
    });
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <ErrorState message={message} onRetry={handleRetry} />
    </Screen>
  );
}
