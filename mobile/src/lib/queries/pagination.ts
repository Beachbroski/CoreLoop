import type { PaginationMeta } from '@creatordocks/shared';

/**
 * Page-based pagination helpers shared by every list hook.
 *
 * Every /api/v1 list endpoint takes `page` and `limit` and answers with a
 * `meta` block (see packages/shared/src/pagination.ts). Until now the app sent
 * neither, so every feed was silently truncated at the server's default of 20
 * with no way to ask for the 21st item. These functions are the arithmetic and
 * string-building that turn that contract into a React Query infinite query;
 * they are deliberately pure so the paging maths is testable without a network.
 */

/** One page exactly as `apiFetchList` returns it. */
export type Page<T> = { data: T[]; meta: PaginationMeta };

/** Every page fetched so far, collapsed into the shape a screen renders. */
export type PaginatedFeed<T> = Page<T>;

/**
 * Matches the server's own default. Larger pages mean fewer round trips but a
 * heavier first paint on cellular, and the API refuses anything above 50.
 */
export const PAGE_LIMIT = 20;

/** Stands in for a feed that has no pages at all, so `meta` is never undefined. */
const EMPTY_META: PaginationMeta = { total: 0, page: 1, limit: PAGE_LIMIT };

type QueryValue = string | number | undefined;

/**
 * Builds the `?a=1&b=2` suffix for a list request, dropping anything the caller
 * left unset so the server applies its own default instead of parsing an empty
 * string. Hand-rolled rather than `URLSearchParams`: Hermes' URL polyfill is
 * partial, and this runs on every feed request.
 */
export function listQueryString(params: Readonly<Record<string, QueryValue>>): string {
  const pairs = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);

  return pairs.length > 0 ? `?${pairs.join('&')}` : '';
}

/**
 * The page number to ask for after this one, or `undefined` at the end of the
 * collection — which is what React Query reads as `hasNextPage: false`.
 *
 * Page-based, so "is there more?" is arithmetic on the meta the server already
 * sends rather than a cursor we have to keep. A server that reports a page
 * beyond the collection settles immediately instead of looping.
 */
export function nextPage(meta: PaginationMeta): number | undefined {
  const seenSoFar = meta.page * meta.limit;
  return seenSoFar < meta.total ? meta.page + 1 : undefined;
}

/**
 * Collapses the fetched pages into the single `{ data, meta }` shape screens
 * read, so adding pagination did not change what a list renders.
 *
 * `meta` comes from the LAST page rather than the first: `total` and
 * `lifetimePaidAmount` are whole-collection aggregates recomputed on every
 * request, so the newest response carries the least stale ones — and `page`
 * then truthfully reports how deep the feed is currently loaded.
 */
export function flattenPages<T>(pages: readonly Page<T>[]): PaginatedFeed<T> {
  const lastPage = pages[pages.length - 1];

  return {
    data: pages.flatMap((page) => page.data),
    meta: lastPage?.meta ?? EMPTY_META,
  };
}
