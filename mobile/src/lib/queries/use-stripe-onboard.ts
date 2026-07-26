import { useAuth } from '@clerk/clerk-expo';
import { useMutation } from '@tanstack/react-query';
import { stripeOnboardResponseSchema } from '@creatordocks/shared';

import { apiFetch } from '@/lib/api-client';

export function useStripeOnboard() {
  const { getToken } = useAuth();

  return useMutation({
    mutationFn: async () => {
      const token = await getToken();
      return apiFetch('/api/v1/stripe/onboard', stripeOnboardResponseSchema, { method: 'POST', token });
    },
  });
}
