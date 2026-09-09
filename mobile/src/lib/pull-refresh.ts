/**
 * Whether a list's pull-to-refresh control should be spinning.
 *
 * The trap this exists to close: React Query's `isRefetching` is
 * `isFetching && !isPending`, so it is true for *any* fetch against data that
 * has already loaded — including `fetchNextPage`. Bound straight to a
 * `RefreshControl`, paging in more rows at the bottom of a list spins the
 * refresh spinner at the top. On Discover, whose paging lookahead is a full
 * viewport deep, that re-fires as each page lands and reads as the screen
 * refreshing on a loop.
 *
 * Infinite scroll reports itself through its own footer spinner
 * (`isFetchingNextPage`). This control is only for a refresh the creator asked
 * for — their own pull, or the retry button on a stale-data banner.
 */
export function isPullRefreshing(query: {
  readonly isRefetching: boolean;
  readonly isFetchingNextPage?: boolean;
}): boolean {
  return query.isRefetching && !query.isFetchingNextPage;
}
