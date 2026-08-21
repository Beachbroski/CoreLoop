import { focusManager } from '@tanstack/react-query';
import { AppState, type AppStateStatus } from 'react-native';

import { ApiError } from './api-client';
import { bindAppFocus, createQueryClient, isForeground, shouldRetry } from './query-client';

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

describe('isForeground', () => {
  it('counts only the active state as focused', () => {
    expect(isForeground('active')).toBe(true);
  });

  it.each<AppStateStatus>(['background', 'inactive', 'unknown', 'extension'])(
    'does not count %s as focused',
    (status) => {
      // `inactive` is the app-switcher / incoming-call state on iOS: on screen
      // but not interactive, and not a moment to spend the user's data on.
      expect(isForeground(status)).toBe(false);
    },
  );
});

/**
 * Stands in for the native AppState module and hands back the listeners that
 * were registered, so a test can drive a foreground transition by hand.
 * Each registration gets its own `remove`, which is how the teardown assertion
 * stays independent of anything a previous test bound.
 */
function stubAppState() {
  const handlers: ((status: AppStateStatus) => void)[] = [];
  const removals: jest.Mock[] = [];

  jest.spyOn(AppState, 'addEventListener').mockImplementation(((
    _type: string,
    handler: (status: AppStateStatus) => void,
  ) => {
    handlers.push(handler);
    const remove = jest.fn();
    removals.push(remove);
    return { remove };
  }) as unknown as typeof AppState.addEventListener);

  return { handlers, removals };
}

describe('bindAppFocus', () => {
  afterEach(() => jest.restoreAllMocks());

  it('subscribes to AppState changes', () => {
    const { handlers } = stubAppState();

    bindAppFocus();

    expect(AppState.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    expect(handlers).toHaveLength(1);
  });

  it('tells React Query the app lost and regained focus', () => {
    // The whole point: without this, `refetchOnWindowFocus` never fires on
    // device and a PENDING submission verdict stays PENDING on screen forever.
    const { handlers } = stubAppState();
    const setFocused = jest.spyOn(focusManager, 'setFocused');

    bindAppFocus();
    handlers[0]('background');
    expect(setFocused).toHaveBeenLastCalledWith(false);

    handlers[0]('active');
    expect(setFocused).toHaveBeenLastCalledWith(true);
  });

  it('replaces its subscription instead of stacking a second one', () => {
    const { handlers, removals } = stubAppState();

    bindAppFocus();
    bindAppFocus();

    expect(handlers).toHaveLength(2);
    expect(removals[0]).toHaveBeenCalledTimes(1);
    expect(removals[1]).not.toHaveBeenCalled();
  });
});

describe('createQueryClient', () => {
  afterEach(() => jest.restoreAllMocks());

  it('binds app focus, so no screen has to remember to', () => {
    stubAppState();

    createQueryClient();

    expect(AppState.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
  });
});
