import { useAuth } from '@clerk/clerk-expo';
import { useQuery } from '@tanstack/react-query';
import { meResponseSchema } from '@creatordocks/shared';

import { ApiError, apiFetch } from '@/lib/api-client';

/** Server sends this when the email isn't on the invite list yet. */
export const NOT_INVITED_ERROR = 'NOT_INVITED';

export function isNotInvitedError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 403 && error.message === NOT_INVITED_ERROR;
}

/**
 * Guarantees the signed-in Clerk identity has a CreatorDocks account, creating
 * one on first launch if needed, and returns it.
 *
 * Modelled as a query rather than a mutation because the endpoint is
 * idempotent get-or-create: every authenticated session needs the answer
 * before it can call anything else, and a query gives the caller pending /
 * error / data states without an effect to sequence it. `shouldRetry` in
 * query-client already declines to retry 4xx, so a not-invited 403 settles
 * immediately instead of hammering the endpoint.
 */
export function useEnsureAccount() {
  const { getToken, isSignedIn } = useAuth();

  return useQuery({
    queryKey: ['ensure-account'],
    enabled: Boolean(isSignedIn),
    // The account doesn't change underneath us during a session; re-running it
    // on every screen focus would be pure noise.
    staleTime: Infinity,
    queryFn: async () => {
      const token = await getToken();
      return apiFetch('/api/v1/onboarding', meResponseSchema, { method: 'POST', token });
    },
  });
}
