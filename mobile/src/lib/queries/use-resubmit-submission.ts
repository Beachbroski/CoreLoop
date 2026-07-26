import { useAuth } from '@clerk/clerk-expo';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { submissionSchema, type ResubmitSubmissionRequest } from '@creatordocks/shared';

import { apiFetch } from '@/lib/api-client';

export function useResubmitSubmission(id: string) {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: ResubmitSubmissionRequest) => {
      const token = await getToken();
      return apiFetch(`/api/v1/submissions/${id}`, submissionSchema, { method: 'PATCH', body, token });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['submissions'] });
      queryClient.invalidateQueries({ queryKey: ['submission', id] });
    },
  });
}
