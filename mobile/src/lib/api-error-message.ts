import { ApiError } from './api-client';

/** Shared across every screen that queries a creator-only endpoint. */
export function loadErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 403) {
    return 'This account isn’t a creator account, so there’s nothing to show here.';
  }
  // Not "Pull to retry". Every surface this string reaches — ErrorState and
  // StaleDataBanner — renders a labelled Retry control beside it, and neither
  // is inside anything pullable: ErrorState fills an unscrollable View, and the
  // banner sits above the scroll view rather than in it. Naming a gesture that
  // does not exist sends a creator on a bad connection swiping at a dead screen
  // while the button that would have worked is directly under the sentence.
  return "Couldn't load. Try again.";
}
