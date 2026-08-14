import { COVER_ART_PALETTES, coverArtSpec } from './cover-art';

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

describe('coverArtSpec', () => {
  it('is deterministic for the same inputs', () => {
    const a = coverArtSpec('campaign-123', 'Fashion');
    const b = coverArtSpec('campaign-123', 'Fashion');
    expect(a).toEqual(b);
  });

  it('varies across different campaign ids', () => {
    const specs = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8'].map((id) => coverArtSpec(id));
    const uniquePatterns = new Set(specs.map((s) => `${s.pattern}-${s.colors.join()}`));
    expect(uniquePatterns.size).toBeGreaterThan(1);
  });

  it('keeps the palette stable per niche across campaigns', () => {
    const a = coverArtSpec('c1', 'Fashion');
    const b = coverArtSpec('c2', 'Fashion');
    expect(a.colors).toEqual(b.colors);
  });

  it('handles a missing niche by seeding from the id', () => {
    const spec = coverArtSpec('campaign-xyz');
    expect(spec.colors).toHaveLength(2);
    expect(spec.pattern).toBeDefined();
  });

  it('handles an empty-string niche like a missing one', () => {
    expect(coverArtSpec('c1', '')).toEqual(coverArtSpec('c1'));
  });

  it('returns decor positions inside the unit square', () => {
    const spec = coverArtSpec('campaign-123', 'Tech');
    expect(spec.decor.length).toBeGreaterThanOrEqual(2);
    for (const d of spec.decor) {
      expect(d.x).toBeGreaterThanOrEqual(0);
      expect(d.x).toBeLessThanOrEqual(1);
      expect(d.y).toBeGreaterThanOrEqual(0);
      expect(d.y).toBeLessThanOrEqual(1);
      expect(d.size).toBeGreaterThan(0);
      expect(d.size).toBeLessThanOrEqual(1);
    }
  });
});

describe('COVER_ART_PALETTES', () => {
  it('every palette is a pair of valid hex colors', () => {
    expect(COVER_ART_PALETTES.length).toBeGreaterThanOrEqual(6);
    for (const palette of COVER_ART_PALETTES) {
      expect(palette).toHaveLength(2);
      for (const color of palette) {
        expect(color).toMatch(HEX_COLOR);
      }
    }
  });
});
