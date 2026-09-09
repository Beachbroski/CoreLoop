#!/usr/bin/env node
/**
 * cover-art-bake.mjs — Phase 1 (WP-00) mockup support tool.
 *
 * A faithful Node port of:
 *   mobile/src/lib/cover-art.ts        (FNV-1a hash, fraction lanes, 8 palettes, 4 patterns)
 *   mobile/src/lib/campaign-signals.ts (tileAspectRatio, deadlineSignal, isNewCampaign, spotsLabel)
 *   mobile/src/components/cover-art.tsx (the decor geometry, translated to CSS per 01-design-brief §5)
 *
 * It is NOT the Phase 2 port (that is `lib/cover-art.ts`, WP-05, with a parity test).
 * This file exists only so the static .dc.html artboards can paint REAL generated
 * artwork instead of hand-picked gradients. Nothing here is imported by the app.
 *
 * Run:  node tools/cover-art-bake.mjs            → writes tools/baked-specs.json
 *       node tools/cover-art-bake.mjs --print id → prints one entry
 *
 * Purity note: no mutation of inputs; every helper returns a new value.
 */

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));

/* ------------------------------------------------------------------ */
/* 1. cover-art.ts — line-for-line                                     */
/* ------------------------------------------------------------------ */

/** Two-stop gradients. Order is the mobile parity contract — never reorder. */
export const COVER_ART_PALETTES = [
  ['#ff6a58', '#c22514'], // 0 coral ember
  ['#7c3aed', '#3b0f8f'], // 1 violet night
  ['#0ea5e9', '#0b3aa2'], // 2 electric ocean
  ['#f59e0b', '#b91c1c'], // 3 sunset amber
  ['#10b981', '#065f46'], // 4 deep emerald
  ['#ec4899', '#831843'], // 5 neon magenta
  ['#6366f1', '#1e1b4b'], // 6 indigo dusk
  ['#14b8a6', '#134e4a'], // 7 teal abyss
];

const PALETTE_NAMES = [
  'coral ember',
  'violet night',
  'electric ocean',
  'sunset amber',
  'deep emerald',
  'neon magenta',
  'indigo dusk',
  'teal abyss',
];

const PATTERNS = ['orbs', 'rings', 'stripes', 'arc'];

/** FNV-1a 32-bit — tiny, fast, good distribution for short strings. */
function hash(input) {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Deterministic fraction in [0, 1) derived from a hash and a lane index. */
function fraction(seed, lane) {
  const mixed = hash(`${seed}:${lane}`);
  return mixed / 0x100000000;
}

export function coverArtSpec(id, niche) {
  const paletteSeed = niche ? hash(niche.toLowerCase()) : hash(id);
  const idSeed = hash(id);

  const paletteIndex = paletteSeed % COVER_ART_PALETTES.length;
  const colors = COVER_ART_PALETTES[paletteIndex];
  const pattern = PATTERNS[idSeed % PATTERNS.length];

  const decorCount = 2 + (idSeed % 2); // 2–3 elements
  const decor = [];
  for (let i = 0; i < decorCount; i++) {
    decor.push({
      x: fraction(idSeed, i * 4 + 1),
      y: fraction(idSeed, i * 4 + 2),
      size: 0.25 + fraction(idSeed, i * 4 + 3) * 0.55,
      opacity: 0.05 + fraction(idSeed, i * 4 + 4) * 0.09,
    });
  }

  return { colors: [colors[0], colors[1]], pattern, decor, paletteIndex };
}

/* ------------------------------------------------------------------ */
/* 2. campaign-signals.ts — line-for-line                              */
/* ------------------------------------------------------------------ */

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
const NEW_WINDOW_DAYS = 3;
const URGENT_WINDOW_DAYS = 3;

/** Supported tile shapes — the mix is what gives the grid its mosaic rhythm. */
const ASPECT_RATIOS = [1, 4 / 5, 4 / 3];

function parseTime(iso) {
  const time = new Date(iso).getTime();
  return Number.isNaN(time) ? null : time;
}

export function isNewCampaign(createdAt, now = Date.now()) {
  const created = parseTime(createdAt);
  if (created === null) return false;
  return now - created <= NEW_WINDOW_DAYS * DAY_MS;
}

export function deadlineSignal(deadline, now = Date.now()) {
  const end = parseTime(deadline);
  if (end === null) return { label: '', urgent: false, passed: false };

  const remaining = end - now;
  if (remaining <= 0) return { label: 'Closed', urgent: false, passed: true };

  if (remaining < DAY_MS) {
    const hours = Math.floor(remaining / HOUR_MS);
    return { label: hours < 1 ? 'Ends today' : `Ends in ${hours}h`, urgent: true, passed: false };
  }

  const days = Math.round(remaining / DAY_MS);
  return { label: `${days}d left`, urgent: days <= URGENT_WINDOW_DAYS, passed: false };
}

export function tileAspectRatio(id) {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return ASPECT_RATIOS[(h >>> 0) % ASPECT_RATIOS.length];
}

export function spotsLabel(creatorsNeeded) {
  if (!creatorsNeeded || creatorsNeeded <= 0) return null;
  return `${creatorsNeeded} spot${creatorsNeeded === 1 ? '' : 's'}`;
}

/* ------------------------------------------------------------------ */
/* 3. The CSS translation (01-design-brief §5 "Rendering")             */
/* ------------------------------------------------------------------ */

/**
 * Geometry note — 999px vs 50%.
 * Mobile draws circles with `borderRadius: size / 2` (identical to 50%) and the
 * stripe with `borderRadius: 999`, which the platform clamps to half the SHORT
 * side. The redesign's hard rule bans a literal 999px radius outside avatars and
 * the status dot, so this bake emits `50%` for circles and `<height/2>px` for the
 * stripe pill. Both are pixel-identical to the mobile result; no 999px appears.
 */

const round = (n) => Math.round(n * 100) / 100;

/** Decor box geometry for one element at a given container height, in px. */
function decorBox(d, i, pattern, height) {
  const reference = height * 1.5;
  const size = d.size * reference;
  const isRing = pattern === 'rings' || (pattern === 'arc' && i === 0);

  if (isRing) {
    const ringSize = pattern === 'arc' ? size * 2.2 : size;
    const borderWidth = Math.max(2, height * 0.07);
    return {
      kind: 'ring',
      width: round(ringSize),
      height: round(ringSize),
      marginLeft: round(-ringSize / 2),
      marginTop: round(-ringSize / 2),
      borderRadius: '50%',
      borderWidth: round(borderWidth),
      opacity: round(d.opacity),
    };
  }

  if (pattern === 'stripes') {
    const w = size * 2.4;
    const h = height * 0.16;
    return {
      kind: 'stripe',
      width: round(w),
      height: round(h),
      marginLeft: round(-size * 1.2),
      marginTop: round(-height * 0.08),
      borderRadius: `${round(h / 2)}px`,
      rotate: -24,
      opacity: round(d.opacity),
    };
  }

  return {
    kind: 'orb',
    width: round(size),
    height: round(size),
    marginLeft: round(-size / 2),
    marginTop: round(-size / 2),
    borderRadius: '50%',
    opacity: round(d.opacity),
  };
}

const pct = (v) => `${round(v * 100)}%`;

/** The exact inline `style` string for one decor span. */
function decorStyle(d, box) {
  const parts = [
    'position:absolute',
    `left:${pct(d.x)}`,
    `top:${pct(d.y)}`,
    `width:${box.width}px`,
    `height:${box.height}px`,
    `margin-left:${box.marginLeft}px`,
    `margin-top:${box.marginTop}px`,
    `border-radius:${box.borderRadius}`,
  ];
  if (box.kind === 'ring') {
    parts.push(`border:${box.borderWidth}px solid #ffffff`, 'background:transparent');
  } else {
    parts.push('background:#ffffff');
  }
  if (box.kind === 'stripe') parts.push('transform:rotate(-24deg)');
  parts.push(`opacity:${box.opacity}`);
  return parts.join(';') + ';';
}

/**
 * Paint one spec at one container height.
 * `radius` defaults to --cd-radius-3 (10px); dashboard thumbs use 6px, the
 * 32-cell token grid uses 6px, the hero slip strip uses 10px.
 */
export function paint(spec, height, options = {}) {
  const radius = options.radius ?? 10;
  const width = options.width ?? null;

  const container = [
    'position:relative',
    'overflow:hidden',
    width === null ? 'width:100%' : `width:${width}px`,
    `height:${round(height)}px`,
    `border-radius:${radius}px`,
    `background-image:linear-gradient(135deg, ${spec.colors[0]} 0%, ${spec.colors[1]} 100%)`,
  ].join(';') + ';';

  const decor = spec.decor.map((d, i) => {
    const box = decorBox(d, i, spec.pattern, height);
    return { index: i, box, style: decorStyle(d, box) };
  });

  const html =
    `<div style="${container}">` +
    decor.map((s) => `<span aria-hidden="true" style="${s.style}"></span>`).join('') +
    `</div>`;

  return { height: round(height), radius, containerStyle: container, decor, html };
}

/* ------------------------------------------------------------------ */
/* 4. What to bake                                                     */
/* ------------------------------------------------------------------ */

/** The §10 fixture, with the stable ids the artboards use as seeds. */
const FIXTURE_CAMPAIGNS = [
  { id: 'ferrous-brunch', niche: 'Food', brand: 'Ferrous Coffee', place: 'Bushwick, NY', title: 'Saturday brunch reels', rateCents: 40000, spots: 2, deadline: '3d left', urgent: true },
  { id: 'ferrous-coldbrew', niche: 'Food', brand: 'Ferrous Coffee', place: 'Bushwick, NY', title: 'New cold brew tasting', rateCents: 30000, spots: 1, deadline: '12d left', urgent: false },
  { id: 'ferrous-holiday', niche: 'Lifestyle', brand: 'Ferrous Coffee', place: 'Bushwick, NY', title: 'Holiday hours announcement', rateCents: 25000, spots: 1, deadline: 'Closed', urgent: false },
  { id: 'ironoak-6am', niche: 'Fitness', brand: 'Iron & Oak Strength', place: 'Sacramento, CA', title: '6am class energy, 3 clips', rateCents: 65000, spots: 1, deadline: '9d left', urgent: false },
  { id: 'wildflower-fall', niche: 'Beauty', brand: 'Wildflower Nail Studio', place: 'Portland, OR', title: 'Fall set showcase', rateCents: 27500, spots: 3, deadline: 'Ends in 6h', urgent: true },
  { id: 'casaduarte-ac', niche: 'Lifestyle', brand: 'Casa Duarte Home Services', place: 'Mesa, AZ', title: 'Before/after AC tune-up', rateCents: 50000, spots: 1, deadline: '5d left', urgent: false },
  { id: 'terrapin-trail', niche: 'Lifestyle', brand: 'Terrapin Bikes', place: 'Asheville, NC', title: 'Weekend trail loop', rateCents: 35000, spots: 2, deadline: 'New', urgent: false },
  { id: 'norr-winter', niche: 'Fashion', brand: 'Norr Boutique', place: 'Minneapolis, MN', title: 'Winter drop lookbook', rateCents: 90000, spots: 2, deadline: '14d left', urgent: false },
];

/** /onboarding seeds two fixed panels (01-design-brief §7). No niche. */
const ONBOARDING_SEEDS = [
  { id: 'brand', niche: null, note: "onboarding panel — I'm hiring creators" },
  { id: 'creator', niche: null, note: 'onboarding panel — I make content' },
];

/** Heights the artboards actually need, so the JSON carries ready-to-paste CSS. */
const STANDARD_HEIGHTS = [
  { name: 'thumb', height: 40, radius: 6 },      // dashboard table 56×40
  { name: 'slip', height: 213, radius: 10 },     // 380px slip, 378px inner, 16:9
  { name: 'strip', height: 200, radius: 10 },    // campaign header strip
  { name: 'artStrip', height: 240, radius: 10 }, // landing full-bleed art strip
  { name: 'signin', height: 288, radius: 10 },   // one tile on the sign-in canvas
];

/** Niche → palette index, searched over a real local-business niche vocabulary. */
const NICHE_VOCABULARY = [
  'Food', 'Fitness', 'Beauty', 'Lifestyle', 'Fashion', 'Coffee', 'Wellness',
  'Home services', 'Pets', 'Music', 'Travel', 'Nightlife', 'Art', 'Events',
  'Auto', 'Outdoors', 'Kids', 'Books', 'Garden', 'Bakery', 'Barber', 'Dance',
  'Yoga', 'Cycling', 'Florist', 'Tattoo', 'Vintage', 'Grocery', 'Brewery',
  'Studio', 'Salon', 'Gym', 'Cafe', 'Boutique', 'Retail', 'Crafts', 'Photo',
];

/** Ids for the 32-cell grid — plain, readable, and stable. */
function gridIdCandidates() {
  const out = [];
  for (const stem of ['cell', 'tile', 'slot', 'card', 'panel', 'block', 'unit', 'plate']) {
    for (let n = 1; n <= 60; n++) out.push(`${stem}-${n}`);
  }
  return out;
}

/**
 * Build the 8 × 4 grid: the niche fixes the palette, the id fixes the pattern.
 * Returns 32 entries, one per (paletteIndex, pattern) pair, in reading order.
 *
 * Every cell gets its OWN id, so the sheet shows 32 different decor layouts
 * rather than the same four repeated down the columns — the grid's job on the
 * specimen sheet is to show the real range of the generator, not just its axes.
 */
function buildPaletteGrid() {
  // One niche per palette index.
  const nicheForPalette = new Map();
  for (const n of NICHE_VOCABULARY) {
    const idx = hash(n.toLowerCase()) % COVER_ART_PALETTES.length;
    if (!nicheForPalette.has(idx)) nicheForPalette.set(idx, n);
  }
  const missingNiche = [];
  for (let i = 0; i < COVER_ART_PALETTES.length; i++) {
    if (!nicheForPalette.has(i)) missingNiche.push(i);
  }
  if (missingNiche.length) {
    throw new Error(`No niche in the vocabulary hashes to palette ${missingNiche.join(', ')}`);
  }

  // Eight distinct ids per pattern, walked in candidate order — deterministic.
  const idsForPattern = new Map(PATTERNS.map((p) => [p, []]));
  for (const candidate of gridIdCandidates()) {
    const p = PATTERNS[hash(candidate) % PATTERNS.length];
    const bucket = idsForPattern.get(p);
    if (bucket.length < COVER_ART_PALETTES.length) bucket.push(candidate);
  }
  const short = PATTERNS.filter((p) => idsForPattern.get(p).length < COVER_ART_PALETTES.length);
  if (short.length) {
    throw new Error(`Not enough id candidates for pattern ${short.join(', ')}`);
  }

  const cells = [];
  for (let p = 0; p < COVER_ART_PALETTES.length; p++) {
    for (const pattern of PATTERNS) {
      const niche = nicheForPalette.get(p);
      const id = idsForPattern.get(pattern)[p];
      const spec = coverArtSpec(id, niche);
      if (spec.paletteIndex !== p || spec.pattern !== pattern) {
        throw new Error(`Grid cell mismatch for palette ${p} / ${pattern}`);
      }
      cells.push({ paletteIndex: p, paletteName: PALETTE_NAMES[p], pattern, id, niche, spec });
    }
  }
  return cells;
}

function entryFor({ id, niche, extra = {} }) {
  const spec = coverArtSpec(id, niche ?? undefined);
  const ar = tileAspectRatio(id);
  const renders = {};
  for (const h of STANDARD_HEIGHTS) {
    renders[h.name] = paint(spec, h.height, { radius: h.radius });
  }
  // Mosaic tile heights follow the campaign's own aspect ratio (§5).
  renders.mosaic1440 = paint(spec, Math.round(384 / ar), { radius: 10 });
  renders.mosaic390 = paint(spec, Math.round(358 / ar), { radius: 10 });

  return {
    id,
    niche: niche ?? null,
    paletteIndex: spec.paletteIndex,
    paletteName: PALETTE_NAMES[spec.paletteIndex],
    colors: spec.colors,
    pattern: spec.pattern,
    decor: spec.decor,
    tileAspectRatio: ar,
    tileAspectRatioLabel: ar === 1 ? '1:1' : ar === 0.8 ? '4:5' : '4:3',
    ...extra,
    renders,
  };
}

function main() {
  const campaigns = FIXTURE_CAMPAIGNS.map((c) =>
    entryFor({
      id: c.id,
      niche: c.niche,
      extra: {
        brand: c.brand,
        place: c.place,
        title: c.title,
        rateCents: c.rateCents,
        spotsLabel: spotsLabel(c.spots),
        deadlineLabel: c.deadline,
        deadlineUrgent: c.urgent,
      },
    }),
  );

  const onboarding = ONBOARDING_SEEDS.map((s) =>
    entryFor({ id: s.id, niche: s.niche, extra: { note: s.note } }),
  );

  const gridCells = buildPaletteGrid().map((cell) => ({
    paletteIndex: cell.paletteIndex,
    paletteName: cell.paletteName,
    pattern: cell.pattern,
    id: cell.id,
    niche: cell.niche,
    colors: cell.spec.colors,
    decor: cell.spec.decor,
    render: paint(cell.spec, 96, { radius: 6, width: 126 }),
  }));

  // deadlineSignal / isNewCampaign proof, computed rather than asserted.
  const NOW = Date.parse('2026-09-08T12:00:00Z');
  const signalProbe = {
    now: new Date(NOW).toISOString(),
    cases: [
      { id: 'ferrous-brunch', deadline: '2026-09-11T12:00:00Z' },
      { id: 'wildflower-fall', deadline: '2026-09-08T18:00:00Z' },
      { id: 'ferrous-holiday', deadline: '2026-08-30T12:00:00Z' },
      { id: 'ironoak-6am', deadline: '2026-09-17T12:00:00Z' },
      { id: 'casaduarte-ac', deadline: '2026-09-13T12:00:00Z' },
      { id: 'terrapin-trail', deadline: '2026-09-20T12:00:00Z' },
      { id: 'norr-winter', deadline: '2026-09-22T12:00:00Z' },
      { id: 'ferrous-coldbrew', deadline: '2026-09-20T12:00:00Z' },
    ].map((c) => ({
      ...c,
      signal: deadlineSignal(c.deadline, NOW),
    })),
    isNew: {
      'terrapin-trail@2026-09-06': isNewCampaign('2026-09-06T09:00:00Z', NOW),
      'ferrous-brunch@2026-08-20': isNewCampaign('2026-08-20T09:00:00Z', NOW),
    },
  };

  const out = {
    generatedBy: 'tools/cover-art-bake.mjs',
    generatedAt: new Date().toISOString(),
    source: [
      'mobile/src/lib/cover-art.ts',
      'mobile/src/lib/campaign-signals.ts',
      'mobile/src/components/cover-art.tsx',
    ],
    renderingRules: {
      base: 'background-image: linear-gradient(135deg, c0 0%, c1 100%)  — the CSS equivalent of the mobile gradient {0,0} → {1,1}',
      decorReference: 'size = d.size * (height * 1.5); left = x*100%; top = y*100%; margin-left/-top = -size/2',
      ring: 'border: max(2px, height*0.07) solid #fff; background: transparent',
      stripe: 'width = size*2.4; height = height*0.16; margin-left = -size*1.2; margin-top = -height*0.08; rotate(-24deg)',
      arc: 'decor[0] is a ring at size*2.2; the rest are orbs',
      radius:
        'Circles emit 50% (identical to mobile borderRadius: size/2) and the stripe emits height/2 px (identical to mobile 999 clamped). No literal 999px is produced.',
      aria: 'every decor span is aria-hidden="true"; the artwork carries no information',
    },
    palettes: COVER_ART_PALETTES.map((c, i) => ({ index: i, name: PALETTE_NAMES[i], colors: c })),
    patterns: PATTERNS,
    campaigns,
    onboarding,
    paletteGrid: gridCells,
    paletteGridIds: Object.fromEntries(
      gridCells.map((c) => [`${c.paletteIndex}:${c.pattern}`, { id: c.id, niche: c.niche }]),
    ),
    signalProbe,
  };

  const target = join(HERE, 'baked-specs.json');
  writeFileSync(target, JSON.stringify(out, null, 2) + '\n', 'utf8');

  const arg = process.argv.indexOf('--print');
  if (arg !== -1 && process.argv[arg + 1]) {
    const wanted = process.argv[arg + 1];
    const found = [...campaigns, ...onboarding].find((e) => e.id === wanted);
    console.log(JSON.stringify(found ?? { error: `no entry ${wanted}` }, null, 2));
  }

  console.log(
    `baked ${campaigns.length} campaigns + ${onboarding.length} onboarding seeds + ${gridCells.length} grid cells → ${target}`,
  );
}

const isDirect = process.argv[1] && process.argv[1].endsWith('cover-art-bake.mjs');
if (isDirect) main();
