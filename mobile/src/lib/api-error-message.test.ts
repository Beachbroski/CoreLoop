import { ApiError } from './api-client';
import { loadErrorMessage } from './api-error-message';

describe('loadErrorMessage', () => {
  it('gives a specific message for a 403', () => {
    expect(loadErrorMessage(new ApiError('Forbidden', 403))).toMatch(/creator account/i);
  });

  it('gives a generic message for other errors', () => {
    expect(loadErrorMessage(new ApiError('Server error', 500))).toBe("Couldn't load. Pull to retry.");
    expect(loadErrorMessage(new Error('network down'))).toBe("Couldn't load. Pull to retry.");
  });
});
