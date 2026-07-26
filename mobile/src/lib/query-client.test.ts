import { ApiError } from './api-client';
import { shouldRetry } from './query-client';

describe('shouldRetry', () => {
  it('never retries a 403 (permanent rejection, retrying can\'t help)', () => {
    expect(shouldRetry(0, new ApiError('Forbidden', 403))).toBe(false);
  });

  it('never retries any 4xx', () => {
    expect(shouldRetry(0, new ApiError('Not found', 404))).toBe(false);
    expect(shouldRetry(0, new ApiError('Conflict', 409))).toBe(false);
  });

  it('retries a 500 up to the failure-count limit', () => {
    expect(shouldRetry(0, new ApiError('Internal error', 500))).toBe(true);
    expect(shouldRetry(1, new ApiError('Internal error', 500))).toBe(true);
    expect(shouldRetry(2, new ApiError('Internal error', 500))).toBe(false);
  });

  it('retries a non-ApiError (e.g. network failure) up to the limit', () => {
    expect(shouldRetry(0, new TypeError('Network request failed'))).toBe(true);
    expect(shouldRetry(2, new TypeError('Network request failed'))).toBe(false);
  });
});
