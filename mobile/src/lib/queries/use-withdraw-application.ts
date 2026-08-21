import { useAuth } from '@clerk/clerk-expo';
import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api-client';
import { z } from 'zod';

/**
 * Withdraws one of the creator's own pending applications. The server refuses
 * anything already accepted or rejected with a 409, which arrives here as an
 * `ApiError` for the screen to show.
 */
export function useWithdrawApplication(): UseMutationResult<null, Error, string> {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const token = await getToken();
      return apiFetch(`/api/v1/applications/${id}`, z.null(), { method: 'DELETE', token });
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      // Dropped rather than invalidated: the row is deleted, so there is
      // nothing to refetch. Leaving it cached would let a later visit to the
      // same id — a deep link, a push notification — render a withdrawn
      // application from cache as though it were still live.
      queryClient.removeQueries({ queryKey: ['application', id], exact: true });
    },
  });
}
