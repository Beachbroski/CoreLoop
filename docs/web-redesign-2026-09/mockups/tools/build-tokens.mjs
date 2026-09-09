#!/usr/bin/env node
/**
 * build-tokens.mjs — emits ../Tokens.dc.html (artboard 6, the specimen sheet).
 *
 * Why a generator rather than hand-written HTML: two parts of this artboard must
 * be COMPUTED, not transcribed.
 *   1. Every contrast figure is derived here from the WCAG 2.x relative-luminance
 *      formula against the token's intended ground. Nothing is copied out of
 *      01-design-brief.md §2 — that is the point of the sheet: it is the check.
 *   2. The 32-cell cover-art grid is read from tools/baked-specs.json, which is a
 *      verified line-for-line port of mobile/src/lib/cover-art.ts.
 *
 * Everything else (layout, type, the brand-mark options) is authored here as
 * literal markup with inline styles, exactly as the artboard format requires.
 *
 * Run: node tools/build-tokens.mjs
 *
 * If the owner edits Tokens.dc.html by hand in the canvas editor, DO NOT re-run
 * this without merging — it overwrites the file.
 *
 * Purity: every helper returns a new value; nothing here mutates its inputs.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));

/* ================================================================== */
/* 1. WCAG 2.x contrast, from the formula                             */
/* ================================================================== */

const channel = (c) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
};

/** '#rgb' | '#rrggbb' → [r, g, b] in 0–255. */
export function hexToRgb(hex) {
  const s = hex.replace('#', '');
  const full = s.length === 3 ? s.split('').map((c) => c + c).join('') : s;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

/** WCAG relative luminance. */
export function luminance(rgb) {
  return 0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2]);
}

/** WCAG contrast ratio, order-independent. */
export function contrast(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

/** Source-over composite of a translucent fill onto an opaque ground. */
export function over(fg, alpha, ground) {
  return fg.map((c, i) => c * alpha + ground[i] * (1 - alpha));
}

const rgbToHex = (rgb) =>
  '#' + rgb.map((c) => Math.round(c).toString(16).padStart(2, '0')).join('');

/** Two decimals, as a string, so 4.50 never prints as 4.5. */
const fmt = (n) => n.toFixed(2);

/* ================================================================== */
/* 2. The token sets (01-design-brief.md §2)                          */
/* ================================================================== */

const DARK = {
  name: 'Dark — the flagship',
  note: 'Dark lives on the bare :root. Marketing and auth are always dark; the dashboard defaults to it.',
  ink: { text: '#f7f8fa', secondary: '#9ba1ae', faint: '#7d8492', danger: '#f55b7f', rule: 'rgba(255,255,255,0.10)' },
  page: '#07080b',
  panel: '#12141b',
  grounds: [
    { key: 'canvas', token: '--cd-bg', value: '#07080b', use: 'the room' },
    { key: 'surface', token: '--cd-bg-element', value: '#12141b', use: 'panels, tables, sidebar' },
    { key: 'raised', token: '--cd-bg-raised', value: '#171a22', use: 'modals, drawers, the hero slip' },
    { key: 'selected', token: '--cd-bg-selected', value: '#1b1e27', use: 'hover and active rows' },
  ],
  foregrounds: [
    { token: '--cd-text', value: '#f7f8fa', min: 4.5, use: 'everything read' },
    { token: '--cd-text-secondary', value: '#9ba1ae', min: 4.5, use: 'all real caption and helper text' },
    { token: '--cd-text-faint', value: '#7d8492', min: 3.0, use: 'non-text only: rules, the 404 numeral, chart baselines' },
    { token: '--cd-accent', value: '#ff503d', min: 4.5, use: 'links, icon tints, active nav rule, urgent deadlines' },
    { token: '--cd-secondary', value: '#5895f7', min: 4.5, use: 'informational only, never a button' },
    { token: '--cd-success', value: '#2dd4a8', min: 4.5, use: 'money the creator receives, approved states' },
    { token: '--cd-warning', value: '#f0a93a', min: 4.5, use: 'admin banners, pending review' },
    { token: '--cd-danger', value: '#f55b7f', min: 4.5, use: 'declined, destructive, field errors' },
    { token: '--cd-focus', value: '#ff503d', min: 3.0, use: '2px outline at 2px offset' },
  ],
  borderStrong: { token: '--cd-border-strong', value: 'rgba(255,255,255,0.36)', rgb: [255, 255, 255], alpha: 0.36, min: 3.0 },
  border: { token: '--cd-border', value: 'rgba(255,255,255,0.10)', rgb: [255, 255, 255], alpha: 0.10 },
  softs: [
    { token: '--cd-accent-soft', fill: 'rgba(255,80,61,0.10)', rgb: [255, 80, 61], alpha: 0.10, ink: '#ff503d', note: 'alpha diverges from mobile 0.16 — sized for text' },
    { token: '--cd-secondary-soft', fill: 'rgba(59,130,246,0.16)', rgb: [59, 130, 246], alpha: 0.16, ink: '#5895f7', note: 'as mobile' },
    { token: '--cd-success-soft', fill: 'rgba(45,212,168,0.14)', rgb: [45, 212, 168], alpha: 0.14, ink: '#2dd4a8', note: 'as mobile' },
    { token: '--cd-warning-soft', fill: 'rgba(240,169,58,0.16)', rgb: [240, 169, 58], alpha: 0.16, ink: '#f0a93a', note: 'as mobile' },
    { token: '--cd-danger-soft', fill: 'rgba(244,67,108,0.14)', rgb: [244, 67, 108], alpha: 0.14, ink: '#f55b7f', note: 'as mobile' },
  ],
  fills: [
    { token: '--cd-accent-fill', value: '#d64131', use: 'primary buttons, price pills, the closing band' },
    { token: '--cd-accent-strong', value: '#c03a2c', use: 'pressed and hover state of the fill' },
  ],
};

const LIGHT = {
  name: 'Light — the dashboard',
  note: 'Light is an override, and raised deliberately equals surface: lightness caps at white, so elevation is carried by shadow.',
  ink: { text: '#101828', secondary: '#636d82', faint: '#7a8296', danger: '#c2193e', rule: 'rgba(15,23,42,0.08)' },
  page: '#f5f7fb',
  panel: '#ffffff',
  grounds: [
    { key: 'canvas', token: '--cd-bg', value: '#f5f7fb', use: 'the room' },
    { key: 'surface', token: '--cd-bg-element', value: '#ffffff', use: 'panels, tables, sidebar' },
    { key: 'raised', token: '--cd-bg-raised', value: '#ffffff', use: 'same fill as surface, on purpose', sameAs: 'surface' },
    { key: 'selected', token: '--cd-bg-selected', value: '#eef2f8', use: 'hover and active rows' },
  ],
  foregrounds: [
    { token: '--cd-text', value: '#101828', min: 4.5, use: 'everything read' },
    { token: '--cd-text-secondary', value: '#636d82', min: 4.5, use: 'all real caption and helper text' },
    { token: '--cd-text-faint', value: '#7a8296', min: 3.0, use: 'non-text only, same rule as dark' },
    { token: '--cd-accent', value: '#bf3524', min: 4.5, use: 'links, icon tints, active nav rule' },
    { token: '--cd-secondary', value: '#005be4', min: 4.5, use: 'informational only, never a button' },
    { token: '--cd-success', value: '#0a7551', min: 4.5, use: 'money the creator receives, approved states' },
    { token: '--cd-warning', value: '#8d5b12', min: 4.5, use: 'admin banners, pending review' },
    { token: '--cd-danger', value: '#c2193e', min: 4.5, use: 'declined, destructive, field errors' },
    { token: '--cd-focus', value: '#bf3524', min: 3.0, use: '2px outline at 2px offset' },
  ],
  borderStrong: { token: '--cd-border-strong', value: 'rgba(15,23,42,0.48)', rgb: [15, 23, 42], alpha: 0.48, min: 3.0 },
  border: { token: '--cd-border', value: 'rgba(15,23,42,0.08)', rgb: [15, 23, 42], alpha: 0.08 },
  softs: [
    { token: '--cd-accent-soft', fill: 'rgba(224,64,44,0.06)', rgb: [224, 64, 44], alpha: 0.06, ink: '#bf3524', note: 'alpha diverges from mobile 0.10 — sized for text' },
    { token: '--cd-secondary-soft', fill: 'rgba(19,113,255,0.10)', rgb: [19, 113, 255], alpha: 0.10, ink: '#005be4', note: 'as mobile' },
    { token: '--cd-success-soft', fill: 'rgba(13,159,110,0.10)', rgb: [13, 159, 110], alpha: 0.10, ink: '#0a7551', note: 'as mobile' },
    { token: '--cd-warning-soft', fill: 'rgba(200,129,26,0.12)', rgb: [200, 129, 26], alpha: 0.12, ink: '#8d5b12', note: 'as mobile' },
    { token: '--cd-danger-soft', fill: 'rgba(225,29,72,0.10)', rgb: [225, 29, 72], alpha: 0.10, ink: '#c2193e', note: 'as mobile' },
  ],
  fills: [
    { token: '--cd-accent-fill', value: '#d83e2a', use: 'primary buttons, price pills' },
    { token: '--cd-accent-strong', value: '#c33625', use: 'pressed and hover state of the fill' },
  ],
};

const ART_SCRIM = { value: 'rgba(7,8,11,0.55)', rgb: [7, 8, 11], alpha: 0.55 };

/* Shared type fragments, so the sheet is consistent with itself. */
const ARCHIVO = "'Archivo', 'Helvetica Neue', Arial, sans-serif";
const SCHIBSTED = "'Schibsted Grotesk', 'Helvetica Neue', Arial, sans-serif";
const axes = (wdth, wght) => `font-variation-settings: 'wdth' ${wdth}, 'wght' ${wght};`;
const TNUM = "font-variant-numeric: tabular-nums; font-feature-settings: 'tnum' 1;";
const dataType = (size, wght = 500) =>
  `font-family: ${ARCHIVO}; ${axes(88, wght)} ${TNUM} font-size: ${size}px;`;

export { DARK, LIGHT, ART_SCRIM, ARCHIVO, SCHIBSTED, axes, TNUM, dataType, fmt, rgbToHex };

/* ================================================================== */
/* 3. Page furniture                                                  */
/* ================================================================== */

const MEASURE = 1080;
const RULE_D = 'rgba(255,255,255,0.10)';

/** A section head: full-measure hairline, then the h2 and one line of intent. */
function sectionHead(title, note) {
  return `
      <div style="border-top: 1px solid ${RULE_D}; padding-top: 24px; display: flex; flex-direction: column; gap: 8px;">
        <h2 style="margin: 0; font-family: ${ARCHIVO}; ${axes(100, 600)} font-size: 22px; line-height: 1.25; letter-spacing: -0.015em; color: #f7f8fa;">${title}</h2>
        <p style="margin: 0; font-size: 15px; line-height: 1.6; color: #9ba1ae; max-width: 68ch;">${note}</p>
      </div>`;
}

/**
 * One whole section: the head plus its body, in a single element. The page's
 * 52px rhythm is a gap between sections, so a section's rows must never be
 * siblings of the heads — that is what makes a specimen sheet three times
 * taller than it needs to be.
 */
function section(title, note, body) {
  return `
    <section style="display: flex; flex-direction: column; gap: 20px;">${sectionHead(title, note)}
      <div>${body}
      </div>
    </section>`;
}

const small = (text, color = '#9ba1ae') =>
  `<span style="font-size: 13px; line-height: 1.45; letter-spacing: 0.005em; color: ${color};">${text}</span>`;

/* ================================================================== */
/* 4. Colour — the two palettes, side by side, with computed ratios    */
/* ================================================================== */

/** Every ratio this sheet prints, collected so the sheet can state its own verdict. */
const audit = [];
function record(label, value, min) {
  audit.push({ label, value, min, pass: value >= min });
  return value;
}

const ratioCell = (value, min, width, theme) => {
  const pass = value >= min;
  const colour = pass ? theme.ink.text : theme.ink.danger;
  return `<td style="width: ${width}px; padding: 0; text-align: right; ${dataType(13)} color: ${colour};">${fmt(value)}</td>`;
};

function groundsStrip(theme) {
  const cells = theme.grounds
    .map((g) => {
      const l = luminance(hexToRgb(g.value));
      return `
            <div style="display: flex; flex-direction: column; gap: 6px;">
              <div style="height: 56px; background: ${g.value}; border: 1px solid ${theme.ink.rule}; border-radius: 6px;"></div>
              <div style="display: flex; flex-direction: column; gap: 2px;">
                <span style="font-size: 13px; line-height: 1.2; letter-spacing: 0.01em; font-weight: 600; color: ${theme.ink.text};">${g.key}</span>
                <span style="${dataType(13)} color: ${theme.ink.secondary};">${g.value}</span>
                <span style="${dataType(13)} color: ${theme.ink.secondary};">L ${l.toFixed(5)}</span>
              </div>
            </div>`;
    })
    .join('');
  const same = theme.grounds.find((g) => g.sameAs);
  return `
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;">${cells}
            </div>
            ${same ? `<p style="margin: 0; font-size: 13px; line-height: 1.45; color: ${theme.ink.secondary};">raised and surface are the same fill here, so their columns below carry the same figures. That is the design, not a mistake: on light the step is a shadow.</p>` : ''}
          </div>`;
}

function foregroundTable(theme, themeKey) {
  const grounds = theme.grounds;
  const headers = grounds
    .map(
      (g) =>
        `<th style="width: 62px; padding: 0 0 8px; text-align: right; font-size: 13px; line-height: 1.2; letter-spacing: 0.01em; font-weight: 600; color: ${theme.ink.secondary};">${g.key}</th>`,
    )
    .join('');

  const rows = theme.foregrounds
    .map((f) => {
      const cells = grounds
        .map((g) => {
          const r = record(`${themeKey} ${f.token} on ${g.key}`, contrast(hexToRgb(f.value), hexToRgb(g.value)), f.min);
          return ratioCell(r, f.min, 62, theme);
        })
        .join('');
      return `
              <tr style="border-top: 1px solid ${theme.ink.rule};">
                <td style="width: 30px; padding: 10px 0;"><span style="display: block; width: 22px; height: 22px; border-radius: 4px; background: ${f.value};"></span></td>
                <td style="padding: 10px 10px 10px 0;">
                  <span style="display: block; font-size: 13px; line-height: 1.2; letter-spacing: 0.01em; font-weight: 600; color: ${theme.ink.text};">${f.token}</span>
                  <span style="display: block; ${dataType(13)} color: ${theme.ink.secondary};">${f.value}</span>
                  <span style="display: block; font-size: 13px; line-height: 1.45; color: ${theme.ink.secondary};">${f.use} &mdash; needs ${fmt(f.min)}</span>
                </td>${cells}
              </tr>`;
    })
    .join('');

  const bs = theme.borderStrong;
  const bsCells = grounds
    .map((g) => {
      const composited = over(bs.rgb, bs.alpha, hexToRgb(g.value));
      const r = record(`${themeKey} ${bs.token} on ${g.key}`, contrast(composited, hexToRgb(g.value)), bs.min);
      return ratioCell(r, bs.min, 62, theme);
    })
    .join('');
  const bsHexes = grounds.map((g) => rgbToHex(over(bs.rgb, bs.alpha, hexToRgb(g.value)))).join('  ');

  const bsRow = `
              <tr style="border-top: 1px solid ${theme.ink.rule};">
                <td style="width: 30px; padding: 10px 0;"><span style="display: block; width: 22px; height: 22px; border-radius: 4px; background: ${theme.grounds[1].value}; border: 2px solid ${bs.value};"></span></td>
                <td style="padding: 10px 10px 10px 0;">
                  <span style="display: block; font-size: 13px; line-height: 1.2; letter-spacing: 0.01em; font-weight: 600; color: ${theme.ink.text};">${bs.token}</span>
                  <span style="display: block; ${dataType(13)} color: ${theme.ink.secondary};">${bs.value}</span>
                  <span style="display: block; font-size: 13px; line-height: 1.45; color: ${theme.ink.secondary};">control boundaries &mdash; needs 3.00, composites to ${bsHexes}</span>
                </td>${bsCells}
              </tr>`;

  return `
            <table style="width: 100%; border-collapse: collapse; table-layout: fixed;">
              <thead>
                <tr>
                  <th style="width: 30px; padding: 0 0 8px;">&nbsp;</th>
                  <th style="padding: 0 10px 8px 0; text-align: left; font-size: 13px; line-height: 1.2; letter-spacing: 0.01em; font-weight: 600; color: ${theme.ink.secondary};">Token and its intended job</th>${headers}
                </tr>
              </thead>
              <tbody>${rows}${bsRow}
              </tbody>
            </table>`;
}

function softTable(theme, themeKey) {
  const grounds = theme.grounds;
  const headers = grounds
    .map(
      (g) =>
        `<th style="width: 62px; padding: 0 0 8px; text-align: right; font-size: 13px; line-height: 1.2; letter-spacing: 0.01em; font-weight: 600; color: ${theme.ink.secondary};">${g.key}</th>`,
    )
    .join('');

  const rows = theme.softs
    .map((s) => {
      const worst = hexToRgb(grounds[grounds.length - 1].value);
      const chipFill = rgbToHex(over(s.rgb, s.alpha, worst));
      const cells = grounds
        .map((g) => {
          const bg = over(s.rgb, s.alpha, hexToRgb(g.value));
          const r = record(`${themeKey} ${s.ink} over ${s.token} on ${g.key}`, contrast(hexToRgb(s.ink), bg), 4.5);
          return ratioCell(r, 4.5, 62, theme);
        })
        .join('');
      return `
              <tr style="border-top: 1px solid ${theme.ink.rule};">
                <td style="width: 76px; padding: 10px 0;"><span style="display: inline-flex; align-items: center; height: 24px; padding: 0 8px; border-radius: 4px; background: ${chipFill}; color: ${s.ink}; font-size: 13px; line-height: 1; font-weight: 600;">Active</span></td>
                <td style="padding: 10px 10px 10px 0;">
                  <span style="display: block; font-size: 13px; line-height: 1.2; letter-spacing: 0.01em; font-weight: 600; color: ${theme.ink.text};">${s.token}</span>
                  <span style="display: block; ${dataType(13)} color: ${theme.ink.secondary};">${s.fill}</span>
                  <span style="display: block; font-size: 13px; line-height: 1.45; color: ${theme.ink.secondary};">${s.note}</span>
                </td>${cells}
              </tr>`;
    })
    .join('');

  return `
            <table style="width: 100%; border-collapse: collapse; table-layout: fixed;">
              <thead>
                <tr>
                  <th style="width: 76px; padding: 0 0 8px; text-align: left; font-size: 13px; line-height: 1.2; letter-spacing: 0.01em; font-weight: 600; color: ${theme.ink.secondary};">Chip</th>
                  <th style="padding: 0 10px 8px 0; text-align: left; font-size: 13px; line-height: 1.2; letter-spacing: 0.01em; font-weight: 600; color: ${theme.ink.secondary};">Its own colour read on it, per ground</th>${headers}
                </tr>
              </thead>
              <tbody>${rows}
              </tbody>
            </table>`;
}

function fillTable(theme, themeKey) {
  const rows = theme.fills
    .map((f) => {
      const r = record(`${themeKey} white on ${f.token}`, contrast([255, 255, 255], hexToRgb(f.value)), 4.5);
      return `
              <tr style="border-top: 1px solid ${theme.ink.rule};">
                <td style="width: 130px; padding: 10px 0;"><span style="display: inline-flex; align-items: center; height: 32px; padding: 0 12px; border-radius: 6px; background: ${f.value}; color: #ffffff; font-size: 15px; font-weight: 600; line-height: 1;">Request access</span></td>
                <td style="padding: 10px 10px 10px 0;">
                  <span style="display: block; font-size: 13px; line-height: 1.2; letter-spacing: 0.01em; font-weight: 600; color: ${theme.ink.text};">${f.token}</span>
                  <span style="display: block; ${dataType(13)} color: ${theme.ink.secondary};">${f.value}</span>
                  <span style="display: block; font-size: 13px; line-height: 1.45; color: ${theme.ink.secondary};">${f.use}</span>
                </td>
                ${ratioCell(r, 4.5, 62, theme)}
              </tr>`;
    })
    .join('');

  // Why two coral tokens, argued from this theme's own numbers.
  const accentValue = themeKey === 'dark' ? '#ff503d' : '#bf3524';
  const whiteOnAccent = contrast([255, 255, 255], hexToRgb(accentValue));
  const accentOnCanvas = contrast(hexToRgb(accentValue), hexToRgb(theme.grounds[0].value));
  const fillOnCanvas = contrast(hexToRgb(theme.fills[0].value), hexToRgb(theme.grounds[0].value));
  const whyTwo =
    themeKey === 'dark'
      ? `This is why the fill exists. White on the foreground coral --cd-accent is only ${fmt(whiteOnAccent)}, so coral-as-a-surface and coral-as-a-word are two different tokens and never swap.`
      : `Light keeps the same two roles rather than collapsing them. --cd-accent is darkened until it can be read as a word on a light ground (${fmt(accentOnCanvas)} on the canvas, where the dark theme's #ff503d manages only ${fmt(contrast(hexToRgb('#ff503d'), hexToRgb(theme.grounds[0].value)))}); --cd-accent-fill stays lighter so a coral button still reads as coral rather than brick (${fmt(fillOnCanvas)} against the canvas it sits on) while white on it holds at ${fmt(contrast([255, 255, 255], hexToRgb(theme.fills[0].value)))}. Surface and word are the same two roles in both themes, and they never swap.`;
  return `
            <table style="width: 100%; border-collapse: collapse; table-layout: fixed;">
              <thead>
                <tr>
                  <th style="width: 130px; padding: 0 0 8px; text-align: left; font-size: 13px; line-height: 1.2; letter-spacing: 0.01em; font-weight: 600; color: ${theme.ink.secondary};">Surface</th>
                  <th style="padding: 0 10px 8px 0; text-align: left; font-size: 13px; line-height: 1.2; letter-spacing: 0.01em; font-weight: 600; color: ${theme.ink.secondary};">--cd-on-accent (#ffffff) on it</th>
                  <th style="width: 62px; padding: 0 0 8px; text-align: right; font-size: 13px; line-height: 1.2; letter-spacing: 0.01em; font-weight: 600; color: ${theme.ink.secondary};">ratio</th>
                </tr>
              </thead>
              <tbody>${rows}
              </tbody>
            </table>
            <p style="margin: 12px 0 0; font-size: 13px; line-height: 1.45; color: ${theme.ink.secondary};">${whyTwo}</p>`;
}

function decorativeNote(theme, themeKey) {
  const b = theme.border;
  const ground = hexToRgb(theme.grounds[0].value);
  const r = contrast(over(b.rgb, b.alpha, ground), ground);
  return `
            <p style="margin: 0; font-size: 13px; line-height: 1.45; color: ${theme.ink.secondary};">${b.token} <span style="${dataType(13)}">${b.value}</span> composites to <span style="${dataType(13)}">${rgbToHex(over(b.rgb, b.alpha, ground))}</span> on canvas, <span style="${dataType(13)}">${fmt(r)}</span> &mdash; deliberately below 3.00. It is decorative: nothing is identified by it, so 1.4.11 does not apply. Do not "fix" it upward.</p>`;
}

function paletteColumn(theme, themeKey) {
  const isDark = themeKey === 'dark';
  return `
        <section style="width: 528px; box-sizing: border-box; padding: 20px; background: ${theme.page}; border: 1px solid ${theme.ink.rule}; border-radius: 10px; display: flex; flex-direction: column; gap: 20px;">
          <div style="display: flex; flex-direction: column; gap: 6px;">
            <h3 style="margin: 0; font-family: ${ARCHIVO}; ${axes(100, 600)} font-size: 22px; line-height: 1.25; letter-spacing: -0.015em; color: ${theme.ink.text};">${theme.name}</h3>
            <p style="margin: 0; font-size: 13px; line-height: 1.45; color: ${theme.ink.secondary};">${theme.note}</p>
          </div>
          ${groundsStrip(theme)}
          ${foregroundTable(theme, themeKey)}
          ${softTable(theme, themeKey)}
          ${fillTable(theme, themeKey)}
          ${decorativeNote(theme, themeKey)}
        </section>`;
}

/* ================================================================== */
/* 5. Type — the scale, set in the real faces at the real sizes        */
/* ================================================================== */

const TYPE_ROLES = [
  {
    role: 'hero',
    meta: "Archivo, 'wdth' 118, 'wght' 700 · clamp(2.75rem, 6.2vw, 5.5rem) · line-height 0.94 · letter-spacing −0.035em · landing and /get-the-app H1 only",
    css: `font-family: ${ARCHIVO}; ${axes(118, 700)} font-size: 74px; line-height: 0.94; letter-spacing: -0.035em;`,
    extra: 'Rendered at 74px, which is what 6.2vw resolves to in this 1200px frame. At the 1440px landing it clamps to 88px.',
    text: 'Nothing is charged until the content is good.',
  },
  {
    role: 'display',
    meta: "Archivo, 'wdth' 112, 'wght' 650 · clamp(2rem, 3.6vw, 3.25rem) · line-height 1.00 · letter-spacing −0.03em · marketing section headings",
    css: `font-family: ${ARCHIVO}; ${axes(112, 650)} font-size: 43px; line-height: 1; letter-spacing: -0.03em;`,
    text: 'What it costs you',
  },
  {
    role: 'h1',
    meta: "Archivo, 'wdth' 105, 'wght' 600 · 2rem / 32px · line-height 1.10 · letter-spacing −0.025em · dashboard and legal page titles",
    css: `font-family: ${ARCHIVO}; ${axes(105, 600)} font-size: 32px; line-height: 1.1; letter-spacing: -0.025em;`,
    text: 'Dashboard',
  },
  {
    role: 'h2',
    meta: "Archivo, 'wdth' 100, 'wght' 600 · 1.375rem / 22px · line-height 1.25 · letter-spacing −0.015em · panel headings, legal subheads",
    css: `font-family: ${ARCHIVO}; ${axes(100, 600)} font-size: 22px; line-height: 1.25; letter-spacing: -0.015em;`,
    text: 'Needs you',
  },
  {
    role: 'h3',
    meta: 'Schibsted Grotesk 600 · 1.0625rem / 17px · line-height 1.35 · letter-spacing −0.005em · row titles, FAQ questions, form group names',
    css: `font-family: ${SCHIBSTED}; font-weight: 600; font-size: 17px; line-height: 1.35; letter-spacing: -0.005em;`,
    text: 'When is my card actually charged?',
  },
  {
    role: 'lead',
    meta: 'Schibsted Grotesk 400 · 1.1875rem / 19px · line-height 1.60 · letter-spacing −0.005em · max 62ch · hero sub-copy, section intros',
    css: `font-family: ${SCHIBSTED}; font-weight: 400; font-size: 19px; line-height: 1.6; letter-spacing: -0.005em; max-width: 62ch;`,
    text: 'Posting a brief is free. Creators near you apply with a pitch and a rate. Accept one at $400 and $400 is held; approve their work and $400 is charged, $340 of it to the creator.',
  },
  {
    role: 'body-lg',
    meta: 'Schibsted Grotesk 400 · 1.0625rem / 17px · line-height 1.65 · max 68ch · marketing body, legal body',
    css: `font-family: ${SCHIBSTED}; font-weight: 400; font-size: 17px; line-height: 1.65; max-width: 68ch;`,
    text: 'The rate you agreed, not a surcharge on top of it. Accept at $400.00 and $400.00 is what you pay; the creator receives $340.00.',
  },
  {
    role: 'body',
    meta: 'Schibsted Grotesk 400 · 0.9375rem / 15px · line-height 1.60 · max 68ch · dashboard body, form help',
    css: `font-family: ${SCHIBSTED}; font-weight: 400; font-size: 15px; line-height: 1.6; max-width: 68ch;`,
    text: 'A creator accepted at $500.00 receives $425.00 after the 15% fee. You are authorized for up to $500.00 until you approve the content.',
  },
  {
    role: 'small',
    meta: 'Schibsted Grotesk 400 · 0.8125rem / 13px · line-height 1.45 · letter-spacing 0.005em · captions, footnotes, table meta',
    css: `font-family: ${SCHIBSTED}; font-weight: 400; font-size: 13px; line-height: 1.45; letter-spacing: 0.005em;`,
    text: 'Approving captures the $400.00 hold and releases $340.00 to Ana Reyes.',
  },
  {
    role: 'label',
    meta: 'Schibsted Grotesk 600 · 0.8125rem / 13px · line-height 1.20 · letter-spacing 0.01em · field labels, table headers, sidebar section names. Sentence case. Never uppercase.',
    css: `font-family: ${SCHIBSTED}; font-weight: 600; font-size: 13px; line-height: 1.2; letter-spacing: 0.01em;`,
    text: 'Still owed',
  },
  {
    role: 'data-lg',
    meta: "Archivo, 'wdth' 88, 'wght' 600, tabular-nums · clamp(1.75rem, 2.6vw, 2.5rem) · line-height 1.00 · letter-spacing −0.02em · the money strip, metric figures, the slip's totals",
    css: `font-family: ${ARCHIVO}; ${axes(88, 600)} ${TNUM} font-size: 31px; line-height: 1; letter-spacing: -0.02em;`,
    extra: 'Rendered at 31px (2.6vw of this frame). The columns are the point: every figure below sits on the same rhythm.',
    text: '$950.00&nbsp;&nbsp;&nbsp;$700.00&nbsp;&nbsp;&nbsp;$250.00&nbsp;&nbsp;&nbsp;$212.50',
  },
  {
    role: 'data',
    meta: "Archivo, 'wdth' 88, 'wght' 500, tabular-nums · 0.9375rem / 15px · line-height 1.40 · money and counts inside table rows, dates, referral codes",
    css: `font-family: ${ARCHIVO}; ${axes(88, 500)} ${TNUM} font-size: 15px; line-height: 1.4;`,
    text: '$400.00&nbsp;&nbsp;&nbsp;$340.00&nbsp;&nbsp;&nbsp;3d left&nbsp;&nbsp;&nbsp;12d left&nbsp;&nbsp;&nbsp;FERROUS-2026',
  },
];

function typeSection() {
  const rows = TYPE_ROLES.map(
    (r) => `
        <div style="border-top: 1px solid ${RULE_D}; padding: 18px 0 22px; display: flex; flex-direction: column; gap: 10px;">
          <div style="display: flex; align-items: baseline; gap: 14px; flex-wrap: wrap;">
            <span style="font-size: 13px; line-height: 1.2; letter-spacing: 0.01em; font-weight: 600; color: #f7f8fa; min-width: 68px;">${r.role}</span>
            <span style="font-size: 13px; line-height: 1.45; letter-spacing: 0.005em; color: #9ba1ae;">${r.meta}</span>
          </div>
          <div style="${r.css} color: #f7f8fa;">${r.text}</div>
          ${r.extra ? `<p style="margin: 0; font-size: 13px; line-height: 1.45; color: #9ba1ae;">${r.extra}</p>` : ''}
        </div>`,
  ).join('');

  const pairing = `
        <div style="border-top: 1px solid ${RULE_D}; padding: 18px 0 4px; display: flex; flex-direction: column; gap: 12px;">
          <span style="font-size: 13px; line-height: 1.2; letter-spacing: 0.01em; font-weight: 600; color: #f7f8fa;">The pairing test &mdash; the one thing this sheet exists to settle</span>
          <p style="margin: 0; font-size: 15px; line-height: 1.6; color: #9ba1ae; max-width: 68ch;">Both lines are 17px. If the two lowercase settings do not read as two clearly different voices at this size, the pairing has failed and a Plan B display face is needed before Phase 2 starts.</p>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px;">
            <div style="display: flex; flex-direction: column; gap: 6px;">
              ${small("Archivo, 'wdth' 105, 'wght' 400")}
              <span style="font-family: ${ARCHIVO}; ${axes(105, 400)} font-size: 17px; line-height: 1.65; color: #f7f8fa;">Creators near you apply with a pitch and a rate.</span>
            </div>
            <div style="display: flex; flex-direction: column; gap: 6px;">
              ${small('Schibsted Grotesk 400')}
              <span style="font-family: ${SCHIBSTED}; font-weight: 400; font-size: 17px; line-height: 1.65; color: #f7f8fa;">Creators near you apply with a pitch and a rate.</span>
            </div>
          </div>
        </div>`;

  return rows + pairing;
}

/* ================================================================== */
/* 6. Radius                                                          */
/* ================================================================== */

/**
 * Each radius is shown as the thing that actually carries it. An abstract grey
 * box at five radii is unreadable — 4px and 6px are two pixels apart — and it
 * also loses the argument the brief is making, which is that the corner tells
 * you what kind of thing you are looking at.
 */
const RADII = [
  {
    token: '--cd-radius-0',
    value: '0',
    use: 'full-bleed bands, the sticky nav, table rules, the sidebar, the comparison table. Sharp where a structure is a rule, not an object.',
    sample: `
              <div style="width: 100%; background: #12141b; border-radius: 0; border-bottom: 1px solid ${RULE_D};">
                <div style="padding: 10px 12px; display: flex; justify-content: space-between; border-bottom: 1px solid ${RULE_D};"><span style="font-size: 13px; line-height: 1.2; letter-spacing: 0.01em; font-weight: 600; color: #9ba1ae;">Campaign</span><span style="font-size: 13px; line-height: 1.2; letter-spacing: 0.01em; font-weight: 600; color: #9ba1ae;">Budget</span></div>
                <div style="padding: 12px; display: flex; justify-content: space-between;"><span style="font-size: 15px; color: #f7f8fa;">Saturday brunch</span><span style="${dataType(15)} color: #f7f8fa;">$400.00</span></div>
              </div>`,
  },
  {
    token: '--cd-radius-1',
    value: '4px',
    use: 'status pills, badges, filter chips, checkboxes, the price pill on artwork.',
    sample: `
              <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 16px 0;">
                <span style="display: inline-flex; align-items: center; height: 24px; padding: 0 8px; border-radius: 4px; background: rgba(45,212,168,0.14); color: #2dd4a8; font-size: 13px; line-height: 1; font-weight: 600;">Active</span>
                <span style="display: inline-flex; align-items: center; height: 24px; padding: 0 8px; border-radius: 4px; background: rgba(240,169,58,0.16); color: #f0a93a; font-size: 13px; line-height: 1; font-weight: 600;">Needs review</span>
                <span style="display: inline-flex; align-items: center; height: 26px; padding: 0 10px; border-radius: 4px; background: #d64131; color: #ffffff; ${dataType(15, 600)} line-height: 1;">$400</span>
              </div>`,
  },
  {
    token: '--cd-radius-2',
    value: '6px',
    use: 'buttons, inputs, selects, textareas. A 6px coral rectangle reads like a key on a card terminal, which is the world this product lives in.',
    sample: `
              <div style="display: flex; flex-direction: column; gap: 10px; padding: 12px 0;">
                <span class="cd-press" style="height: 40px; padding: 0 18px; display: inline-flex; align-items: center; justify-content: center; border-radius: 6px; background: #d64131; color: #ffffff; font-size: 15px; font-weight: 600; line-height: 1;">Request access</span>
                <span style="box-sizing: border-box; height: 44px; padding: 0 12px; display: flex; align-items: center; border: 1px solid rgba(255,255,255,0.36); border-radius: 6px; background: #1b1e27; ${dataType(15)} color: #f7f8fa;">$400.00</span>
              </div>`,
  },
  {
    token: '--cd-radius-3',
    value: '10px',
    use: 'cards, panels, cover art, table thumbnails, empty states. Rounded where the thing is an object you could pick up.',
    sample: `
              <div style="padding: 12px 0;">
                <div style="position:relative;overflow:hidden;width:100%;height:84px;border-radius:10px;background-image:linear-gradient(135deg, #7c3aed 0%, #3b0f8f 100%);"><span aria-hidden="true" style="position:absolute;left:60.04%;top:59.65%;width:72.58px;height:72.58px;margin-left:-36.29px;margin-top:-36.29px;border-radius:50%;background:#ffffff;opacity:0.1;"></span><span aria-hidden="true" style="position:absolute;left:58.48%;top:58.09%;width:71.5px;height:71.5px;margin-left:-35.75px;margin-top:-35.75px;border-radius:50%;background:#ffffff;opacity:0.1;"></span></div>
              </div>`,
  },
  {
    token: '--cd-radius-4',
    value: '14px',
    use: 'modals, drawers, and the hero slip. The largest radius in the system, reserved for things that sit on top of the page.',
    sample: `
              <div style="padding: 12px 0;">
                <div style="background: #171a22; border: 1px solid ${RULE_D}; border-radius: 14px; box-shadow: inset 0 1px 0 rgba(255,255,255,0.04); padding: 12px 14px; display: flex; flex-direction: column; gap: 8px;">
                  <span style="font-size: 15px; font-weight: 600; color: #f7f8fa;">Accepted rate</span>
                  <div style="display: flex; align-items: baseline; justify-content: space-between; border-top: 1px solid ${RULE_D}; padding-top: 8px;"><span style="font-size: 13px; color: #9ba1ae;">Ana Reyes receives</span><span style="${dataType(15, 600)} color: #2dd4a8;">$340.00</span></div>
                </div>
              </div>`,
  },
  {
    token: '--cd-radius-full',
    value: '999px',
    use: 'Avatars and the live dot. Nothing else &mdash; never a button, never a chip, never a nav item.',
    sample: `
              <div style="display: flex; align-items: center; gap: 12px; padding: 24px 0;">
                <span style="width: 40px; height: 40px; border-radius: 999px; background: #c22514; color: #ffffff; display: flex; align-items: center; justify-content: center; font-family: ${ARCHIVO}; ${axes(100, 700)} font-size: 15px; line-height: 1;">AR</span>
                <span style="display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: #9ba1ae;"><span aria-hidden="true" style="width: 8px; height: 8px; border-radius: 999px; background: #2dd4a8; display: block;"></span>Live</span>
              </div>`,
  },
];

function radiusSection() {
  const cells = RADII.map(
    (r) => `
          <div style="display: flex; flex-direction: column; gap: 10px;">
            <div style="min-height: 108px; display: flex; align-items: center;">
              <div style="width: 100%;">${r.sample}
              </div>
            </div>
            <div style="display: flex; flex-direction: column; gap: 3px; border-top: 1px solid ${RULE_D}; padding-top: 10px;">
              <span style="font-size: 13px; line-height: 1.2; letter-spacing: 0.01em; font-weight: 600; color: #f7f8fa;">${r.token}</span>
              <span style="${dataType(13)} color: #9ba1ae;">${r.value}</span>
              <span style="font-size: 13px; line-height: 1.45; color: #9ba1ae;">${r.use}</span>
            </div>
          </div>`,
  ).join('');

  return `
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 28px 24px;">${cells}
        </div>
        <p style="margin: 24px 0 0; font-size: 15px; line-height: 1.6; color: #9ba1ae; max-width: 68ch;">Nothing in this product carries a radius between 18px and 40px. That band is where the SaaS card kit lives: it is banned by grep, not by taste, and no sample of it appears on this sheet.</p>`;
}

/* ================================================================== */
/* 7. Elevation                                                       */
/* ================================================================== */

const ELEVATION = [
  {
    theme: 'Dark',
    ground: '#07080b',
    ink: '#f7f8fa',
    sub: '#9ba1ae',
    levels: [
      { n: '0 canvas', style: 'background: #07080b;', recipe: '--cd-bg. No border, no shadow. This cell looks empty because it is: level 0 is the room the other three sit in.' },
      { n: '1 surface', style: `background: #12141b; border: 1px solid ${RULE_D};`, recipe: '--cd-bg-element + 1px --cd-border + --cd-elev-1 (none).' },
      { n: '2 raised', style: `background: #171a22; border: 1px solid ${RULE_D}; box-shadow: inset 0 1px 0 rgba(255,255,255,0.04);`, recipe: '--cd-bg-raised + 1px --cd-border + --cd-elev-2, which on dark is a 1px inner top highlight, not a drop shadow. It is drawn here, where the token is the subject; the other artboards omit it, because the canvas rule for Phase 1 is no box-shadow on a dark surface below level 3 and at 4% alpha the highlight is invisible at artboard scale.' },
      { n: '3 overlay', style: 'background: #171a22; border: 1px solid rgba(255,255,255,0.14); box-shadow: 0 24px 64px -12px rgba(0,0,0,0.75);', recipe: '--cd-bg-raised + 1px rgba(255,255,255,0.14) + --cd-elev-3, over a rgba(7,8,11,0.72) page scrim. The only level on dark that may carry a box-shadow.', scrim: 'rgba(7,8,11,0.72)' },
    ],
  },
  {
    theme: 'Light',
    ground: '#f5f7fb',
    ink: '#101828',
    sub: '#636d82',
    levels: [
      { n: '0 canvas', style: 'background: #f5f7fb;', recipe: '--cd-bg. No border, no shadow. This cell looks empty because it is: level 0 is the room the other three sit in.' },
      { n: '1 surface', style: 'background: #ffffff; border: 1px solid rgba(15,23,42,0.08);', recipe: '--cd-bg-element + 1px --cd-border.' },
      { n: '2 raised', style: 'background: #ffffff; box-shadow: 0 1px 2px rgba(15,23,42,0.06), 0 8px 24px -8px rgba(15,23,42,0.10);', recipe: '--cd-bg-raised (= white) + --cd-elev-2. Light caps at white, so the step is a shadow. One mechanism per theme, never both.' },
      { n: '3 overlay', style: 'background: #ffffff; box-shadow: 0 24px 64px -12px rgba(15,23,42,0.22);', recipe: '--cd-bg-raised + --cd-elev-3, over a rgba(15,23,42,0.32) scrim.', scrim: 'rgba(15,23,42,0.32)' },
    ],
  },
];

function elevationSection() {
  return ELEVATION.map((t) => {
    const cells = t.levels
      .map(
        (l) => `
            <div style="display: flex; flex-direction: column; gap: 10px;">
              <div style="height: 96px; padding: 8px; border-radius: 10px; ${l.scrim ? `background: ${l.scrim};` : ''} display: flex;">
                <div style="flex: 1; border-radius: 10px; ${l.style}"></div>
              </div>
              <div style="display: flex; flex-direction: column; gap: 3px;">
                <span style="font-size: 13px; line-height: 1.2; letter-spacing: 0.01em; font-weight: 600; color: ${t.ink};">${l.n}</span>
                <span style="font-size: 13px; line-height: 1.45; color: ${t.sub};">${l.recipe}</span>
              </div>
            </div>`,
      )
      .join('');
    return `
        <section style="width: 528px; box-sizing: border-box; padding: 20px; background: ${t.ground}; border: 1px solid ${RULE_D}; border-radius: 10px; display: flex; flex-direction: column; gap: 14px;">
          <span style="font-size: 13px; line-height: 1.2; letter-spacing: 0.01em; font-weight: 600; color: ${t.ink};">${t.theme}</span>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px;">${cells}
          </div>
        </section>`;
  }).join('');
}

/* ================================================================== */
/* 8. Money microcopy (01-design-brief.md §8) — fixture figures only    */
/* ================================================================== */

const money = (text, color = '#f7f8fa', wght = 500) =>
  `<span style="${dataType(15, wght)} color: ${color};">${text}</span>`;

const MONEY_RULES = [
  {
    rule: 'Always show the pair.',
    body: 'Wherever a rate sits next to an action, show what the brand pays and what the creator nets. Never one without the other.',
    example: `<div style="display: flex; align-items: baseline; gap: 8px;">${money('$400.00')}<span style="font-size: 15px; color: #9ba1ae;">charged</span><span style="font-size: 15px; color: #9ba1ae;">&middot;</span>${money('$340.00', '#2dd4a8')}<span style="font-size: 15px; color: #9ba1ae;">to Ana Reyes</span></div>`,
  },
  {
    rule: 'The fee is "out of", never "plus".',
    body: 'There is no arrangement in which the brand pays more than the accepted rate, so the copy never implies one.',
    example: `<div style="display: flex; flex-direction: column; gap: 6px;">
              <span style="font-size: 15px; line-height: 1.6; color: #f7f8fa;">15% platform fee, taken out of the rate.</span>
              <span style="font-size: 13px; line-height: 1.45; color: #9ba1ae;">Never written: plus fees, +15%, excluding fees.</span>
            </div>`,
  },
  {
    rule: 'Money buttons carry the number.',
    body: 'The amount lives on the control that moves it, so nobody has to look away to check what they are agreeing to.',
    example: `<div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
              <span class="cd-press" style="height: 40px; padding: 0 18px; display: inline-flex; align-items: center; gap: 6px; border-radius: 6px; background: #d64131; color: #ffffff; font-size: 15px; font-weight: 600; line-height: 1;">Accept and hold <span style="${dataType(15, 600)}">$425.00</span></span>
              <span class="cd-press" style="height: 40px; padding: 0 18px; display: inline-flex; align-items: center; gap: 6px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.36); color: #f7f8fa; font-size: 15px; font-weight: 600; line-height: 1;">Approve and pay <span style="${dataType(15, 600)}">$400.00</span></span>
            </div>`,
  },
  {
    rule: 'One word per action, from the ad to the receipt.',
    body: 'The same event keeps the same verb from marketing copy through to the confirmation.',
    example: `<dl style="margin: 0; display: grid; grid-template-columns: 92px 1fr; gap: 6px 14px;">
              <dt style="font-size: 13px; line-height: 1.45; font-weight: 600; color: #f7f8fa;">Accept</dt><dd style="margin: 0; font-size: 13px; line-height: 1.45; color: #9ba1ae;">authorize, hold</dd>
              <dt style="font-size: 13px; line-height: 1.45; font-weight: 600; color: #f7f8fa;">Approve</dt><dd style="margin: 0; font-size: 13px; line-height: 1.45; color: #9ba1ae;">capture, charge, pay</dd>
              <dt style="font-size: 13px; line-height: 1.45; font-weight: 600; color: #f7f8fa;">Decline</dt><dd style="margin: 0; font-size: 13px; line-height: 1.45; color: #9ba1ae;">nothing is charged</dd>
              <dt style="font-size: 13px; line-height: 1.45; font-weight: 600; color: #f7f8fa;">Revision</dt><dd style="margin: 0; font-size: 13px; line-height: 1.45; color: #9ba1ae;">the hold stays in place</dd>
            </dl>`,
  },
  {
    rule: 'Never abbreviated.',
    body: 'formatCents everywhere, tabular, right-aligned in tables. The compact form is a mobile-tile affordance and it stays on mobile.',
    example: `<div style="display: flex; align-items: baseline; gap: 16px;">${money('$1,325.00')}<span style="font-size: 13px; line-height: 1.45; color: #9ba1ae;">never $1.3k</span></div>`,
  },
  {
    rule: 'The fee line is a real minus sign, and it is not red.',
    body: 'U+2212 in --cd-text-secondary. A fee is an agreed term, not an error, and colouring it --cd-danger would say otherwise.',
    example: `<dl style="margin: 0; width: 300px;">
              <div style="display: flex; align-items: baseline; justify-content: space-between; gap: 16px; padding: 10px 0; border-bottom: 1px solid ${RULE_D};"><dt style="font-size: 15px; color: #9ba1ae;">Platform fee (15%)</dt><dd style="margin: 0;">${money('&minus;$60.00', '#9ba1ae')}</dd></div>
              <div style="display: flex; align-items: baseline; justify-content: space-between; gap: 16px; padding: 10px 0;"><dt style="font-size: 15px; font-weight: 600; color: #f7f8fa;">Ana Reyes receives</dt><dd style="margin: 0;">${money('$340.00', '#2dd4a8', 600)}</dd></div>
            </dl>`,
  },
  {
    rule: 'There is no total that adds the fee on top.',
    body: 'If a screen needs a total, the total is the accepted rate. No screen may render a larger number than the rate the brand agreed to.',
    example: `<div style="display: flex; flex-direction: column; gap: 6px;">
              <span style="font-size: 15px; line-height: 1.6; color: #f7f8fa;">Marcus Ilagan asks ${money('$425.00')}. Your total is ${money('$425.00')}.</span>
              <span style="font-size: 13px; line-height: 1.45; color: #9ba1ae;">He receives $361.25. The number $488.75 does not exist anywhere in this product.</span>
            </div>`,
  },
  {
    rule: 'Cents when amounts are adjacent, no cents when one stands alone.',
    body: 'Marketing prose and headlines drop the cents. Anything that sits beside another figure keeps them, so the columns line up.',
    example: `<div style="display: flex; flex-direction: column; gap: 6px;">
              <span style="font-size: 17px; line-height: 1.65; color: #f7f8fa;">Accept one at $400 and $400 is held.</span>
              <span style="font-size: 15px; line-height: 1.6; color: #9ba1ae;">Charged ${money('$250.00', '#9ba1ae')} &nbsp;including ${money('$37.50', '#9ba1ae')} in platform fees.</span>
            </div>`,
  },
];

function moneySection() {
  const cells = `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0 40px;">${MONEY_RULES.map(
          (m) => `
          <div style="border-top: 1px solid ${RULE_D}; padding: 16px 0 20px; display: flex; flex-direction: column; gap: 8px;">
            <span style="font-size: 17px; line-height: 1.35; font-weight: 600; letter-spacing: -0.005em; color: #f7f8fa;">${m.rule}</span>
            <p style="margin: 0; font-size: 13px; line-height: 1.45; color: #9ba1ae;">${m.body}</p>
            <div style="padding-top: 4px;">${m.example}</div>
          </div>`,
        ).join('')}
        </div>`;

  const reconcile = `
        <div style="margin-top: 24px; padding: 20px; background: #12141b; border: 1px solid ${RULE_D}; border-radius: 10px; display: flex; flex-direction: column; gap: 12px;">
          <span style="font-size: 17px; line-height: 1.35; font-weight: 600; letter-spacing: -0.005em; color: #f7f8fa;">Every figure on every artboard reconciles to this</span>
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr>
                <th style="text-align: left; padding: 0 0 8px; font-size: 13px; line-height: 1.2; letter-spacing: 0.01em; font-weight: 600; color: #9ba1ae;">Creator and state</th>
                <th style="text-align: right; width: 120px; padding: 0 0 8px; font-size: 13px; line-height: 1.2; letter-spacing: 0.01em; font-weight: 600; color: #9ba1ae;">Accepted rate</th>
                <th style="text-align: right; width: 120px; padding: 0 0 8px; font-size: 13px; line-height: 1.2; letter-spacing: 0.01em; font-weight: 600; color: #9ba1ae;">Fee at 15%</th>
                <th style="text-align: right; width: 120px; padding: 0 0 8px; font-size: 13px; line-height: 1.2; letter-spacing: 0.01em; font-weight: 600; color: #9ba1ae;">Creator receives</th>
              </tr>
            </thead>
            <tbody>
              ${[
                ['Ana Reyes, accepted and held', '$400.00', '&minus;$60.00', '$340.00'],
                ['Deshawn Pope, accepted and held', '$300.00', '&minus;$45.00', '$255.00'],
                ['Lucia Marchetti, approved and paid', '$250.00', '&minus;$37.50', '$212.50'],
                ['Marcus Ilagan, application pending', '$425.00', '&minus;$63.75', '$361.25'],
              ]
                .map(
                  (r) => `<tr style="border-top: 1px solid ${RULE_D};">
                <td style="padding: 10px 0; font-size: 15px; color: #f7f8fa;">${r[0]}</td>
                <td style="padding: 10px 0; text-align: right; ${dataType(15)} color: #f7f8fa;">${r[1]}</td>
                <td style="padding: 10px 0; text-align: right; ${dataType(15)} color: #9ba1ae;">${r[2]}</td>
                <td style="padding: 10px 0; text-align: right; ${dataType(15)} color: #2dd4a8;">${r[3]}</td>
              </tr>`,
                )
                .join('')}
            </tbody>
          </table>
          <p style="margin: 0; font-size: 15px; line-height: 1.6; color: #9ba1ae; max-width: 68ch;">The dashboard money strip is these four rows summed: committed $950.00 is the three accepted rates; still owed $700.00 is the two held but not yet captured; charged $250.00 is the one captured, of which $37.50 was fee and $212.50 went to Lucia Marchetti. Gross with an explicit fee line, never a net figure standing alone.</p>
        </div>`;

  return cells + reconcile;
}

/* ================================================================== */
/* 9. Cover art — all 8 palettes x all 4 patterns, from the real port  */
/* ================================================================== */

function coverArtSection(baked) {
  const patterns = baked.patterns;
  const palettes = baked.palettes;

  const headers = palettes
    .map(
      (p) => `
              <div style="width: 118px; display: flex; flex-direction: column; gap: 3px;">
                <span style="font-size: 13px; line-height: 1.2; letter-spacing: 0.01em; font-weight: 600; color: #f7f8fa;">${p.index}&nbsp; ${p.name}</span>
                <span style="${dataType(13)} color: #9ba1ae;">${p.colors[0]}</span>
                <span style="${dataType(13)} color: #9ba1ae;">${p.colors[1]}</span>
              </div>`,
    )
    .join('');

  const rows = patterns
    .map((pattern) => {
      const cells = palettes
        .map((p) => {
          const cell = baked.paletteGrid.find((c) => c.paletteIndex === p.index && c.pattern === pattern);
          const art = cell.render.html
            .replace('width:126px', 'width:118px')
            .replace('height:96px', 'height:88px');
          return `
                <div style="width: 118px; display: flex; flex-direction: column; gap: 6px;">
                  ${art}
                  <span style="${dataType(13)} color: #9ba1ae;">${cell.id}</span>
                </div>`;
        })
        .join('');
      return `
            <div style="display: flex; align-items: flex-start; gap: 12px; padding: 14px 0; border-top: 1px solid ${RULE_D};">
              <span style="width: 64px; flex: 0 0 64px; padding-top: 30px; font-size: 13px; line-height: 1.2; letter-spacing: 0.01em; font-weight: 600; color: #f7f8fa;">${pattern}</span>
              <div style="display: flex; gap: 12px;">${cells}
              </div>
            </div>`;
    })
    .join('');

  return `
        <div style="display: flex; align-items: flex-end; gap: 12px; padding-bottom: 10px;">
          <span style="width: 64px; flex: 0 0 64px;">&nbsp;</span>
          <div style="display: flex; gap: 12px;">${headers}
          </div>
        </div>
        ${rows}
        <p style="margin: 20px 0 0; font-size: 15px; line-height: 1.6; color: #9ba1ae; max-width: 68ch;">Thirty-two cells, thirty-two different campaign ids, every one drawn by the same generator the iPhone app uses. The niche picks the column, the id picks the row and the decor. This is the only saturated colour in the product, and it always stands for a real campaign.</p>`;
}

/* ================================================================== */
/* 10. The brand mark — the decision on this sheet                     */
/* ================================================================== */

/**
 * Option B, "the slip mark". Drawn, so it has no font dependency and cannot
 * be broken by a font that fails to load or by a webview that substitutes.
 * Geometry lives on a 26-unit box because 26px is the size the nav renders it
 * at, where rx 6 resolves to exactly --cd-radius-2.
 *
 * The glyph is the product: a paper slip with a perforated bottom edge and one
 * ledger rule cut through it. Its corners are sharp inside a rounded tile —
 * the same tension the whole identity runs on (§1: the slip and the wall).
 */
const SLIP_PATH =
  'M7 4.5 H19 V19.2 L17 21.3 L15 19.2 L13 21.3 L11 19.2 L9 21.3 L7 19.2 Z ' +
  'M8.4 10.4 H17.6 V12.9 H8.4 Z';

const markB = (size, { tile = true, ink = '#ffffff', plate = '#ff503d' } = {}) => `
              <svg width="${size}" height="${size}" viewBox="0 0 26 26" role="img" aria-label="CreatorDocks" style="display: block; flex: 0 0 auto;">
                ${tile ? `<rect width="26" height="26" rx="6" fill="${plate}"></rect>` : ''}
                <path d="${SLIP_PATH}" fill="${ink}" fill-rule="evenodd"></path>
              </svg>`;

const markA = (size) => {
  const radius = Math.round((size * 6) / 26 * 100) / 100;
  const glyph = Math.round((size * 15) / 26 * 100) / 100;
  return `
              <span style="flex: 0 0 auto; width: ${size}px; height: ${size}px; border-radius: ${radius}px; background: #ff503d; color: #ffffff; display: flex; align-items: center; justify-content: center; font-family: ${ARCHIVO}; ${axes(100, 800)} font-size: ${glyph}px; line-height: 1;">D</span>`;
};

const MARK_SIZES = [16, 26, 40, 64];

function markSection() {
  const sizeLabel = (s) =>
    `<span style="font-size: 13px; line-height: 1.45; letter-spacing: 0.005em; color: #9ba1ae;">${s}px</span>`;

  const optionA = `
          <section style="width: 528px; box-sizing: border-box; padding: 20px; background: #12141b; border: 1px solid ${RULE_D}; border-radius: 10px; display: flex; flex-direction: column; gap: 18px;">
            <div style="display: flex; flex-direction: column; gap: 6px;">
              <h3 style="margin: 0; font-family: ${ARCHIVO}; ${axes(100, 600)} font-size: 22px; line-height: 1.25; letter-spacing: -0.015em; color: #f7f8fa;">Option A &mdash; the set letter</h3>
              <p style="margin: 0; font-size: 15px; line-height: 1.6; color: #9ba1ae;">A coral tile at --cd-radius-2 with a D set in Archivo, 'wdth' 100, 'wght' 800. It is what the site has today, retokenized and set in the real face instead of Arial.</p>
            </div>
            <div style="display: flex; align-items: flex-end; gap: 24px;">
              ${MARK_SIZES.map((s) => `<div style="display: flex; flex-direction: column; align-items: flex-start; gap: 8px;">${markA(s)}${sizeLabel(s)}</div>`).join('')}
            </div>
            <div style="display: flex; align-items: center; gap: 20px; padding-top: 4px;">
              ${markA(192)}
              <div style="display: flex; flex-direction: column; gap: 10px;">
                <p style="margin: 0; font-size: 13px; line-height: 1.45; color: #9ba1ae;">Costs nothing to build and matches the wordmark exactly, because it is the wordmark's own face.</p>
                <p style="margin: 0; font-size: 13px; line-height: 1.45; color: #9ba1ae;">The risk: it depends on a webfont. Before Archivo loads, and in every context that cannot load it &mdash; the OG image route, an email client, a favicon at 16px &mdash; it falls back to Arial, which is the weakest element in the identity today.</p>
              </div>
            </div>
            <div style="display: flex; align-items: center; gap: 10px; padding-top: 8px; border-top: 1px solid ${RULE_D};">
              <span style="padding-top: 12px;">${markA(26)}</span>
              <span style="padding-top: 12px; font-family: ${ARCHIVO}; ${axes(105, 600)} font-size: 17px; letter-spacing: -0.005em; color: #f7f8fa;">CreatorDocks</span>
            </div>
          </section>`;

  const optionB = `
          <section style="width: 528px; box-sizing: border-box; padding: 20px; background: #12141b; border: 1px solid ${RULE_D}; border-radius: 10px; display: flex; flex-direction: column; gap: 18px;">
            <div style="display: flex; flex-direction: column; gap: 6px;">
              <h3 style="margin: 0; font-family: ${ARCHIVO}; ${axes(100, 600)} font-size: 22px; line-height: 1.25; letter-spacing: -0.015em; color: #f7f8fa;">Option B &mdash; the slip mark</h3>
              <p style="margin: 0; font-size: 15px; line-height: 1.6; color: #9ba1ae;">A drawn mark: a paper slip with a perforated bottom edge and one ledger rule cut through it. Sharp corners inside a rounded tile, which is the tension the whole identity runs on. Two shapes, no font, no gradient.</p>
            </div>
            <div style="display: flex; align-items: flex-end; gap: 24px;">
              ${MARK_SIZES.map((s) => `<div style="display: flex; flex-direction: column; align-items: flex-start; gap: 8px;">${markB(s)}${sizeLabel(s)}</div>`).join('')}
            </div>
            <div style="display: flex; align-items: center; gap: 20px; padding-top: 4px;">
              ${markB(192)}
              <div style="display: flex; flex-direction: column; gap: 10px;">
                <p style="margin: 0; font-size: 13px; line-height: 1.45; color: #9ba1ae;">Renders identically everywhere: the favicon, the OG card, a printed receipt, a sticker on the register. Nothing to load and nothing to fall back to.</p>
                <p style="margin: 0; font-size: 13px; line-height: 1.45; color: #9ba1ae;">At 16px the three perforation teeth soften into one edge and the silhouette carries the mark. It simplifies; it does not break.</p>
                <div style="display: flex; align-items: center; gap: 16px; padding-top: 2px;">
                  ${markB(40, { tile: false, ink: '#ff503d' })}
                  ${markB(40, { tile: false, ink: '#f7f8fa' })}
                  <span style="font-size: 13px; line-height: 1.45; color: #9ba1ae;">Off the tile, in --cd-accent and in --cd-text, for the footer and for anywhere coral would compete with artwork.</span>
                </div>
              </div>
            </div>
            <div style="display: flex; align-items: center; gap: 10px; padding-top: 8px; border-top: 1px solid ${RULE_D};">
              <span style="padding-top: 12px;">${markB(26)}</span>
              <span style="padding-top: 12px; font-family: ${ARCHIVO}; ${axes(105, 600)} font-size: 17px; letter-spacing: -0.005em; color: #f7f8fa;">CreatorDocks</span>
            </div>
          </section>`;

  // The two ends of the range, at true size: the favicon and the App Store tile.
  const endsRow = `
        <div style="margin-top: 24px; display: flex; gap: 24px;">
          <div style="width: 528px; box-sizing: border-box; display: flex; flex-direction: column; gap: 12px;">
            <div style="display: flex; align-items: flex-end; gap: 20px;">
              ${markA(512)}
            </div>
            <span style="font-size: 13px; line-height: 1.45; letter-spacing: 0.005em; color: #9ba1ae;">Option A at 512px &mdash; the App Store and OG size. This is the one context where the webfont is not available at render time, so it is the size at which the fallback to Arial is most visible.</span>
          </div>
          <div style="width: 528px; box-sizing: border-box; display: flex; flex-direction: column; gap: 12px;">
            <div style="display: flex; align-items: flex-end; gap: 20px;">
              ${markB(512)}
            </div>
            <span style="font-size: 13px; line-height: 1.45; letter-spacing: 0.005em; color: #9ba1ae;">Option B at 512px. The same two shapes: no detail was added to fill the space, and none was removed at 16px. A drawn mark is the same mark at every size.</span>
          </div>
        </div>`;

  return `
        <div style="display: flex; gap: 24px;">${optionA}${optionB}
        </div>${endsRow}
        <p style="margin: 20px 0 0; font-size: 15px; line-height: 1.6; color: #9ba1ae; max-width: 68ch;">Both lockups above are at the real nav size: a 26px mark, 10px of gap, and the wordmark in Archivo, 'wdth' 105, 'wght' 600 at 17px. Pick one; the other is deleted rather than kept as a variant.</p>`;
}

/* ================================================================== */
/* 11. Assemble                                                        */
/* ================================================================== */

const APPROVALS = [
  ['The two typefaces and the scale', 'Archivo for display and data, Schibsted Grotesk for everything read. No Inter, no mono, no third family.'],
  ['The radius philosophy', 'Rectangles, not pills. Buttons are 6px. Nothing lands between 18px and 40px.'],
  ['Two new tokens', '--cd-bg-raised, because four surface levels need four fills on dark; --cd-text-faint, because rules and disabled glyphs are not captions.'],
  ['The --cd-text-faint demotion', 'It is rated as a non-text token at 3:1 and no sentence may be set in it. Every caption on the site moves up to --cd-text-secondary. This is a real change to existing pages.'],
  ['Two alpha divergences from mobile', '--cd-accent-soft drops from 0.16 to 0.10 on dark and 0.10 to 0.06 on light, because the web puts accent-coloured text on it and mobile only puts icons.'],
  ['The money microcopy', 'The pair, the fee taken out of the rate, the number on the button, the minus sign that is not red.'],
  ['The brand mark', 'Option A, the set letter, or Option B, the drawn slip.'],
];

function approvalsBlock() {
  const rows = APPROVALS.map(
    ([term, def]) => `
            <div style="display: flex; gap: 20px; padding: 12px 0; border-top: 1px solid ${RULE_D};">
              <dt style="width: 260px; flex: 0 0 260px; font-size: 15px; line-height: 1.6; font-weight: 600; color: #f7f8fa;">${term}</dt>
              <dd style="margin: 0; font-size: 15px; line-height: 1.6; color: #9ba1ae; max-width: 68ch;">${def}</dd>
            </div>`,
  ).join('');
  return `<dl style="margin: 0;">${rows}
          </dl>`;
}

function verdict() {
  const failures = audit.filter((a) => !a.pass);
  const min = audit.reduce((acc, a) => (a.value / a.min < acc.value / acc.min ? a : acc), audit[0]);
  if (failures.length) {
    return `<p style="margin: 0; font-size: 15px; line-height: 1.6; color: #f55b7f; max-width: 68ch;">${failures.length} of ${audit.length} computed pairs fall below their minimum: ${failures.map((f) => f.label).join('; ')}. The token set is not ready to build against.</p>`;
  }
  return `<p style="margin: 0; font-size: 15px; line-height: 1.6; color: #9ba1ae; max-width: 68ch;">All ${audit.length} pairs on this sheet clear their minimum. The tightest is ${min.label}, at <span style="${dataType(15)} color: #f7f8fa;">${fmt(min.value)}</span> against a floor of ${fmt(min.min)}. Nothing here has margin to spare, so no token may be nudged without re-running this sheet.</p>`;
}

function main() {
  const baked = JSON.parse(readFileSync(join(HERE, 'baked-specs.json'), 'utf8'));

  // Order matters: the colour section populates `audit`, which `verdict()` reads.
  const colour = `
        <div style="display: flex; gap: 24px;">${paletteColumn(DARK, 'dark')}${paletteColumn(LIGHT, 'light')}
        </div>`;

  const worstStop = baked.palettes
    .flatMap((p) => p.colors)
    .map((c) => ({ c, r: contrast([255, 255, 255], over(ART_SCRIM.rgb, ART_SCRIM.alpha, hexToRgb(c))) }))
    .reduce((a, b) => (b.r < a.r ? b : a));
  const lighterBelow = baked.palettes.filter((p) => contrast([255, 255, 255], hexToRgb(p.colors[0])) < 4.5).length;
  const darkestWhite = baked.palettes
    .map((p) => contrast([255, 255, 255], hexToRgb(p.colors[1])))
    .reduce((a, b) => Math.min(a, b));

  const scrimNote = `
        <div style="margin-top: 24px; padding: 20px; background: #12141b; border: 1px solid ${RULE_D}; border-radius: 10px; display: flex; flex-direction: column; gap: 10px;">
          <span style="font-size: 17px; line-height: 1.35; font-weight: 600; letter-spacing: -0.005em; color: #f7f8fa;">Why text on artwork always sits on a scrim</span>
          <p style="margin: 0; font-size: 15px; line-height: 1.6; color: #9ba1ae; max-width: 68ch;">${lighterBelow} of the 8 lighter palette stops put white below 4.5:1, so white on artwork is never safe by inspection. --cd-art-scrim <span style="${dataType(15)}">${ART_SCRIM.value}</span> fixes it: over the worst of the 16 stops, <span style="${dataType(15)}">${worstStop.c}</span>, white reads <span style="${dataType(15)} color: #f7f8fa;">${fmt(worstStop.r)}</span>. Initials discs use the darker stop instead, where white is never below <span style="${dataType(15)} color: #f7f8fa;">${fmt(darkestWhite)}</span>. The price pill needs neither, because it is --cd-accent-fill carrying white at 4.51.</p>
        </div>`;

  const page = `<!doctype html>
<html><head><meta charset="utf-8"><script src="./support.js"></script></head>
<body>
<x-dc>
<helmet>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:ital,wdth,wght@0,62..125,100..900;1,62..125,100..900&display=swap">
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Schibsted+Grotesk:ital,wght@0,400..900;1,400..900&display=swap">
  <style>
    body { margin: 0; }
    a {
      color: #ff503d;
      text-decoration: underline;
      text-decoration-thickness: 1px;
      text-decoration-color: transparent;
      text-underline-offset: 3px;
      transition: color 120ms ease, text-decoration-color 120ms ease;
    }
    a:hover { color: #d64131; text-decoration-color: currentColor; }
    :focus-visible { outline: 2px solid #ff503d; outline-offset: 2px; }
    .cd-press:active { transform: scale(0.98); }
    @media (prefers-reduced-motion: reduce) {
      a { transition: none; }
      .cd-press:active { transform: none; }
    }
  </style>
</helmet>
<div style="width: 1200px; min-height: 900px; background: #07080b; color: #f7f8fa; font-family: ${SCHIBSTED};">
  <div style="box-sizing: border-box; width: 1200px; padding: 56px 60px 96px; display: flex; flex-direction: column; gap: 52px;">

    <header style="display: flex; flex-direction: column; gap: 14px;">
      <h1 style="margin: 0; font-family: ${ARCHIVO}; ${axes(112, 650)} font-size: 43px; line-height: 1; letter-spacing: -0.03em; color: #f7f8fa;">Tokens and type</h1>
      <p style="margin: 0; font-size: 19px; line-height: 1.6; letter-spacing: -0.005em; color: #9ba1ae; max-width: 62ch;">The specimen sheet for the CreatorDocks web redesign. Every colour figure below is computed from the WCAG relative-luminance formula against the ground that token is actually used on, not copied from the brief. Every cover-art cell is drawn by the same generator the iPhone app runs.</p>
      ${verdict()}
      <p style="margin: 0; font-size: 13px; line-height: 1.45; letter-spacing: 0.005em; color: #9ba1ae;">Sources: 01-design-brief.md &sect;2&ndash;&sect;5 and &sect;8, mobile/src/constants/theme.ts, mobile/src/lib/cover-art.ts, lib/utils.ts. Generated by tools/build-tokens.mjs from tools/baked-specs.json.</p>
    </header>

    ${section('What this sheet is asking you to approve', 'Seven decisions. Everything else on the canvas assumes these are settled.', approvalsBlock())}

    ${section('Colour', 'Two complete palettes. The four grounds are the four surface levels, and every foreground is measured on all of them, because a token that only works on the canvas is a token that breaks in a modal.', colour + scrimNote)}

    ${section('Type', 'Two families, three voices: Archivo Expanded for headlines, Archivo Condensed with tabular figures for anything that is money or a count, Schibsted Grotesk for everything read. Width and weight are always declared together.', typeSection())}

    ${section('Radius', 'Corners are information. Sharp where a structure is a rule; rounded where it is an object; a full circle only where something is a person or a live state.', radiusSection())}

    ${section('Elevation', 'Four levels, and a level implies its whole recipe. On dark, lightness carries the step and box-shadow appears only at level 3. On light, white caps the lightness so shadow carries it. One mechanism per theme.', `<div style="display: flex; gap: 24px;">${elevationSection()}
      </div>`)}

    ${section('Money', 'The eight rules that govern every figure on the site, each shown with the fixture numbers the other artboards use.', moneySection())}

    ${section('Cover art', 'The whole generator: eight palettes across, four patterns down. Deterministic from the campaign id and niche, identical on web and iPhone, and the only place saturated colour is allowed.', coverArtSection(baked))}

    ${section('The brand mark', 'One decision, two candidates, both shown at the sizes that actually ship. Nothing else on this sheet is undecided.', markSection())}

  </div>
</div>
</x-dc>
</body>
</html>
`;

  const target = join(HERE, '..', 'Tokens.dc.html');
  writeFileSync(target, page, 'utf8');
  const failures = audit.filter((a) => !a.pass);
  console.log(
    `Tokens.dc.html written (${page.length} bytes). ${audit.length} contrast pairs computed, ${failures.length} failing.`,
  );
  if (failures.length) for (const f of failures) console.log('  FAIL', f.label, fmt(f.value), '<', fmt(f.min));
}

main();
