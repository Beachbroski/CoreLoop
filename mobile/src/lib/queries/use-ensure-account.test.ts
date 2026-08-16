import { ApiError } from '@/lib/api-client';
import { isNotInvitedError, NOT_INVITED_ERROR } from './use-ensure-account';

describe('isNotInvitedError', () => {
  it('recognizes the not-invited 403 so the app can show the waitlist gate', () => {
    expect(isNotInvitedError(new ApiError(NOT_INVITED_ERROR, 403))).toBe(true);
  });

  it('does not treat other 403s as not-invited', () => {
    // A creator-only endpoint refusing a BRAND account is also a 403, but it
    // must not send the user to the waitlist screen.
    expect(isNotInvitedError(new ApiError('Forbidden', 403))).toBe(false);
  });

  it('does not treat other statuses as not-invited', () => {
    expect(isNotInvitedError(new ApiError(NOT_INVITED_ERROR, 500))).toBe(false);
    expect(isNotInvitedError(new ApiError('Unauthorized', 401))).toBe(false);
  });

  it('handles non-ApiError values safely', () => {
    expect(isNotInvitedError(new Error(NOT_INVITED_ERROR))).toBe(false);
    expect(isNotInvitedError(null)).toBe(false);
    expect(isNotInvitedError(undefined)).toBe(false);
    expect(isNotInvitedError(NOT_INVITED_ERROR)).toBe(false);
  });
});
