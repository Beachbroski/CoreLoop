import { ApiError } from './api-client';
import { loadErrorMessage } from './api-error-message';

describe('loadErrorMessage', () => {
  it('gives a specific message for a 403', () => {
    expect(loadErrorMessage(new ApiError('Forbidden', 403))).toMatch(/creator account/i);
  });

  it('gives a generic message for other errors', () => {
    expect(loadErrorMessage(new ApiError('Server error', 500))).toBe("Couldn't load. Try again.");
    expect(loadErrorMessage(new Error('network down'))).toBe("Couldn't load. Try again.");
  });

  /**
   * The copy is rendered next to a Retry button, never inside a pull-to-refresh
   * scroll view. Promising a gesture the surface does not support is the exact
   * bug this string used to have, so it is pinned rather than left to taste.
   */
  it('never promises a gesture the surface does not offer', () => {
    const messages = [
      loadErrorMessage(new ApiError('Forbidden', 403)),
      loadErrorMessage(new ApiError('Server error', 500)),
      loadErrorMessage(new Error('network down')),
    ];

    for (const message of messages) {
      expect(message).not.toMatch(/pull|swipe|drag/i);
    }
  });
});
