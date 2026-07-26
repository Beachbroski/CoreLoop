import { useAuth } from '@clerk/clerk-expo';
import { useQuery } from '@tanstack/react-query';
import { stripeStatusResponseSchema } from '@creatordocks/shared';

import { apiFetch } from '@/lib/api-client';

export function useStripeStatus() {
  const { getToken } = useAuth();

  return useQuery({
    queryKey: ['stripe-status'],
    queryFn: async () => {
      const token = await getToken();
      return apiFetch('/api/v1/stripe/status', stripeStatusResponseSchema, { token });
    },
  });
}
