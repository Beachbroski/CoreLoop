import { useAuth } from '@clerk/clerk-expo';
import { useInfiniteQuery, type UseInfiniteQueryResult } from '@tanstack/react-query';
import { payoutSchema, type Payout } from '@creatordocks/shared';

import { apiFetchList } from '@/lib/api-client';
import { flattenPages, listQueryString, nextPage, PAGE_LIMIT, type PaginatedFeed } from './pagination';

/**
 * A creator's payout history, newest first.
 *
 * `meta.lifetimePaidAmount` rides along on every page and is aggregated server
 * side across ALL payouts — Earnings shows it as the lifetime total, so it must
 * never be derived from the pages loaded so far. `flattenPages` keeps the newest
 * page's meta precisely so that figure stays whole-collection.
 *
 * Each payout also carries an optional `campaign: { id, title }`; it is optional
 * on the contract so an app pointed at a deployment predating that field loses
 * one caption rather than the whole screen (api-client treats any parse failure
 * as fatal for the response).
 */
export function usePayouts(): UseInfiniteQueryResult<PaginatedFeed<Payout>, Error> {
  const { getToken } = useAuth();

  return useInfiniteQuery({
    queryKey: ['payouts'],
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      const token = await getToken();
      const query = listQueryString({ page: pageParam, limit: PAGE_LIMIT });
      return apiFetchList(`/api/v1/payouts${query}`, payoutSchema, { token });
    },
    getNextPageParam: (lastPage) => nextPage(lastPage.meta),
    select: (data) => flattenPages(data.pages),
  });
}
