# iOS release checklist

Blockers found in the 2026-08-20 design audit. Kept here rather than in
`app.json` because Expo parses that file as strict JSON (json5 disabled), so it
cannot carry comments — and anything parked in `expo.extra` ships to every
device inside the runtime manifest.

## 1. Bundle identifier — set, still needs registering

`expo.ios.bundleIdentifier` is now `com.creatordocks.app` (was the Expo template
default `com.anonymous.creatordocks`, a domain nobody owns).

Still outstanding — the identifier is only half the job:

1. Register `com.creatordocks.app` as an App ID in the Apple Developer portal
   (Certificates, Identifiers & Profiles → Identifiers), with **Push
   Notifications** capability enabled.
2. `xattr -cr mobile/ios && npx expo prebuild --clean`

It propagates: the generated Info.plist registers it as a second
`CFBundleURLSchemes` entry alongside `creatordocks`, and `NSUserActivityTypes`
is `$(PRODUCT_BUNDLE_IDENTIFIER).expo.index_route`.

`android.package` is the same class of problem — it still resolves to Expo's
default `com.placeholder.appid`. Out of scope for iOS, but it blocks any Android
ship.

## 2. EAS project — push is inert without it

`registerForPushNotifications()` cannot mint an Expo push token until
`expo.extra.eas.projectId` exists, so no device registers and no notification is
ever delivered. Run `eas init` in `mobile/` **after** the real bundle identifier
is in place — EAS provisions APNs credentials against the bundle ID.

## 3. App Store URL — VersionGate degrades without it

`src/components/version-gate.tsx` renders an "Open the App Store" button only
when `expo.extra.appStoreUrl` is set and matches `https://apps.apple.com/` or
`itms-apps://`. Until then the blocked state falls back to written instructions
plus a "Check again" control, with no fake link.

Set it as **`EXPO_PUBLIC_APP_STORE_URL`** once App Store Connect assigns the
numeric app ID — `app.config.ts` validates it and copies it into
`expo.extra.appStoreUrl`, and omits the key entirely while it is unset. A value
that is not an Apple listing URL fails the build rather than shipping a dead
button.

## 4. Build profiles — what `eas.json` needs, and where

`eas.json` is strict JSON and cannot carry comments, so the contract lives here.

`app.config.ts` calls `resolveBuildEnv()` (`config/build-env.ts`, unit-tested in
`config/build-env.test.ts`) on every config evaluation and **throws** when a
profile's requirements are not met, which aborts `eas build` on the build
machine. This is the guard against risk **A5** — an archive pointing at
`http://localhost:3000` with a `pk_test_…` key, which reaches nothing on a
reviewer's device.

| Profile | API URL | Clerk key |
|---|---|---|
| `development`, `development-simulator` | anything, may be absent | anything, may be absent |
| `preview` | required; https, not loopback | required; test or live |
| `production` | required; **exactly** `https://www.creatordocks.com` | required; must start `pk_live_` |

A trailing slash on `EXPO_PUBLIC_API_URL` is rejected on every profile, because
`api-client` joins with `${apiUrl}${path}` and would produce `//api/v1/...`.

**What is already in `eas.json`:** `EXPO_PUBLIC_API_URL` for `preview` and
`production` (a public value, safe to commit).

**What you must add before the first non-development build:**
`EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`. It is not committed because the `pk_live_…`
value is not knowable from this repo. Each profile declares an `environment`, so
create it per environment on EAS:

```bash
eas env:create --environment production --name EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY --value pk_live_… --visibility plaintext
eas env:create --environment preview    --name EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY --value pk_live_… --visibility plaintext
```

`plaintext` is correct — a Clerk *publishable* key is designed to ship inside the
client bundle, and marking it secret would only hide it from `eas env:list`.

**Node is pinned to 24.20.0** in the `base` profile. That is not cosmetic:
`app.config.ts` imports `./config/build-env.ts`, and Expo's config loader
compiles only the entry file and hands the rest to Node's own resolver, so the
import relies on Node's TypeScript type-stripping (unflagged since 22.18).
Dropping the pin below that would fail the build at config load. `.nvmrc` and
the root `engines` field already say 24.

**Verify without an Expo account** — the profiles and the guard can both be
checked offline:

```bash
npx tsc --noEmit && npx jest config/build-env.test.ts
EAS_BUILD_PROFILE=production npx expo config --type public
```

The second command must fail while `mobile/.env` points at localhost. That
failure is the feature.
