import { isUserCancellation, isUserCancelledError } from './sso-cancellation';

describe('isUserCancellation', () => {
  it('treats cancel and dismiss auth-session results as user cancellation', () => {
    expect(isUserCancellation({ type: 'cancel' })).toBe(true);
    expect(isUserCancellation({ type: 'dismiss' })).toBe(true);
  });

  it('does not treat success, locked, or opened as cancellation', () => {
    expect(isUserCancellation({ type: 'success' })).toBe(false);
    expect(isUserCancellation({ type: 'locked' })).toBe(false);
    expect(isUserCancellation({ type: 'opened' })).toBe(false);
  });

  it('handles a null or missing result', () => {
    expect(isUserCancellation(null)).toBe(false);
    expect(isUserCancellation(undefined)).toBe(false);
  });
});

describe('isUserCancelledError', () => {
  it('recognizes a Clerk oauth_access_denied error (user denied on provider page)', () => {
    const clerkError = { errors: [{ code: 'oauth_access_denied', message: 'Access denied' }] };
    expect(isUserCancelledError(clerkError)).toBe(true);
  });

  it('does not swallow real Clerk errors', () => {
    const clerkError = { errors: [{ code: 'oauth_callback_error', message: 'Something broke' }] };
    expect(isUserCancelledError(clerkError)).toBe(false);
  });

  it('handles non-object and empty errors', () => {
    expect(isUserCancelledError(undefined)).toBe(false);
    expect(isUserCancelledError(null)).toBe(false);
    expect(isUserCancelledError('cancelled')).toBe(false);
    expect(isUserCancelledError(new Error('boom'))).toBe(false);
  });
});
