/**
 * Composes react-native-worklets' resolver with the one jest-expo already sets.
 *
 * Reanimated 4 moved its worklets runtime into `react-native-worklets`, whose
 * `.native.ts` entry points reach for a real native module and throw
 * "Cannot read properties of undefined (reading 'loadUnpackers')" the moment
 * `react-native-reanimated/mock` is required under Node. Worklets ships a
 * resolver that fixes this by dropping `.native` from the extension list for
 * its own files — but setting `resolver` in jest config *replaces* the
 * preset's React Native resolver rather than adding to it, which breaks
 * platform-specific resolution everywhere else. So this does both: strip
 * `.native` for worklets, then hand off to the preset's resolver.
 */

const path = require('path');

const reactNativeResolver = require(
  path.join(path.dirname(require.resolve('@react-native/jest-preset/package.json')), 'jest/resolver.js'),
);

/** @type {import('jest-resolve').SyncResolver} */
module.exports = (request, options) => {
  const isWorklets =
    options.basedir.includes('react-native-worklets') || request.includes('react-native-worklets');

  if (isWorklets) {
    return reactNativeResolver(request, {
      ...options,
      extensions: options.extensions?.filter(ext => !ext.includes('native')),
    });
  }

  return reactNativeResolver(request, options);
};
