/**
 * Shortest-column-first packing — the standard masonry approach (Pinterest).
 * Pre-splitting into fixed columns is also the React Native-portable pattern:
 * two plain scrolling columns instead of a web masonry layout.
 */
export function balanceColumns<T>(
  items: readonly T[],
  getWeight: (item: T) => number,
  columnCount = 2,
): T[][] {
  const columns: T[][] = Array.from({ length: columnCount }, () => []);
  const totals = new Array<number>(columnCount).fill(0);

  for (const item of items) {
    let shortest = 0;
    for (let i = 1; i < columnCount; i++) {
      if (totals[i] < totals[shortest]) shortest = i;
    }
    columns[shortest].push(item);
    totals[shortest] += getWeight(item);
  }

  return columns;
}
