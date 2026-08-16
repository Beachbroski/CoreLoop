const { readdirSync } = require('fs');
const { join } = require('path');

/**
 * Guards against putting a test file under `src/app/`.
 *
 * Everything in that directory is a route. expo-router builds the route tree
 * with `require.context(APP_ROOT, true, /…\.[tj]sx?$/)`, and that regex exempts
 * only `+api`, `+html`, and `+middleware` — there is no test-file exemption and
 * no config option to add one. So a colocated `foo.test.tsx` is bundled as a
 * route, dragging @testing-library/react-native and its Node-only dependencies
 * into the app bundle. The symptom is Metro failing the whole app with
 * "console could not be found within the project", pointing at a file nobody
 * touched. It also corrupts expo-router's generated route types, which fails
 * `tsc` across a dozen unrelated files.
 *
 * Route-component tests belong in `src/test/screens/`, importing the screen
 * through the `@/app/...` alias.
 *
 * Deliberately plain JavaScript: mobile's tsconfig sets `types: ["jest"]` so
 * React Native code cannot reach for Node globals like `Buffer` or `process`
 * and typecheck against a runtime that lacks them. Adding `@types/node` to
 * satisfy this one file would give that up everywhere, and tsconfig only
 * includes `.ts`/`.tsx`, so a `.js` test needs no Node types at all.
 */

const APP_DIR = join(__dirname, '..', 'app');
const TEST_FILE = /\.(test|spec)\.[tj]sx?$/;

function findTestFiles(dir, relative = '') {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const rel = join(relative, entry.name);
    if (entry.isDirectory()) return findTestFiles(join(dir, entry.name), rel);
    return TEST_FILE.test(entry.name) ? [rel] : [];
  });
}

describe('src/app', () => {
  it('contains no test files, which expo-router would bundle as routes', () => {
    expect(findTestFiles(APP_DIR)).toEqual([]);
  });
});
