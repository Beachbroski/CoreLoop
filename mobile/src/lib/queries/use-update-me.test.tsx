import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { ApiError } from '@/lib/api-client';
import { useUpdateMe } from './use-update-me';

/**
 * The first write the app makes to the creator's own profile. It goes through
 * the real `apiFetch`, so these tests also pin the two things a mutation can
 * get quietly wrong: the bearer token actually reaching the request, and the
 * server's rejection message reaching the caller instead of being swallowed.
 */

const PROFILE = {
  id: 'user_1',
  name: 'Ada',
  email: 'ada@example.com',
  avatarUrl: null,
  bio: 'Making things.',
  role: 'CREATOR',
  stripeOnboarded: true,
};

function mockFetchOnce(body: unknown, status = 200) {
  globalThis.fetch = jest.fn().mockResolvedValue({
    status,
    json: async () => body,
  }) as unknown as typeof fetch;
}

/** Retries off, or an error assertion waits through two backoffs first. */
function testClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function wrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useUpdateMe', () => {
  const originalEnv = process.env.EXPO_PUBLIC_API_URL;
  let queryClient: QueryClient;

  beforeEach(() => {
    process.env.EXPO_PUBLIC_API_URL = 'https://api.example.com';
    queryClient = testClient();
  });

  afterEach(() => {
    // Not tidiness: an un-cleared client leaves five-minute gc timers running
    // and Jest force-exits the worker over them.
    queryClient.clear();
    process.env.EXPO_PUBLIC_API_URL = originalEnv;
    jest.restoreAllMocks();
  });

  it('PATCHes /api/v1/me with the edited fields and the session token', async () => {
    mockFetchOnce({ success: true, data: PROFILE });
    const { result } = await renderHook(() => useUpdateMe(), { wrapper: wrapper(queryClient) });

    result.current.mutate({ name: 'Ada', bio: 'Making things.' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://api.example.com/api/v1/me',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ name: 'Ada', bio: 'Making things.' }),
        headers: expect.objectContaining({ authorization: 'Bearer test-token' }),
      }),
    );
  });

  it('returns the updated profile, validated against the shared schema', async () => {
    mockFetchOnce({ success: true, data: PROFILE });
    const { result } = await renderHook(() => useUpdateMe(), { wrapper: wrapper(queryClient) });

    result.current.mutate({ bio: 'Making things.' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(PROFILE);
  });

  it('invalidates the cached profile so every screen reading it catches up', async () => {
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries');
    mockFetchOnce({ success: true, data: PROFILE });
    const { result } = await renderHook(() => useUpdateMe(), { wrapper: wrapper(queryClient) });

    result.current.mutate({ name: 'Ada' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['me'] });
  });

  it("surfaces the server's rejection rather than swallowing it", async () => {
    // The 400 a too-long bio earns: the screen needs the reason, not a shrug.
    mockFetchOnce({ success: false, error: 'Too big: expected string to have <=500 characters' }, 400);
    const { result } = await renderHook(() => useUpdateMe(), { wrapper: wrapper(queryClient) });

    result.current.mutate({ bio: 'x'.repeat(501) });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(ApiError);
    expect(result.current.error?.message).toBe('Too big: expected string to have <=500 characters');
  });

  it('leaves the cache alone when the update fails', async () => {
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries');
    mockFetchOnce({ success: false, error: 'Invalid request' }, 400);
    const { result } = await renderHook(() => useUpdateMe(), { wrapper: wrapper(queryClient) });

    result.current.mutate({ name: '' });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(invalidate).not.toHaveBeenCalled();
  });
});
