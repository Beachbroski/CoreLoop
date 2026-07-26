import { isVersionBelow } from './version-gate';

describe('isVersionBelow', () => {
  it('returns false when the version equals the minimum', () => {
    expect(isVersionBelow('1.2.0', '1.2.0')).toBe(false);
  });

  it('returns false when the version exceeds the minimum', () => {
    expect(isVersionBelow('1.3.0', '1.2.0')).toBe(false);
    expect(isVersionBelow('2.0.0', '1.9.9')).toBe(false);
  });

  it('returns true when the version is below the minimum', () => {
    expect(isVersionBelow('1.1.9', '1.2.0')).toBe(true);
    expect(isVersionBelow('0.9.0', '1.0.0')).toBe(true);
  });

  it('handles missing segments as zero', () => {
    expect(isVersionBelow('1.2', '1.2.0')).toBe(false);
    expect(isVersionBelow('1.2', '1.2.1')).toBe(true);
  });
});
