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
plus a "Check again" control, with no fake link. Fill it in with
`https://apps.apple.com/app/id<APP_ID>` once App Store Connect assigns the
numeric app ID.
