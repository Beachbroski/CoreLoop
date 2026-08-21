import { useAuth } from '@clerk/clerk-expo';
import { useInfiniteQuery, type UseInfiniteQueryResult } from '@tanstack/react-query';
import { applicationSchema, type Application } from '@creatordocks/shared';

import { apiFetchList } from '@/lib/api-client';
import { flattenPages, listQueryString, nextPage, PAGE_LIMIT, type PaginatedFeed } from './pagination';

/**
 * A creator's own applications, newest first. Paginated because a working
 * creator passes 20 applications quickly, and everything past that used to be
 * unreachable — the list simply stopped, with no indication there was more.
 */
export function useApplications(): UseInfiniteQueryResult<PaginatedFeed<Application>, Error> {
  const { getToken } = useAuth();

  return useInfiniteQuery({
    queryKey: ['applications'],
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      const token = await getToken();
      const query = listQueryString({ page: pageParam, limit: PAGE_LIMIT });
      return apiFetchList(`/api/v1/applications${query}`, applicationSchema, { token });
    },
    getNextPageParam: (lastPage) => nextPage(lastPage.meta),
    select: (data) => flattenPages(data.pages),
  });
}
