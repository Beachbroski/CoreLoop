import {
  CANONICAL_PRODUCTION_API_URL,
  DEFAULT_BUILD_PROFILE,
  resolveBuildEnv,
} from './build-env';

const LIVE_KEY = 'pk_live_Y3JlYXRvcmRvY2tzLmNvbSQ';
const TEST_KEY = 'pk_test_Y3JlYXRvcmRvY2tzLmNvbSQ';

function env(overrides: Record<string, string | undefined>) {
  return overrides;
}

describe('resolveBuildEnv — profile selection', () => {
  it('defaults to development when EAS_BUILD_PROFILE is unset', () => {
    expect(resolveBuildEnv(env({})).profile).toBe(DEFAULT_BUILD_PROFILE);
    expect(DEFAULT_BUILD_PROFILE).toBe('development');
  });

  it('reads the profile EAS sets on the build machine', () => {
    const resolved = resolveBuildEnv(
      env({
        EAS_BUILD_PROFILE: 'production',
        EXPO_PUBLIC_API_URL: CANONICAL_PRODUCTION_API_URL,
        EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: LIVE_KEY,
      }),
    );
    expect(resolved.profile).toBe('production');
  });

  it('rejects a profile name eas.json does not define', () => {
    expect(() => resolveBuildEnv(env({ EAS_BUILD_PROFILE: 'staging' }))).toThrow(/staging/);
  });
});

describe('resolveBuildEnv — development', () => {
  it('allows the localhost + test-key setup a simulator needs', () => {
    const resolved = resolveBuildEnv(
      env({
        EXPO_PUBLIC_API_URL: 'http://localhost:3000',
        EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: TEST_KEY,
      }),
    );
    expect(resolved.apiUrl).toBe('http://localhost:3000');
    expect(resolved.clerkPublishableKey).toBe(TEST_KEY);
  });

  it('tolerates both values being absent so `expo config` works on a fresh clone', () => {
    const resolved = resolveBuildEnv(env({}));
    expect(resolved.apiUrl).toBeNull();
    expect(resolved.clerkPublishableKey).toBeNull();
  });
});

describe('resolveBuildEnv — production', () => {
  function production(overrides: Record<string, string | undefined> = {}) {
    return env({
      EAS_BUILD_PROFILE: 'production',
      EXPO_PUBLIC_API_URL: CANONICAL_PRODUCTION_API_URL,
      EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: LIVE_KEY,
      ...overrides,
    });
  }

  it('accepts the canonical origin and a live Clerk key', () => {
    const resolved = resolveBuildEnv(production());
    expect(resolved.apiUrl).toBe(CANONICAL_PRODUCTION_API_URL);
    expect(resolved.clerkPublishableKey).toBe(LIVE_KEY);
  });

  it('rejects localhost — the A5 failure this whole module exists to stop', () => {
    expect(() => resolveBuildEnv(production({ EXPO_PUBLIC_API_URL: 'http://localhost:3000' }))).toThrow(
      /EXPO_PUBLIC_API_URL/,
    );
  });

  it('names the expected origin when the URL is some other host', () => {
    expect(() =>
      resolveBuildEnv(production({ EXPO_PUBLIC_API_URL: 'https://staging.creatordocks.com' })),
    ).toThrow(new RegExp(CANONICAL_PRODUCTION_API_URL));
  });

  it('rejects a test Clerk key, which cannot authenticate a production user', () => {
    expect(() => resolveBuildEnv(production({ EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: TEST_KEY }))).toThrow(
      /pk_live_/,
    );
  });

  it('rejects a missing API URL rather than building something unreachable', () => {
    expect(() => resolveBuildEnv(production({ EXPO_PUBLIC_API_URL: undefined }))).toThrow(
      /EXPO_PUBLIC_API_URL/,
    );
  });

  it('rejects a missing Clerk key', () => {
    expect(() =>
      resolveBuildEnv(production({ EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: undefined })),
    ).toThrow(/EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY/);
  });
});

describe('resolveBuildEnv — preview', () => {
  function preview(overrides: Record<string, string | undefined> = {}) {
    return env({
      EAS_BUILD_PROFILE: 'preview',
      EXPO_PUBLIC_API_URL: CANONICAL_PRODUCTION_API_URL,
      EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: LIVE_KEY,
      ...overrides,
    });
  }

  it('rejects localhost, which no tester device can reach', () => {
    expect(() => resolveBuildEnv(preview({ EXPO_PUBLIC_API_URL: 'http://localhost:3000' }))).toThrow(
      /EXPO_PUBLIC_API_URL/,
    );
  });

  it('rejects a plain-http origin', () => {
    expect(() => resolveBuildEnv(preview({ EXPO_PUBLIC_API_URL: 'http://example.com' }))).toThrow(
      /https/,
    );
  });

  it('allows a test Clerk key so a future staging instance is not locked out', () => {
    expect(resolveBuildEnv(preview({ EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: TEST_KEY }))).toMatchObject({
      profile: 'preview',
      clerkPublishableKey: TEST_KEY,
    });
  });
});

describe('resolveBuildEnv — trailing slash', () => {
  // api-client builds `${apiUrl}${path}` with no separator, so a trailing slash
  // silently produces `//api/v1/...`.
  it('rejects a trailing slash on any profile', () => {
    expect(() => resolveBuildEnv(env({ EXPO_PUBLIC_API_URL: 'http://localhost:3000/' }))).toThrow(
      /trailing/i,
    );
  });
});

describe('resolveBuildEnv — App Store URL', () => {
  it('is null until App Store Connect assigns the id', () => {
    expect(resolveBuildEnv(env({})).appStoreUrl).toBeNull();
  });

  it('passes an apps.apple.com listing through', () => {
    const url = 'https://apps.apple.com/app/id6470000000';
    expect(resolveBuildEnv(env({ EXPO_PUBLIC_APP_STORE_URL: url })).appStoreUrl).toBe(url);
  });

  it('rejects a URL VersionGate would refuse to open, instead of shipping a dead button', () => {
    expect(() =>
      resolveBuildEnv(env({ EXPO_PUBLIC_APP_STORE_URL: 'https://example.com/app' })),
    ).toThrow(/EXPO_PUBLIC_APP_STORE_URL/);
  });
});
