import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderOptions } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';

/**
 * Shared render helper for component and screen tests.
 *
 * Two things every test here needs to know:
 *
 * 1. **`render` is async in RNTL 14.** Always `await renderWithProviders(...)`.
 *    Forgetting the await does not throw — you get an undefined result and a
 *    confusing "Cannot read properties of undefined" three lines later.
 * 2. **Retries are off.** The app's real client retries non-4xx failures twice
 *    (see lib/query-client.ts), which in a test means an error-state assertion
 *    waits through two backoffs before the UI ever shows the error. Production
 *    retry behavior is covered by query-client.test.ts instead.
 */

/** A fresh client per render — a shared cache leaks state between tests. */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

type RenderWithProvidersOptions = Omit<RenderOptions, 'wrapper'> & {
  /** Pass a pre-seeded client to test cache-hit paths. */
  queryClient?: QueryClient;
};

export async function renderWithProviders(ui: ReactElement, options: RenderWithProvidersOptions = {}) {
  const { queryClient = createTestQueryClient(), ...renderOptions } = options;

  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }

  const result = await render(ui, { wrapper: Wrapper, ...renderOptions });

  return { ...result, queryClient };
}

export * from '@testing-library/react-native';
