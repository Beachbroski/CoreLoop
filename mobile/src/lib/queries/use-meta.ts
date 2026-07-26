import { useQuery } from '@tanstack/react-query';
import { metaResponseSchema } from '@creatordocks/shared';

import { apiFetch } from '@/lib/api-client';

export function useMeta() {
  return useQuery({
    queryKey: ['meta'],
    queryFn: () => apiFetch('/api/v1/meta', metaResponseSchema),
    staleTime: 5 * 60 * 1000,
  });
}
