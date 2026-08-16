/**
 * Stub for CSS imports under Jest.
 *
 * `src/constants/theme.ts` imports `@/global.css` (NativeWind/web styling),
 * which Node cannot parse — the suite dies on `:root {` before a single test
 * runs. Styles have no bearing on what these tests assert, so they resolve to
 * an empty module.
 */
module.exports = {};
