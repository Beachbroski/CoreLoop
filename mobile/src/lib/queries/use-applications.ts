import { useAuth } from '@clerk/clerk-expo';
import { useQuery } from '@tanstack/react-query';
import { applicationSchema } from '@creatordocks/shared';

import { apiFetchList } from '@/lib/api-client';

export function useApplications() {
  const { getToken } = useAuth();

  return useQuery({
    queryKey: ['applications'],
    queryFn: async () => {
      const token = await getToken();
      return apiFetchList('/api/v1/applications', applicationSchema, { token });
    },
  });
}
