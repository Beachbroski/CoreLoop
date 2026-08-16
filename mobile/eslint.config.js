const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const globals = require('globals');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    // Test files run under Jest in Node, not in the React Native runtime, so
    // they legitimately use jest globals and Node built-ins. eslint-config-expo
    // targets the app runtime and declares neither, which turns every
    // `describe`/`expect`/`__dirname` into a no-undef error. TypeScript tests
    // get these from `types: ["jest"]` in tsconfig; plain-JS tests need them here.
    files: ['**/*.test.{js,jsx,ts,tsx}', 'jest.setup.js', 'jest.resolver.js', 'src/test/**'],
    languageOptions: {
      globals: { ...globals.jest, ...globals.node },
    },
  },
]);
