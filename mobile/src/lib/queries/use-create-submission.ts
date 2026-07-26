import { useAuth } from '@clerk/clerk-expo';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { submissionSchema, type CreateSubmissionRequest } from '@creatordocks/shared';

import { apiFetch } from '@/lib/api-client';

export function useCreateSubmission() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: CreateSubmissionRequest) => {
      const token = await getToken();
      return apiFetch('/api/v1/submissions', submissionSchema, { method: 'POST', body, token });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['submissions'] });
      queryClient.invalidateQueries({ queryKey: ['applications'] });
    },
  });
}
