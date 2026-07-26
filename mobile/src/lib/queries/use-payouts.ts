import { useAuth } from '@clerk/clerk-expo';
import { useQuery } from '@tanstack/react-query';
import { payoutSchema } from '@creatordocks/shared';

import { apiFetchList } from '@/lib/api-client';

export function usePayouts() {
  const { getToken } = useAuth();

  return useQuery({
    queryKey: ['payouts'],
    queryFn: async () => {
      const token = await getToken();
      return apiFetchList('/api/v1/payouts', payoutSchema, { token });
    },
  });
}
