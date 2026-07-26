import { useAuth } from '@clerk/clerk-expo';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { applicationSchema, type CreateApplicationRequest } from '@creatordocks/shared';

import { apiFetch } from '@/lib/api-client';

export function useCreateApplication() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: CreateApplicationRequest) => {
      const token = await getToken();
      return apiFetch('/api/v1/applications', applicationSchema, { method: 'POST', body, token });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] });
    },
  });
}
