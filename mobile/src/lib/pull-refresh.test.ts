import { isPullRefreshing } from './pull-refresh';

describe('isPullRefreshing', () => {
  it('spins for a refresh the creator asked for', () => {
    expect(isPullRefreshing({ isRefetching: true, isFetchingNextPage: false })).toBe(true);
  });

  it('stays still while the next page loads', () => {
    // The regression: `isRefetching` is true throughout `fetchNextPage`, so
    // binding it directly spins the top control every time the list pages.
    expect(isPullRefreshing({ isRefetching: true, isFetchingNextPage: true })).toBe(false);
  });

  it('stays still when nothing is in flight', () => {
    expect(isPullRefreshing({ isRefetching: false, isFetchingNextPage: false })).toBe(false);
  });

  it('treats a query that cannot page as never paging', () => {
    // A plain `useQuery` has no `isFetchingNextPage` at all.
    expect(isPullRefreshing({ isRefetching: true })).toBe(true);
    expect(isPullRefreshing({ isRefetching: false })).toBe(false);
  });
});
