/**
 * Deterministic generated cover art for campaigns. No backend field exists
 * for campaign imagery yet, so every campaign gets procedurally generated
 * artwork seeded by its id + niche: the niche picks the palette (so Fashion
 * campaigns share a family look), the id picks the pattern and decor layout
 * (so each campaign still reads distinct). Pure and unit-testable — the
 * rendering component (components/cover-art.tsx) just draws this spec.
 */

export type CoverArtPattern = 'orbs' | 'rings' | 'stripes' | 'arc';

export type CoverArtDecor = {
  /** Center position as a fraction of the container (0–1). */
  x: number;
  y: number;
  /** Diameter as a fraction of the container's larger dimension (0–1]. */
  size: number;
  /** White overlay opacity (subtle: 0.04–0.16). */
  opacity: number;
};

export type CoverArtSpec = {
  colors: readonly [string, string];
  pattern: CoverArtPattern;
  decor: CoverArtDecor[];
};

// Two-stop gradients tuned to sit on the dark canvas (#07080b) without
// blowing out, while staying saturated enough to feel alive in light mode.
export const COVER_ART_PALETTES: readonly (readonly [string, string])[] = [
  ['#ff6a58', '#c22514'], // coral ember
  ['#7c3aed', '#3b0f8f'], // violet night
  ['#0ea5e9', '#0b3aa2'], // electric ocean
  ['#f59e0b', '#b91c1c'], // sunset amber
  ['#10b981', '#065f46'], // deep emerald
  ['#ec4899', '#831843'], // neon magenta
  ['#6366f1', '#1e1b4b'], // indigo dusk
  ['#14b8a6', '#134e4a'], // teal abyss
] as const;

const PATTERNS: readonly CoverArtPattern[] = ['orbs', 'rings', 'stripes', 'arc'] as const;

/** FNV-1a 32-bit — tiny, fast, good distribution for short strings. */
function hash(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Deterministic fraction in [0, 1) derived from a hash and a lane index. */
function fraction(seed: number, lane: number): number {
  const mixed = hash(`${seed}:${lane}`);
  return mixed / 0x100000000;
}

export function coverArtSpec(id: string, niche?: string): CoverArtSpec {
  const paletteSeed = niche ? hash(niche.toLowerCase()) : hash(id);
  const idSeed = hash(id);

  const colors = COVER_ART_PALETTES[paletteSeed % COVER_ART_PALETTES.length];
  const pattern = PATTERNS[idSeed % PATTERNS.length];

  const decorCount = 2 + (idSeed % 2); // 2–3 elements
  const decor: CoverArtDecor[] = [];
  for (let i = 0; i < decorCount; i++) {
    decor.push({
      x: fraction(idSeed, i * 4 + 1),
      y: fraction(idSeed, i * 4 + 2),
      size: 0.25 + fraction(idSeed, i * 4 + 3) * 0.55,
      opacity: 0.05 + fraction(idSeed, i * 4 + 4) * 0.09,
    });
  }

  return { colors: [colors[0], colors[1]], pattern, decor };
}
