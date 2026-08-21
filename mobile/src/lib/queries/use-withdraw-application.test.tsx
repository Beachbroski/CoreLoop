import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { useWithdrawApplication } from './use-withdraw-application';

/**
 * Withdrawing deletes the row server-side, so the interesting behaviour is not
 * the request but what it leaves behind in the cache: a detail entry that
 * outlives its resource is a ghost the next visit would render as live.
 */

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

describe('useWithdrawApplication', () => {
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

  it('drops the withdrawn application from the cache and refreshes the list', async () => {
    queryClient.setQueryData(['application', 'app_1'], { id: 'app_1' });
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries');
    mockFetchOnce({ success: true, data: null });

    const { result } = await renderHook(() => useWithdrawApplication(), { wrapper: wrapper(queryClient) });
    result.current.mutate('app_1');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['applications'] });
    expect(queryClient.getQueryData(['application', 'app_1'])).toBeUndefined();
  });

  it('leaves other applications cached', async () => {
    queryClient.setQueryData(['application', 'app_2'], { id: 'app_2' });
    mockFetchOnce({ success: true, data: null });

    const { result } = await renderHook(() => useWithdrawApplication(), { wrapper: wrapper(queryClient) });
    result.current.mutate('app_1');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(queryClient.getQueryData(['application', 'app_2'])).toEqual({ id: 'app_2' });
  });

  it('keeps the cache intact when the server refuses the withdrawal', async () => {
    // 409: the brand accepted it while the creator was looking at the button.
    queryClient.setQueryData(['application', 'app_1'], { id: 'app_1' });
    mockFetchOnce({ success: false, error: 'Only pending applications can be withdrawn' }, 409);

    const { result } = await renderHook(() => useWithdrawApplication(), { wrapper: wrapper(queryClient) });
    result.current.mutate('app_1');

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(queryClient.getQueryData(['application', 'app_1'])).toEqual({ id: 'app_1' });
    expect(result.current.error?.message).toBe('Only pending applications can be withdrawn');
  });
});
