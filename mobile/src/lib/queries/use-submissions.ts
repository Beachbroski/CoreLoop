import { useAuth } from '@clerk/clerk-expo';
import { useQuery } from '@tanstack/react-query';
import { submissionSchema } from '@creatordocks/shared';

import { apiFetchList } from '@/lib/api-client';

export function useSubmissions() {
  const { getToken } = useAuth();

  return useQuery({
    queryKey: ['submissions'],
    queryFn: async () => {
      const token = await getToken();
      return apiFetchList('/api/v1/submissions', submissionSchema, { token });
    },
  });
}
