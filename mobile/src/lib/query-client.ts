import { QueryClient } from '@tanstack/react-query';

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

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: shouldRetry },
      mutations: { retry: shouldRetry },
    },
  });
}
