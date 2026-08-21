import { useAuth } from '@clerk/clerk-expo';
import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import { meResponseSchema, type MeResponse, type UpdateMeRequest } from '@creatordocks/shared';

import { apiFetch } from '@/lib/api-client';

/**
 * Edits the signed-in creator's own profile (`name`, `bio`).
 *
 * `PATCH /api/v1/me` answers with the full updated profile in the same shape
 * `GET /api/v1/me` returns, so invalidating `['me']` refreshes every screen
 * reading it. `['ensure-account']` caches the same payload but is only ever
 * read as a boolean gate in `(app)/_layout.tsx`, and its query function is a
 * POST to /onboarding — invalidating it would spend a round trip to change
 * nothing anyone renders.
 *
 * Validation is the server's: `updateMeRequestSchema` bounds `name` at 80 and
 * `bio` at 500 characters and 400s anything longer, which arrives here as an
 * `ApiError` carrying the server's own message.
 */
export function useUpdateMe(): UseMutationResult<MeResponse, Error, UpdateMeRequest> {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: UpdateMeRequest) => {
      const token = await getToken();
      return apiFetch('/api/v1/me', meResponseSchema, { method: 'PATCH', body, token });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me'] });
    },
  });
}
