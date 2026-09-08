import type { ConfigContext, ExpoConfig } from 'expo/config';

import { resolveBuildEnv } from './config/build-env.ts';

/**
 * Dynamic layer over `app.json`.
 *
 * `app.json` stays the source of truth for everything static — it is what
 * `eas init` writes `extra.eas.projectId` into, and what `expo prebuild` reads.
 * This file adds the two things JSON cannot do:
 *
 *  1. **Fail the build when the environment is wrong.** `resolveBuildEnv`
 *     throws, and a throw here aborts `eas build` on the build machine. The
 *     alternative — which is what happened before this file existed — is an
 *     archive that points at `http://localhost:3000` and dead-ends on a
 *     reviewer's device.
 *  2. **Carry env-derived values into `expo.extra`,** where the app reads them
 *     through `Constants.expoConfig` at runtime.
 *
 * Note that `EXPO_PUBLIC_*` variables reach the app twice: inlined into the
 * bundle by Metro (how `api-client` and Clerk read them) and, for the App Store
 * URL, through `extra` below (how `VersionGate` reads it). Only the second is
 * this file's business; the first happens whether or not it is mentioned here.
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const env = resolveBuildEnv(process.env);

  return {
    ...config,
    // ConfigContext types name/slug as optional, but app.json always supplies
    // them and the rest of the toolchain requires them.
    name: config.name ?? 'CreatorDocks',
    slug: config.slug ?? 'creatordocks',
    extra: {
      // Spread first so nothing here can clobber `eas.projectId`, which
      // `eas init` writes into app.json and `src/lib/push.ts` reads.
      ...config.extra,
      // Omitted entirely rather than set to null: the manifest serializer
      // turns a null into `{}`, which reads like a value that is present but
      // empty. VersionGate validates whatever it finds and degrades to written
      // instructions when there is nothing usable, so absent is the honest
      // shape until App Store Connect assigns the numeric app id.
      ...(env.appStoreUrl ? { appStoreUrl: env.appStoreUrl } : {}),
      // Recorded so a TestFlight build can be told apart from a store build
      // without guessing from the version string.
      buildProfile: env.profile,
    },
  };
};
