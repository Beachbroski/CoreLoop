/** Compares dotted version strings (e.g. "1.2.0"). Missing segments count as 0. */
export function isVersionBelow(version: string, minVersion: string): boolean {
  const a = version.split('.').map(Number);
  const b = minVersion.split('.').map(Number);
  const length = Math.max(a.length, b.length);

  for (let i = 0; i < length; i += 1) {
    const partA = a[i] ?? 0;
    const partB = b[i] ?? 0;
    if (partA !== partB) return partA < partB;
  }

  return false;
}
