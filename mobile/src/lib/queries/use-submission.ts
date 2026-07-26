import { useAuth } from '@clerk/clerk-expo';
import { useQuery } from '@tanstack/react-query';
import { submissionSchema } from '@creatordocks/shared';

import { apiFetch } from '@/lib/api-client';

export function useSubmission(id: string) {
  const { getToken } = useAuth();

  return useQuery({
    queryKey: ['submission', id],
    queryFn: async () => {
      const token = await getToken();
      return apiFetch(`/api/v1/submissions/${id}`, submissionSchema, { token });
    },
    enabled: Boolean(id),
  });
}
