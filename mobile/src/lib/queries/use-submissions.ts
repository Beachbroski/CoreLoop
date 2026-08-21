import { useAuth } from '@clerk/clerk-expo';
import { useInfiniteQuery, type UseInfiniteQueryResult } from '@tanstack/react-query';
import { submissionSchema, type Submission } from '@creatordocks/shared';

import { apiFetchList } from '@/lib/api-client';
import { flattenPages, listQueryString, nextPage, PAGE_LIMIT, type PaginatedFeed } from './pagination';

export function useSubmissions(): UseInfiniteQueryResult<PaginatedFeed<Submission>, Error> {
  const { getToken } = useAuth();

  return useInfiniteQuery({
    queryKey: ['submissions'],
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      const token = await getToken();
      const query = listQueryString({ page: pageParam, limit: PAGE_LIMIT });
      return apiFetchList(`/api/v1/submissions${query}`, submissionSchema, { token });
    },
    getNextPageParam: (lastPage) => nextPage(lastPage.meta),
    select: (data) => flattenPages(data.pages),
  });
}
