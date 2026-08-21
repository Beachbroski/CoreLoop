import type { PaginationMeta } from '@creatordocks/shared';

import { flattenPages, listQueryString, nextPage, PAGE_LIMIT, type Page } from './pagination';

function meta(overrides: Partial<PaginationMeta> = {}): PaginationMeta {
  return { total: 0, page: 1, limit: PAGE_LIMIT, ...overrides };
}

describe('listQueryString', () => {
  it('returns an empty string when nothing is set, so the server applies its defaults', () => {
    expect(listQueryString({})).toBe('');
    expect(listQueryString({ page: undefined, niche: undefined })).toBe('');
  });

  it('omits unset params rather than sending them empty', () => {
    // `?niche=` fails the server's `z.string().min(1)` and 400s the whole feed.
    expect(listQueryString({ page: 2, niche: undefined })).toBe('?page=2');
    expect(listQueryString({ page: 2, niche: '' })).toBe('?page=2');
  });

  it('joins multiple params', () => {
    expect(listQueryString({ page: 3, limit: 20 })).toBe('?page=3&limit=20');
  });

  it('encodes values that would otherwise break the query string', () => {
    expect(listQueryString({ niche: 'Food & Drink' })).toBe('?niche=Food%20%26%20Drink');
  });

  it('keeps a zero, which is a real value rather than an unset one', () => {
    expect(listQueryString({ page: 0 })).toBe('?page=0');
  });
});

describe('nextPage', () => {
  it('asks for the next page while the collection has more', () => {
    expect(nextPage(meta({ total: 45, page: 1, limit: 20 }))).toBe(2);
    expect(nextPage(meta({ total: 45, page: 2, limit: 20 }))).toBe(3);
  });

  it('stops at the last page', () => {
    expect(nextPage(meta({ total: 45, page: 3, limit: 20 }))).toBeUndefined();
  });

  it('stops when the page is exactly full and there is nothing beyond it', () => {
    // The classic off-by-one: 40 of 40 seen is the end, not "maybe one more".
    expect(nextPage(meta({ total: 40, page: 2, limit: 20 }))).toBeUndefined();
  });

  it('stops on an empty collection', () => {
    expect(nextPage(meta({ total: 0, page: 1, limit: 20 }))).toBeUndefined();
  });

  it('stops rather than looping when the server reports a page past the end', () => {
    expect(nextPage(meta({ total: 5, page: 9, limit: 20 }))).toBeUndefined();
  });
});

describe('flattenPages', () => {
  const page1: Page<{ id: string }> = {
    data: [{ id: 'a' }, { id: 'b' }],
    meta: meta({ total: 3, page: 1, limit: 2 }),
  };
  const page2: Page<{ id: string }> = {
    data: [{ id: 'c' }],
    meta: meta({ total: 3, page: 2, limit: 2 }),
  };

  it('concatenates every page in order', () => {
    expect(flattenPages([page1, page2]).data).toEqual([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
  });

  it('reports the newest meta, not the first page it fetched', () => {
    // `total` is recomputed per request, so the freshest response wins.
    expect(flattenPages([page1, page2]).meta).toEqual({ total: 3, page: 2, limit: 2 });
  });

  it('carries whole-collection aggregates through, so Earnings keeps its lifetime total', () => {
    const paid: Page<{ id: string }> = {
      data: [],
      meta: meta({ total: 1, page: 1, limit: 20, lifetimePaidAmount: 125_00 }),
    };

    expect(flattenPages([paid]).meta.lifetimePaidAmount).toBe(125_00);
  });

  it('leaves the input pages untouched', () => {
    const pages = [page1, page2];
    flattenPages(pages).data.push({ id: 'mutation' });

    expect(page1.data).toEqual([{ id: 'a' }, { id: 'b' }]);
    expect(pages).toHaveLength(2);
  });

  it('yields a usable empty feed when there are no pages at all', () => {
    // Screens read `meta.total` unguarded; undefined here would crash them.
    expect(flattenPages([])).toEqual({ data: [], meta: { total: 0, page: 1, limit: PAGE_LIMIT } });
  });
});
