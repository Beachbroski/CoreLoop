import { useAuth } from '@clerk/clerk-expo';
import { useMutation } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api-client';
import { z } from 'zod';

/**
 * Permanently deletes the signed-in user's account (Apple 5.1.1(v) requires
 * this in-app). No cache invalidation — the caller signs out and clears the
 * whole query cache on success.
 */
export function useDeleteAccount() {
  const { getToken } = useAuth();

  return useMutation({
    mutationFn: async () => {
      const token = await getToken();
      return apiFetch('/api/v1/me', z.null(), { method: 'DELETE', token });
    },
  });
}
