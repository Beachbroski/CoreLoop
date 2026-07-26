import { useAuth } from '@clerk/clerk-expo';
import { useQuery } from '@tanstack/react-query';
import { campaignListItemSchema } from '@creatordocks/shared';

import { apiFetchList } from '@/lib/api-client';

export function useCampaigns() {
  const { getToken } = useAuth();

  return useQuery({
    queryKey: ['campaigns'],
    queryFn: async () => {
      const token = await getToken();
      return apiFetchList('/api/v1/campaigns', campaignListItemSchema, { token });
    },
  });
}
