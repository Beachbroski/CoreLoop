import { balanceColumns } from './masonry';

describe('balanceColumns', () => {
  it('splits items across the requested number of columns', () => {
    const items = [1, 2, 3, 4, 5, 6];
    const columns = balanceColumns(items, () => 100, 2);
    expect(columns).toHaveLength(2);
    expect(columns.flat()).toHaveLength(6);
  });

  it('keeps every item exactly once, in order within a column', () => {
    const items = ['a', 'b', 'c', 'd', 'e'];
    const columns = balanceColumns(items, () => 100, 2);
    const flat = columns.flat();
    expect(new Set(flat).size).toBe(items.length);
    // Equal weights alternate, so the first column keeps source order.
    expect(columns[0]).toEqual(['a', 'c', 'e']);
    expect(columns[1]).toEqual(['b', 'd']);
  });

  it('places each item in the shortest column so heights stay balanced', () => {
    // A tall first item should push the next items into the other column.
    const items = [{ h: 300 }, { h: 100 }, { h: 100 }];
    const columns = balanceColumns(items, (item) => item.h, 2);
    expect(columns[0]).toEqual([{ h: 300 }]);
    expect(columns[1]).toEqual([{ h: 100 }, { h: 100 }]);
  });

  it('handles an empty list', () => {
    expect(balanceColumns([], () => 1, 2)).toEqual([[], []]);
  });

  it('supports a single column', () => {
    expect(balanceColumns([1, 2], () => 1, 1)).toEqual([[1, 2]]);
  });
});
