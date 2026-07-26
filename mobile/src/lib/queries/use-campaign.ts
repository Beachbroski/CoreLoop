import { useAuth } from '@clerk/clerk-expo';
import { useQuery } from '@tanstack/react-query';
import { campaignDetailSchema } from '@creatordocks/shared';

import { apiFetch } from '@/lib/api-client';

export function useCampaign(id: string) {
  const { getToken } = useAuth();

  return useQuery({
    queryKey: ['campaign', id],
    queryFn: async () => {
      const token = await getToken();
      return apiFetch(`/api/v1/campaigns/${id}`, campaignDetailSchema, { token });
    },
    enabled: Boolean(id),
  });
}
