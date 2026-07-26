import { useAuth } from '@clerk/clerk-expo';
import { useQuery } from '@tanstack/react-query';
import { applicationSchema } from '@creatordocks/shared';

import { apiFetch } from '@/lib/api-client';

export function useApplication(id: string) {
  const { getToken } = useAuth();

  return useQuery({
    queryKey: ['application', id],
    queryFn: async () => {
      const token = await getToken();
      return apiFetch(`/api/v1/applications/${id}`, applicationSchema, { token });
    },
    enabled: Boolean(id),
  });
}
