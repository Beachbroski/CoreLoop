import { useAuth } from '@clerk/clerk-expo';
import { useQuery } from '@tanstack/react-query';
import { meResponseSchema } from '@creatordocks/shared';

import { apiFetch } from '@/lib/api-client';

export function useMe() {
  const { getToken } = useAuth();

  return useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const token = await getToken();
      return apiFetch('/api/v1/me', meResponseSchema, { token });
    },
  });
}
