import { useAuth } from '@clerk/clerk-expo';
import { useInfiniteQuery, type UseInfiniteQueryResult } from '@tanstack/react-query';
import { campaignListItemSchema, type CampaignListItem } from '@creatordocks/shared';

import { apiFetchList } from '@/lib/api-client';
import { flattenPages, listQueryString, nextPage, PAGE_LIMIT, type PaginatedFeed } from './pagination';

/**
 * Filters applied by the server, not by the screen.
 *
 * Discover used to match its category chips against the one page it happened to
 * have loaded, so a niche with 30 campaigns showed however many of them landed
 * in the first 20 rows of the unfiltered feed. `GET /api/v1/campaigns` has
 * always accepted `niche`, so the filter belongs there — where it can see the
 * whole collection.
 */
export type CampaignFilters = {
  readonly niche?: string;
};

export function useCampaigns(
  filters: CampaignFilters = {},
): UseInfiniteQueryResult<PaginatedFeed<CampaignListItem>, Error> {
  const { getToken } = useAuth();
  const { niche } = filters;

  return useInfiniteQuery({
    // The niche is part of the key because it changes what the server returns.
    // Sharing one cache entry across filters would paint the previous chip's
    // campaigns for a frame before the new ones replaced them.
    queryKey: ['campaigns', { niche: niche ?? null }],
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      const token = await getToken();
      const query = listQueryString({ page: pageParam, limit: PAGE_LIMIT, niche });
      return apiFetchList(`/api/v1/campaigns${query}`, campaignListItemSchema, { token });
    },
    getNextPageParam: (lastPage) => nextPage(lastPage.meta),
    select: (data) => flattenPages(data.pages),
  });
}
