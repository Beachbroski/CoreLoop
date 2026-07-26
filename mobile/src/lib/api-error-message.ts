import { ApiError } from './api-client';

/** Shared across every screen that queries a creator-only endpoint. */
export function loadErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 403) {
    return 'This account isn’t a creator account, so there’s nothing to show here.';
  }
  return "Couldn't load. Pull to retry.";
}
