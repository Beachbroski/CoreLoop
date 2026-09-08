import { z } from 'zod';

/**
 * Build-time validation of the two values that decide whether a build can reach
 * anything at all: the API origin and the Clerk publishable key.
 *
 * This exists because of a specific, already-observed failure — `mobile/.env`
 * points at `http://localhost:3000` with a `pk_test_…` key, and nothing stopped
 * that configuration from being archived and handed to a reviewer, where every
 * screen dead-ends. The check runs in `app.config.ts`, so a misconfigured
 * production build fails on the build machine instead of on someone's phone.
 *
 * Kept as its own module rather than inlined into `app.config.ts` so it can be
 * unit-tested: config files are evaluated by Expo's loader, not by jest.
 */

/**
 * The origin a production build must talk to, verbatim.
 *
 * Deliberately exact rather than a pattern. The whole point of the production
 * rule is that there is exactly one right answer, and a near-miss — the apex
 * domain without `www`, a preview deployment URL, a stale Vercel alias — is the
 * kind of thing that looks right in a diff and fails only in review.
 */
export const CANONICAL_PRODUCTION_API_URL = 'https://www.creatordocks.com';

/** Clerk's prefix for a production-instance publishable key. */
export const LIVE_CLERK_KEY_PREFIX = 'pk_live_';

/**
 * What `EAS_BUILD_PROFILE` resolves to off the build machine.
 *
 * EAS sets that variable during `eas build`; `expo start`, `expo run:ios`,
 * `expo prebuild` and `expo config` do not. Local work is therefore always
 * `development`, which is the only profile that tolerates localhost.
 */
export const DEFAULT_BUILD_PROFILE = 'development';

export const BUILD_PROFILES = ['development', 'preview', 'production'] as const;

export type BuildProfile = (typeof BUILD_PROFILES)[number];

export type BuildEnv = {
  readonly profile: BuildProfile;
  readonly apiUrl: string | null;
  readonly clerkPublishableKey: string | null;
  readonly appStoreUrl: string | null;
};

/**
 * Thrown when a profile's requirements are not met. Named so the `app.config.ts`
 * stack trace says what kind of problem this is before anyone reads the message.
 */
export class BuildEnvError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BuildEnvError';
  }
}

type ProfileRules = {
  /** Whether the API URL and Clerk key must be present at all. */
  readonly requiresValues: boolean;
  /** Whether the API origin must be `https:` and reachable off-device. */
  readonly requiresRemoteHttps: boolean;
  /** Whether the API origin must equal {@link CANONICAL_PRODUCTION_API_URL}. */
  readonly requiresCanonicalOrigin: boolean;
  /** Whether the Clerk key must be a `pk_live_…` production key. */
  readonly requiresLiveClerkKey: boolean;
};

/**
 * Per-profile strictness.
 *
 * `preview` stops short of demanding the canonical origin and a live key so a
 * staging environment stays possible later — there is none today, but a preview
 * build is the natural place for one, and a rule that forbids it would have to
 * be edited under pressure. What `preview` does enforce is the thing that
 * actually breaks tester builds: an origin no device other than the developer's
 * own laptop can resolve.
 */
const RULES: Readonly<Record<BuildProfile, ProfileRules>> = Object.freeze({
  development: {
    requiresValues: false,
    requiresRemoteHttps: false,
    requiresCanonicalOrigin: false,
    requiresLiveClerkKey: false,
  },
  preview: {
    requiresValues: true,
    requiresRemoteHttps: true,
    requiresCanonicalOrigin: false,
    requiresLiveClerkKey: false,
  },
  production: {
    requiresValues: true,
    requiresRemoteHttps: true,
    requiresCanonicalOrigin: true,
    requiresLiveClerkKey: true,
  },
});

/** Hosts that only ever resolve on the machine that ran the build. */
const LOOPBACK_HOSTNAMES = Object.freeze(['localhost', '127.0.0.1', '::1', '0.0.0.0']);

// Env vars arrive as `string | undefined` and an empty string is the same
// mistake as an unset one — a blank line in `.env`, or an EAS variable created
// with no value.
const presentValueSchema = z.string().trim().min(1);

// The same rule VersionGate applies before handing the URL to Linking.openURL.
// Enforced here too so a typo fails the build rather than silently degrading
// the blocked-version screen to its no-link fallback months later.
const appStoreUrlSchema = z
  .string()
  .trim()
  .regex(/^(https:\/\/apps\.apple\.com\/|itms-apps:\/\/)/);

function readOptional(raw: string | undefined): string | null {
  const parsed = presentValueSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

function parseProfile(raw: string | undefined): BuildProfile {
  const value = readOptional(raw);
  if (value === null) return DEFAULT_BUILD_PROFILE;

  const match = BUILD_PROFILES.find((profile) => profile === value);
  if (!match) {
    throw new BuildEnvError(
      `EAS_BUILD_PROFILE is "${value}", which eas.json does not define. ` +
        `Expected one of: ${BUILD_PROFILES.join(', ')}.`,
    );
  }
  return match;
}

function parseApiUrl(raw: string | null, profile: BuildProfile, rules: ProfileRules): string | null {
  if (raw === null) {
    if (!rules.requiresValues) return null;
    throw new BuildEnvError(
      `EXPO_PUBLIC_API_URL is not set, and the "${profile}" profile requires it. ` +
        `Set it in eas.json under build.${profile}.env, or as an EAS environment variable.`,
    );
  }

  // Rejected for every profile: api-client joins with `${apiUrl}${path}` and no
  // separator, so a trailing slash produces `//api/v1/...`.
  if (raw.endsWith('/')) {
    throw new BuildEnvError(
      `EXPO_PUBLIC_API_URL ("${raw}") has a trailing slash. ` +
        'Requests are built as `${EXPO_PUBLIC_API_URL}/api/v1/...`, so the slash would be doubled. ' +
        `Use "${raw.replace(/\/+$/, '')}".`,
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new BuildEnvError(`EXPO_PUBLIC_API_URL ("${raw}") is not a valid URL.`);
  }

  if (rules.requiresCanonicalOrigin && raw !== CANONICAL_PRODUCTION_API_URL) {
    throw new BuildEnvError(
      `EXPO_PUBLIC_API_URL is "${raw}", but a "${profile}" build must point at ` +
        `"${CANONICAL_PRODUCTION_API_URL}" exactly. A production build that talks to anything ` +
        'else reaches no real accounts, no real campaigns, and no real payouts.',
    );
  }

  if (rules.requiresRemoteHttps) {
    if (LOOPBACK_HOSTNAMES.includes(parsed.hostname)) {
      throw new BuildEnvError(
        `EXPO_PUBLIC_API_URL is "${raw}", which resolves only on the machine that built it. ` +
          `A "${profile}" build is installed on other people's devices, where every screen would ` +
          'fail to load. Point it at the deployed origin.',
      );
    }
    if (parsed.protocol !== 'https:') {
      throw new BuildEnvError(
        `EXPO_PUBLIC_API_URL is "${raw}", but a "${profile}" build must use https — ` +
          'iOS App Transport Security blocks cleartext requests, and the Clerk session token ' +
          'travels on every one of them.',
      );
    }
  }

  return raw;
}

function parseClerkKey(raw: string | null, profile: BuildProfile, rules: ProfileRules): string | null {
  if (raw === null) {
    if (!rules.requiresValues) return null;
    throw new BuildEnvError(
      `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY is not set, and the "${profile}" profile requires it. ` +
        `Set it in eas.json under build.${profile}.env, or as an EAS environment variable.`,
    );
  }

  if (rules.requiresLiveClerkKey && !raw.startsWith(LIVE_CLERK_KEY_PREFIX)) {
    throw new BuildEnvError(
      `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY does not start with "${LIVE_CLERK_KEY_PREFIX}", so it ` +
        `belongs to a Clerk development instance. A "${profile}" build signed with it cannot ` +
        'authenticate a single production user.',
    );
  }

  return raw;
}

function parseAppStoreUrl(raw: string | null): string | null {
  if (raw === null) return null;

  const parsed = appStoreUrlSchema.safeParse(raw);
  if (!parsed.success) {
    throw new BuildEnvError(
      `EXPO_PUBLIC_APP_STORE_URL is "${raw}", which VersionGate would refuse to open. ` +
        'It must start with "https://apps.apple.com/" or "itms-apps://". ' +
        'Leave it unset until App Store Connect assigns the numeric app id.',
    );
  }
  return parsed.data;
}

/**
 * Reads and validates the build-time environment.
 *
 * Takes the environment as an argument rather than reaching for `process.env`
 * so the rules can be tested without mutating global state.
 *
 * @throws {BuildEnvError} when the profile's requirements are not met.
 */
export function resolveBuildEnv(env: Record<string, string | undefined>): BuildEnv {
  const profile = parseProfile(env.EAS_BUILD_PROFILE);
  const rules = RULES[profile];

  return Object.freeze({
    profile,
    apiUrl: parseApiUrl(readOptional(env.EXPO_PUBLIC_API_URL), profile, rules),
    clerkPublishableKey: parseClerkKey(
      readOptional(env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY),
      profile,
      rules,
    ),
    appStoreUrl: parseAppStoreUrl(readOptional(env.EXPO_PUBLIC_APP_STORE_URL)),
  });
}
