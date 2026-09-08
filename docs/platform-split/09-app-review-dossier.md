# 09 — App Store review dossier (CreatorDocks iOS)

**What this is.** The submission pack for the CreatorDocks iOS app: the text Jackson pastes into App Store Connect, the answers to every questionnaire, and the reasoning a reviewer would need if they ask. Written **against the code in the working tree on 2026-09-07**, not against the plan docs — where `docs/platform-split/*.md` disagrees with the code, the code is what is written here and the disagreement is flagged.

**Fact-checked 2026-09-07.** Every claim in this document was re-verified against the repo and against production. Fourteen were wrong or overstated and are corrected in place; fifteen material gaps were added, including **Guideline 2.2**, which the previous draft never mentioned. The full before/after ledger is at the end of §9 — read it if you are working from a printout of the earlier version.

**Apple policy caveat.** Guideline *numbers* below are cited from memory and are not re-read from Apple's site in this document. Before submitting, confirm 4.8, 5.1.1(v), 3.1.5(a) and 1.2 still say what is claimed here against the current [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/). Every `PrivacyInfo.xcprivacy` string constant in §5 is likewise unconfirmed against Apple's key list.

---

## 🚫 Status: NOT SUBMITTABLE TODAY

The app **cannot currently be built or submitted.** Eight things must be true first, roughly in this order:

| # | Must be true | Today | Evidence |
|---|---|---|---|
| 1 | `/api/v1` is deployed to production | **CONFIRMED NOT DEPLOYED.** `curl https://www.creatordocks.com/api/v1/meta` → **404**, and the body is the marketing site's HTML 404 page, while `https://www.creatordocks.com/privacy` and `/support` both return **200**. Every screen in this document is unreachable. Worse than a clean failure: `VersionGate` **fails open** on a meta error, so today's build lets a reviewer sign in through Clerk and then dead-ends on "Couldn't open your account." with a Retry that can never succeed | `curl`, 2026-09-07; `mobile/src/components/version-gate.tsx:125-153`; `mobile/src/app/(app)/_layout.tsx:116-122` |
| 2 | An Apple App ID `com.creatordocks.app` is registered with Push Notifications enabled | **Not registered.** The stale Xcode project still carries `com.anonymous.creatordocks` | `mobile/app.json:11`; `mobile/ios/CreatorDocks.xcodeproj/project.pbxproj:391,423`; `mobile/RELEASE-CHECKLIST.md:8-22` |
| 3 | An EAS project exists (`expo.extra.eas.projectId`) | **Absent.** `mobile/app.json` has no `extra` key at all. No EAS project ⇒ no build, and push notifications are inert: `registerForPushNotifications` returns `unconfigured` and no device ever registers | `mobile/app.json` (whole file, 1-63); `mobile/src/lib/push.ts:75-88` |
| 4 | Sign in with Apple is offered | **Absent.** Only `oauth_google` and `oauth_tiktok` are registered. Guideline 4.8 exposure | `mobile/src/components/oauth-buttons.tsx:18-21` |
| 5 | A reviewer can create/use an account in production | **Closed.** Production env has no `TESTER_ALLOWED_EMAILS` and `MARKETPLACE_ACCESS` defaults to `invite`; the allowlist union currently contains **exactly one address** (the owner's), so every other email lands on the waitlist wall | `lib/admin-config.ts:52-58,69-79`; `mobile/src/app/(app)/_layout.tsx:115` |
| 6 | The app and its own web pages stop describing themselves as an internal test | **They do not.** Four strings a reviewer actually reaches say "invite-only", "testing accounts", "internal testing", "tester access issues", "internal creator marketplace", "while CreatorDocks is in waitlist mode". That is a Guideline **2.2** (beta software belongs on TestFlight) rejection written by the app about itself — see risk **A7** | `mobile/src/app/(app)/_layout.tsx:52`; `app/support/page.tsx:5-8,14`; `app/privacy/page.tsx:7,41`; `app/api/v1/uploads/route.ts:24-25` surfaced verbatim by `mobile/src/components/content-upload-field.tsx:47` |
| 7 | An account a reviewer creates for themselves can be deleted from inside the app | **It cannot.** A non-allowlisted account reaches `WaitlistGate`, whose only control is **Sign out**; there is no tab bar, so no Profile, so no Delete account. Even if the control existed, `DELETE /api/v1/me` is wrapped in `withMobileApi`, which **401s** when `getCurrentAppUser()` finds no `User` row. A verified Clerk identity is therefore permanently undeletable in-app — a straight **5.1.1(v)** finding. See risk **A8** | `mobile/src/app/(app)/_layout.tsx:41-73,115`; `lib/mobile-api-guard.ts:163-164`; `lib/current-app-user.ts:20,27`; `app/api/v1/onboarding/route.ts:69-71` |
| 8 | The Terms and the support page say what the App Review Notes claim they say | **They do not.** The Notes' abuse-reporting sentence is disprovable by tapping the link it names — see risk **B5** and §1a | `app/support/page.tsx:12-15,29-35`; `app/terms/page.tsx:24-33` |

Two more that will bite before an archive is possible:

- **The working tree is uncommitted.** The whole account-deletion implementation is untracked/modified — `app/api/_lib/` is `??`, `app/api/v1/me/route.ts`, `app/api/webhooks/clerk/route.ts` and `mobile/src/app/(app)/profile/index.tsx` are `M` (`git status --porcelain`, 2026-09-07). Nothing described in §4 exists in production.
- **`mobile/.env` points the build at `http://localhost:3000` with a `pk_test_…` Clerk key.** A build made from it reaches nothing on a reviewer's device.

Full ordered task list: **§9**.

---

## 1. Copy-paste blocks

### 1a. App Review Notes

Paste into **App Store Connect → App Review Information → Notes**. Every `[bracketed]` line is conditional — delete it or make it true before pasting (see the checklist under the block).

```
CreatorDocks is the creator side of a two-sided local marketplace. Local businesses
(cafes, gyms, salons, boutiques, home services) post paid content campaigns on our
WEBSITE. Creators use this iOS app to browse those campaigns, apply with the fee they
want to be paid, upload the content they produced, and follow their payouts.

NO PURCHASES, NO IAP. Creators are never charged anything in this app. There is nothing
to buy, unlock, subscribe to, or upgrade. There is no payment form, no card entry, and
no StoreKit. EVERY DOLLAR FIGURE IN THIS APP IS MONEY FLOWING TO THE CREATOR:
 - The "$" pill on a campaign tile and the "Budget" chip on the campaign detail screen
   are the brand's advertised campaign budget -- money offered to creators.
 - The "$" field on the Apply screen is where the creator TYPES THE FEE THEY WANT TO BE
   PAID. It looks like a payment field; it is not. Nothing is charged.
 - The Earnings tab shows the creator's payout history and their lifetime total paid.
   Each row is the agreed fee for one approved piece of work, with a status label
   (Pending / Processing / Paid / Failed), so some rows are money still on its way.
The businesses that hire creators pay by card on our website, never in this app. The
underlying transaction is a real-world marketing service -- a creator physically visiting
a local business and producing photo/video content for it -- so it falls outside In-App
Purchase under Guideline 3.1.5(a).

"CONNECT PAYOUT ACCOUNT" (Earnings tab) opens Stripe's own secure onboarding page in an
in-app Safari view. It is not a purchase: it is how a creator gives Stripe their bank
details so Stripe can DEPOSIT their earnings. The demo account below already has this
connected, so you do not need to complete it. If you do open it, close the browser and
pull down on the Earnings tab to refresh.

THIS IS NOT A BETA, DEMO OR TRIAL BUILD. Every feature in the app is finished and
live; nothing is time-limited, feature-limited or marked "coming soon." What is limited
is the ROSTER: we admit brands and creators to the marketplace by approval while we grow
city by city, the way an invite-only marketplace launch works. The build itself is our
1.0 production build.

ACCESS. Because the roster is approval-based, please sign in with the demo account in
the Sign-In Information fields. If you create your own account instead, you will reach a
"You're on the list" screen with only a Sign out control -- that is the approval queue,
not a defect. [SECOND ACCOUNT: <REVIEWER_EMAIL_2> / <REVIEWER_PASSWORD_2> is a second
approved account provided specifically so you can test account deletion without
destroying the primary demo account. Please run the deletion test on that one.]

SIGN-IN OPTIONS. [Sign in with Apple], email + password, and Google are all live.
[TikTok has been removed for 1.0.]

WHAT TO TRY
 1. Discover -- browse open campaigns; tap one to read the brief.
 2. Apply -- submit a pitch (20 characters minimum) and your proposed rate.
 3. Activity -- applications in Pending / Accepted / Rejected states, and submissions.
    Opening one of your own submissions shows the content you uploaded; tapping it
    opens that file in Safari, because it is your own photo or video.
 4. Earnings -- lifetime total paid and payout history with status labels.
 5. Profile -- Privacy Policy, Terms of Use, Support, and Delete Account.

ACCOUNT DELETION (5.1.1(v)) is in the app: on an approved account, Profile tab ->
Delete account, behind two confirmations, four taps from launch. It takes effect
immediately -- we delete the
sign-in identity (revoking every active session), delete all stored push tokens, and
clear the profile: name, photo, bio, email address and payment-provider identifier are
replaced with non-identifying placeholders. The account cannot be recovered or signed
into again -- so please use the SECOND account above for this test, otherwise the
credentials in the Sign-In Information field stop working for the rest of the review. We
retain campaign-application, content-submission and payout records with no identifying
information attached, because they are the financial record of money paid to a creator
and we must keep transaction records; this is disclosed in the confirmation dialog and in
our privacy policy. [If a payout is still in transit to the creator's bank, the app asks
them to wait until it lands so their money is not stranded -- this is the only case in
which deletion is deferred. Neither review account has an in-transit payout.]

USER CONTENT. Brands write campaign briefs; creators upload media for the brand that
hired them. There is no public feed, no public profiles, and no creator-to-creator
messaging -- the route tree is Discover / Activity / Earnings / Profile only. Every brand
and creator on the platform is admitted by us individually. [Objectionable content or
abusive behaviour can be reported from the campaign detail screen ("Report this
campaign") and to support@creatordocks.com; our Terms of Use prohibit objectionable
content and let us remove content and terminate accounts.]

iPhone only, portrait only. No Android app exists; please do not expect one.
```

**Before pasting, resolve every bracketed line.** Each one is a claim a reviewer can check in under a minute. The previous draft of these Notes shipped two such claims *unbracketed* — "the Earnings tab shows payouts the creator has already received" and the abuse-reporting sentence — and a reviewer disproves both without leaving the flow you handed them (§9's correction ledger). Bracketing is the fix: nothing goes into App Store Connect until it is true.

| Bracketed line | Delete it unless… | Why |
|---|---|---|
| SECOND ACCOUNT | a second allowlisted Clerk identity is seeded (§5b) | Reviewers verify 5.1.1(v) **by performing the deletion**. On the primary demo account that burns the only credentials in the submission: the Clerk identity is deleted, the email becomes `deleted-<id>@deleted.creatordocks.invalid`, and a re-signup creates a **fresh** row with `stripeOnboarded = false` — Earnings collapses to "Connect payout account" and Apply 403s. That is risk **A4** reproduced on a second reviewer's screen |
| SIGN-IN OPTIONS | the sentence matches `oauth-buttons.tsx:18-21` at archive time | A reviewer *will* tap every provider on that screen — 4.8 is what they are checking there. If TikTok's redirect is misconfigured they get "Unable to continue. Please try again." (`oauth-buttons.tsx:103`) with no diagnostic (risk **C4**) |
| in-transit payout | you deliberately seeded a `PENDING`/`PROCESSING` payout (§5b says do not) | §3c: it makes `DELETE /api/v1/me` return 409 |
| Report this campaign / Terms objectionable-content clause | **the report control is built and the Terms are amended** (§8, risk **B5**) | As shipped today the support page never mentions abuse, objectionable content, harassment or reporting a user (`app/support/page.tsx:12-15,29-35`), and the Terms' "Prohibited conduct" covers fraud, impersonation, unlawful campaigns, infringement, spam and payment abuse with **no objectionable-content clause and no zero-tolerance statement** (`app/terms/page.tsx:24-33`; grep for "objectionable", "offensive", "harass", "report", "block" returns nothing in either file). Writing an abuse-reporting claim into the Notes that the reviewer disproves by tapping the link you gave them converts a 1.2 argument into a credibility problem — **worse than omitting it.** If you ship without the report control, replace the bracketed sentence with the single true sentence "Abuse can be reported to support@creatordocks.com." and nothing more |

> Also delete any claim that is not yet true elsewhere. If push notifications are still inert (§8 step 3), the Notes above are fine — they do not mention push — but the App Store **description** must also not mention it (§7 B2).
>
> **The 2.2 paragraph is not enough on its own.** The Notes assert "not a beta"; four strings *inside the product* assert the opposite, and the reviewer reaches all four (risk **A7**). Fix the strings, then paste the paragraph.

### 1b. Demo credentials

Paste into **App Store Connect → App Review Information → Sign-In Information**. Replace every `<PLACEHOLDER>`.

```
Sign-in required: YES

Username: <REVIEWER_EMAIL>        (e.g. appreview@creatordocks.com)
Password: <REVIEWER_PASSWORD>

Second account, for the account-deletion test (named in the Review Notes):
Username: <REVIEWER_EMAIL_2>      (e.g. appreview-delete@creatordocks.com)
Password: <REVIEWER_PASSWORD_2>

Contact first name: Jackson
Contact last name:  Steele
Phone:  <PHONE_YOU_WILL_ACTUALLY_ANSWER>
Email:  <SUPPORT_EMAIL>
```

Requirements on **each** account, all of them (details and evidence in §5): email + password (**not** SSO — you cannot hand Apple your Google/TikTok credentials), Clerk email **verified**, **no 2FA and no email-code step on sign-in** (reviewers cannot receive your mail), no pending Clerk session tasks, created in the **same Clerk instance the submitted binary points at**, email present in production `TESTER_ALLOWED_EMAILS`, `role = CREATOR`, `stripeOnboarded = true`, and seeded data.

**Two accounts, not one — and the reason is structural.** The deletion test is destructive (§3b) and reviewers perform it rather than take your word for it. Seed a disposable second account, name it in the Notes as the deletion-test account, and keep the primary demo account off that path (risk **A4**).

> ⚠️ **There is no password recovery anywhere in the app.** `grep -rin "forgot\|resetPassword\|reset_password" mobile/src` returns **nothing**; the sign-in screen offers email + password, Google and TikTok and no "Forgot password?" link (`mobile/src/app/(auth)/sign-in.tsx:88,98-126`). The entire submission therefore rests on passwords typed correctly into an ASC field, in the right Clerk instance, that have not expired. If either is wrong the reviewer's in-app recovery is **none** and the 2.1 rejection writes itself. Before submitting, sign in with both credential pairs on a real device **from the archive being submitted** — not from a dev build (risk **B8**).

### 1c. Export compliance

**Question:** *"Does your app use encryption?"* → **Yes.**
**Follow-up:** *"Does your app qualify for any of the exemptions provided in Category 5, Part 2 of the U.S. Export Administration Regulations?"* → **Yes** (standard/exempt uses only).

Already declared in the binary — App Store Connect should not re-ask per build:

```json
"ios": { "config": { "usesNonExemptEncryption": false } }
```
`mobile/app.json:12-14` → writes `ITSAppUsesNonExemptEncryption = false` into the built Info.plist.

Why the exemption holds: the app's only cryptography is (a) HTTPS/TLS to `EXPO_PUBLIC_API_URL` (`mobile/src/lib/api-client.ts:168-171`), and (b) iOS Keychain storage of the Clerk session token via `expo-secure-store` (`mobile/src/lib/token-cache.ts:1-29`). No custom or proprietary cryptography ships. **UNVERIFIED as a legal matter** — this is an engineering read of the code, not export-control advice.

**Do not describe ATS as "left at Apple's default-strict setting."** The plist block is:

```xml
<key>NSAppTransportSecurity</key>
<dict>
	<key>NSAllowsArbitraryLoads</key>
	<false/>
	<key>NSAllowsLocalNetworking</key>
	<true/>
</dict>
```

`mobile/ios/CreatorDocks/Info.plist:41-47`. `NSAllowsArbitraryLoads` is indeed `false`, but `NSAllowsLocalNetworking = true` is **not** Apple's default (the default is `false`) — it is the Expo template's relaxation, and because `expo prebuild --clean` re-emits it, it will be in the shipped binary too. The accurate sentence is: *"arbitrary loads are disabled; the only ATS relaxation is the Expo template's `NSAllowsLocalNetworking`, which permits local-network HTTP the shipped app never uses."* Citing lines that disprove your own adjective is the kind of detail that unravels under questioning.

Separately: **`mobile/app.json:12-14` says nothing about ATS or HTTPS.** It is the `usesNonExemptEncryption` block quoted above and nothing else (`mobile/app.json:10-15` is `bundleIdentifier` + `config.usesNonExemptEncryption`). And "every request is HTTPS" is true only of a correctly reconfigured production build — the currently configured base URL is cleartext `http://localhost:3000` (`mobile/.env`), which is blocker **A5**.

---

## 2. Money flow, and why there is no IAP

**One line: a brand's card is charged on the web; a creator's bank account is credited via Stripe Connect; the platform keeps 15%; the iOS app never touches a payment form.**

### 2a. The walkthrough

| Step | What happens | Where | Evidence |
|---|---|---|---|
| 1 | Brand creates a campaign with a `budget` (min 500 cents). `role !== 'BRAND'` rejected | **Web only** | `app/api/campaigns/route.ts:17,68,106` |
| 2 | Creator applies **from the app**, typing their own fee → `Application.proposedRate` (cents) | **App** | `mobile/src/app/(app)/discover/[id]/apply.tsx:33-44,93-101`; `prisma/schema.prisma:117` |
| 3 | Brand clicks Accept → `POST /api/stripe/create-intent`. Origin-checked **first**, then Clerk-authenticated, then hard-gated to `role === 'BRAND'`; refuses unless the creator has `stripeAccountId` **and** `stripeOnboarded` | **Web only** | `app/api/stripe/create-intent/route.ts:16-18` (origin), `:23` (`auth()`), `:28-30` (BRAND), `:66-68`; `lib/request-security.ts:32-54` |
| 4 | PaymentIntent created — the whole fee mechanism: `amount = proposedRate`, `usd`, `capture_method: 'manual'`, `application_fee_amount` = 15%, `transfer_data.destination` = creator's Express account | Server | `app/api/stripe/create-intent/route.ts:102-116`; 15% at `lib/utils.ts:8-14` |
| 5 | Brand enters card details into **Stripe's own PaymentElement, in a web browser**, and confirms. Manual capture ⇒ this only *authorizes*. UI says "You'll only be charged when you approve their content." | **Web only** | `app/(dashboard)/brand/campaigns/[id]/ApplicationActions.tsx:39-43,63,153-157` |
| 6 | Accept recorded. Server re-validates the intent against the application byte-for-byte (metadata id, exact amount, currency, `capture_method`, exact `application_fee_amount`, destination, `status === 'requires_capture'`) and enforces the campaign budget cap | Server | `app/api/applications/[id]/route.ts:83-92,113-120`; `lib/stripe-payments.ts:23-45`. Reject instead → authorization cancelled, `paymentIntentId` cleared (`:95-101,127`) |
| 7 | Creator does the **real-world marketing work** and uploads the result **from the app** → `POST /api/v1/submissions` | **App** | `mobile/src/lib/queries/use-create-submission.ts:14` |
| 8 | Brand clicks "Approve & Pay" → `releasePayout()` re-validates, then **captures** with an idempotency key. This is the moment the card is debited and Stripe splits the funds | **Web only** | `app/api/submissions/[id]/route.ts:80-89`; `lib/payout.ts:39-59` |
| 9 | `Payout` row written in one transaction: `amount` = gross `proposedRate`, `platformFee` = Stripe's `application_fee_amount` | Server | `lib/payout.ts:61-107`; `prisma/schema.prisma:164-178` |
| 10 | Creator reads history **in the app** — `GET /api/v1/payouts`, `role: 'CREATOR'`, scoped to `creatorId`, plus server-aggregated `meta.lifetimePaidAmount` over `PAID` rows | **App** | `app/api/v1/payouts/route.ts:40-41,53,74,80`; `mobile/src/app/(app)/earnings/index.tsx:72-74,132-136` |

This is a Stripe **destination charge**: one charge on the brand's card, `transfer_data.destination` names the creator's Express account, Stripe credits that account the charge minus `application_fee_amount` and pays the fee to the platform. `capture_method: 'manual'` makes accept an authorization-only hold and approve the capture — escrow-like for both sides.

**Exhaustive grep of every money-moving Stripe call** (excluding tests): account + account-link creation for creators (`app/api/v1/stripe/onboard/route.ts:21,34`; `app/api/stripe/onboard/route.ts:45,59`), `paymentIntents.create` (`app/api/stripe/create-intent/route.ts:102` — BRAND-only), `.update`/`.capture` (`lib/payout.ts:45,55`), `.retrieve`/`.cancel` (`lib/stripe-payments.ts:6,61`). **No `checkout.sessions`, no `subscriptions`, no `transfers.create` anywhere.**

### 2b. Why 3.1.5(a) and not 3.1.1

**3.1.1 does not apply.** 3.1.1 requires IAP for unlocking features sold *to the app's user*. The app's only user type is a creator — `POST /api/v1/onboarding` hard-codes `role: 'CREATOR'` for any account created from the app (`app/api/v1/onboarding/route.ts:79`, comment at `:35-37`). Nothing is sold to that user: the schema has `Campaign`, `Application`, `Submission`, `Payout` and no purchase entity (`prisma/schema.prisma:75-184`), and `mobile/package.json:5-39` declares no StoreKit, IAP or RevenueCat dependency.

**3.1.5(a) — Goods and Services Outside of the App — is the correct citation.** The underlying transaction is a business buying a real-world marketing service, which 3.1.5(a) expressly places outside IAP. Two structural facts make it unarguable:

- **The purchaser is not the app's user and never opens the app.** Two independent gates keep the money-moving routes out of the app's reach, and it is worth stating them precisely because the obvious-sounding version is wrong:
  - **A trusted `Origin`/`Referer`.** `isTrustedOrigin()` runs before anything else on both routes (`app/api/stripe/create-intent/route.ts:16-18`; `app/api/stripe/release-payout/route.ts:14`) and **returns `false` in production when there is neither an `Origin` nor a `Referer` header** (`lib/request-security.ts:52-54`). An Expo `fetch` sends neither, so the app is refused at the door.
  - **`role === 'BRAND'`.** `app/api/stripe/create-intent/route.ts:28-30`; `app/api/stripe/release-payout/route.ts:29-31`. `POST /api/v1/onboarding` hard-codes `role: 'CREATOR'` (`app/api/v1/onboarding/route.ts:79`), so **no account created from the app can ever satisfy it.**

  > **Do not say these routes "require a cookie session."** They don't. Both call Clerk's `auth()` (`create-intent:23`, `release-payout:21`), which resolves a session from an `Authorization: Bearer` header just as happily as from a cookie. The conclusion (unreachable from the app) is right; the mechanism is the origin check plus the BRAND role, and that version is both true and verifiable in four line references.
- **There is no brand UI in the app.** Tabs are Discover / Activity / Earnings / Profile (`mobile/src/app/(app)/_layout.tsx:144,160,176,191`). The app calls `/api/v1/{applications, campaigns, devices, me, meta, onboarding, payouts, stripe/onboard, stripe/status, submissions, uploads}` — no payment endpoint among them. Payouts and both Stripe routes are additionally `role: 'CREATOR'`-gated (`app/api/v1/payouts/route.ts:41`; `stripe/onboard/route.ts:8`; `stripe/status/route.ts:6`).

**Do not claim a 3.1.3 exemption** (reader / multiplatform / person-to-person). Nothing is being sold in the app at all; citing 3.1.3 invites the reviewer to look for the sale it presupposes.

**The 15%** is a commission on that real-world service transaction, deducted from the brand's payment before it reaches the creator (`app/api/stripe/create-intent/route.ts:106`). It is never a charge to the app's user.

**Stripe Connect onboarding in an in-app browser is not a steering or wrapper problem.** `POST /api/v1/stripe/onboard` returns a Stripe-hosted Account Link (`app/api/v1/stripe/onboard/route.ts:34-41`), opened with `WebBrowser.openBrowserAsync` — `SFSafariViewController`, not a bare `WKWebView` (`mobile/src/app/(app)/earnings/index.tsx:96`). 3.1.1's anti-steering language concerns links to *purchase* content; this link opens a form so Stripe can **send** the user money. 2.5.2 / 4.2 are not in play: the app is native Expo/React Native and it lands on Stripe's own page rather than a re-skin of the web app.

**The complete outbound-URL inventory — five opens, two mechanisms.** If a reviewer asks "what URLs can this app open", this is the answer, and it is not "the legal pages and Stripe":

| Opened | How | Where | Destination |
|---|---|---|---|
| Privacy policy, Terms of use, Support (3 fixed URLs) | `WebBrowser.openBrowserAsync` — in-app `SFSafariViewController` | `mobile/src/app/(app)/profile/index.tsx:66` ← `mobile/src/constants/links.ts:10-14` | fixed constants |
| Stripe Account Link | `WebBrowser.openBrowserAsync` — in-app `SFSafariViewController` | `mobile/src/app/(app)/earnings/index.tsx:96` | server-issued, Stripe-hosted |
| **The creator's own uploaded media** | **`Linking.openURL` — leaves CreatorDocks entirely for Safari (or whatever app claims the URL)** | `mobile/src/app/(app)/activity/submissions/[id].tsx:101` | the `contentUrl` on the creator's own submission |
| **The App Store listing** | **`Linking.openURL` — leaves CreatorDocks** | `mobile/src/components/version-gate.tsx:120` | regex-validated Apple URL (`version-gate.tsx:20-23`); inert today, `expo.extra.appStoreUrl` is unset |

Repo-wide, `openBrowserAsync` appears at exactly two call sites (`profile/index.tsx:66`, `earnings/index.tsx:96`) and `Linking.openURL` at exactly two (`submissions/[id].tsx:101`, `version-gate.tsx:120`). **The submission detail screen is not an in-app browser surface at all** — it ejects the reviewer out of the app. Nothing that matters for 3.1.1, 4.2 or 2.5.2 turns on this, but the answer has to be right when it is asked (see §6c and risk **C9**).

### 2c. Every place a reviewer sees a dollar figure — and what they might misread

Exhaustive (grep of `formatCents|formatCentsCompact|AnimatedMoney|proposedRate` across `mobile/src`).

| Where | Renders | Misread risk | Evidence |
|---|---|---|---|
| **Discover tile — coral pill on the cover art** | `formatCentsCompact(campaign.budget)` | Looks like a price tag. It is the brand's advertised **campaign budget** — money offered to creators. VoiceOver announces "`$X` payout" | `mobile/src/components/campaign-tile.tsx:63,127,183-186` |
| **Campaign detail — "Budget" stat chip** | same field, labelled "Budget" | Low — the label helps | `mobile/src/app/(app)/discover/[id]/index.tsx:107` |
| **Apply screen — `$` prefix + "Your rate (USD)" input, above a Submit button** | creator types their own fee | **Highest risk.** Superficially resembles a payment form. It is the creator *quoting their fee*; stored as `Application.proposedRate`; nothing is charged | `mobile/src/app/(app)/discover/[id]/apply.tsx:33-44,93-101,110` |
| Activity row subtitle / Application detail | `formatCents(proposedRate)` | Low | `activity/index.tsx:109`; `activity/applications/[id].tsx:68` |
| **Earnings hero — "Lifetime paid out"** | `meta.lifetimePaidAmount` over `PAID` rows | None — receive-side | `mobile/src/app/(app)/earnings/index.tsx:132-136,181-184` |
| Earnings row / empty state / connect prompt | `formatCents(payout.amount)`; "Approved submissions turn into payouts right here"; "Connect a payout account to start earning" | None — receive-side language throughout | `mobile/src/app/(app)/earnings/index.tsx:72-79,109-112,188-194` |
| Push notification | "You got paid 💸 — `$X` is on its way to your account." (net of fee) | None | `lib/push.ts:124-129` |

**Confirmed: no figure anywhere in the app is money the app's user would pay.** Grep of `purchase|buy|subscribe|subscription|upgrade|checkout|storekit|iap` over `mobile/src` returns only React Native event-listener plumbing (`use-push-notifications.ts:60,63`; `query-client.ts:55,59,62`; `api-client.ts:88,104`; two test names) — **zero** user-visible strings. (Source-only nit: the tile pill's styles are named `styles.price`/`styles.priceText` at `campaign-tile.tsx:183-186`; a naming artefact, not user-visible.)

### 2d. Two accuracy flags — do not gloss over these

1. **The Earnings screen shows GROSS, not net.** `payout.amount` is the full agreed rate (`lib/payout.ts:61` — `const amount = submission.application.proposedRate`). `platformFee` is sent over the wire (`packages/shared/src/payout.ts:27-32`; `app/api/v1/payouts/route.ts:67` — `:66` is `amount`) but the string `platformFee` appears **nowhere** in `mobile/src`. The push notification and payout email quote the **net** (`app/api/webhooks/stripe/route.ts:110-117`; `lib/push.ts:119-129`). A creator on a $500 rate gets a push saying "$425 is on its way" and an Earnings row reading "$500.00". Not a guideline violation, but a real product bug and a visible inconsistency. **Never write in the Notes that the app shows take-home pay.**
2. **The tile pill is the campaign `budget`, not a per-creator payout.** For a multi-creator campaign the budget is a pool — accept is blocked when the sum of accepted `proposedRate`s would exceed it (`app/api/applications/[id]/route.ts:113-120`). *(Resolution: the shared brief's shorthand "the tile pill is the creator's PAYOUT amount" is imprecise. Verified in code: `campaign-tile.tsx:127` is `formatCentsCompact(campaign.budget)`. It is unambiguously money offered **to** creators, so the IAP position is unaffected — just don't tell the reviewer the pill is "what this creator will be paid".)*

**Dead code, do not describe to a reviewer:** `POST /api/stripe/release-payout` exists and is BRAND-gated, but nothing in the UI calls it. The live payout trigger is the "Approve & Pay" button → `releasePayout()` from `app/api/submissions/[id]/route.ts:89`.

---

## 3. Account deletion (5.1.1(v))

### 3a. The in-app path — four taps, verbatim

**Prerequisite: the account is past the invite gate.** If it is not, the tab bar never renders, there is no Profile tab, and the Delete control is unreachable at any number of taps — and `DELETE /api/v1/me` would 401 even if something could call it (`lib/mobile-api-guard.ts:163-164`). That is not a footnote; it is a 5.1.1(v) finding in its own right, and it is owned by risk **A8**. *(An earlier draft of this document pointed here at **B3**, which is about template permission strings and has nothing to do with the invite gate. No row in the register owned the real risk; A8 now does.)*

1. **Bottom tab bar → "Profile"** (4th tab, `person.circle`) — `mobile/src/app/(app)/_layout.tsx:191-204`
2. Scroll past the first settings group (*App version / Privacy policy / Terms of use / Support*) to the **second** group, whose rows are **"Sign out"** and then **"Delete account"** — the latter rendered destructive, 52pt tap target — `mobile/src/app/(app)/profile/index.tsx:182-189`; `mobile/src/components/settings-row.tsx:25,93`
3. **First confirmation** (`profile/index.tsx:91-93`) — *"Delete your account?"* / "Your name, photo, and login are removed and every signed-in session ends immediately. Campaign, application, submission, and payout records are kept in anonymized form for financial record-keeping — see our privacy policy for details." → **Cancel** / **Continue**
4. **Second confirmation** (`profile/index.tsx:100-102`) — *"Are you absolutely sure?"* / "There's no way to sign back in or recover your profile once this finishes. Anonymized records of your campaign activity are kept, as described in the privacy policy." → **Keep my account** / **Delete forever**

**Delete forever** fires `DELETE /api/v1/me` with the Clerk bearer token (`mobile/src/lib/queries/use-delete-account.ts:15-20`); on success the app clears the query cache and signs out (`profile/index.tsx:111-114`). No hidden menu, no web page, no support email. Re-signing up with the same address does **not** recover the account: row adoption is by email (`lib/current-app-user.ts:22-37`) and the email is now a `.invalid` placeholder.

The **in-app copy is now true statement by statement** (it was not before 2026-09-07; the old copy claimed applications and submissions were deleted, which was never the case). Name/photo → `name: null, avatarUrl: null`; login → Clerk `deleteUser` plus placeholders; sessions end immediately → deleting the Clerk user revokes them; records kept → nothing writes `Application`/`Submission`/`Payout` (`app/api/v1/me/route.test.ts:182-188`).

### 3b. What deletion actually does — the matrix

`DELETE /api/v1/me` runs three steps (`app/api/v1/me/route.ts:98-141`): (a) refuse if a payout is in flight, (b) delete the Clerk identity, (c) **one** Prisma transaction that deletes every `Device` row and overwrites the identifying `User` columns (`app/api/_lib/account-deletion.ts:51-56`). Nothing else in the schema is written.

| Thing | Outcome | Evidence |
|---|---|---|
| `User.name`, `User.avatarUrl`, `User.bio` | **Deleted** (`null`) | `app/api/_lib/account-deletion.ts:32-34` |
| `User.email` | **Anonymized** → `deleted-<id>@deleted.creatordocks.invalid` (RFC 2606-reserved; undeliverable) | `account-deletion.ts:17-18,35` |
| `User.clerkId` | **Anonymized** → `deleted-<id>` (unique + NOT NULL, cannot be nulled) | `account-deletion.ts:21-22,36` |
| `User.stripeAccountId` | **Deleted** (`null`) — removes every path in this codebase back to the Connect account | `account-deletion.ts:24-28,37` |
| `User.stripeOnboarded` | **Reset** to `false` | `account-deletion.ts:38` |
| `User.id`, `role`, `createdAt`, `updatedAt` | **Retained.** Opaque key + non-personal metadata; keeps the financial FKs valid. **The User row itself is not deleted** — it survives as an empty shell | absent from `anonymizedUserFields`, `account-deletion.ts:30-40` |
| **`Device`** — all rows (push token, platform, timestamps) | **Deleted**, in the same transaction | `account-deletion.ts:43-46,53`; `app/api/v1/me/route.test.ts:174-180` |
| **Clerk identity** (login, email, OAuth links, sessions) | **Deleted**, and deleted *first* so every session is revoked immediately | `app/api/v1/me/route.ts:86-97,112-113`; ordering asserted at `route.test.ts:158-166` |
| **`Application`** (pitch, proposedRate, status, paymentIntentId) | **Retained**, pointing at the anonymized User | no write in `account-deletion.ts`; `route.test.ts:186` |
| **`Submission`** (contentUrl, **caption, notes**, reviewNote, status) | **Retained** — note caption/notes are free text the creator wrote, kept verbatim | `route.test.ts:187` |
| **`Payout`** (amount, platformFee, stripeTransferId, status) | **Retained** — `stripeTransferId` is the only remaining route back to the Connect account | `route.test.ts:185`; read-only at `route.ts:103-105` |
| **`Campaign`** | Retained (BRAND-owned; creators do not own campaigns) | `prisma/schema.prisma:22,78` |
| **`WaitlistSubmission`** (name, email, handle, niche, follower range) | **Retained, untouched** — no FK to `User`, so the deletion path never sees it. **Genuine gap** | `prisma/schema.prisma:41-60` |
| **Uploaded media** (UploadThing files behind `Submission.contentUrl`) | **Retained.** No `UTApi`/`deleteFiles` call exists anywhere; deletion is planned but unbuilt (`docs/platform-split/06-notifications-media.md:43`, W6-8) and there is no cron config in the repo. **Whether the retained objects are *publicly* fetchable is UNVERIFIED** — see below | grep for `UTApi\|deleteFiles` over `app`, `lib`, `mobile/src`, `packages` → **0 hits** (retention confirmed) |
| **Stripe Connect account** | **Retained at Stripe** — only our pointer is cleared. Open product decision (Q-P4) | `account-deletion.ts:24-28` |
| **Server logs** | `userId` (cuid) only, never email | `app/api/v1/me/route.ts:117,123,134` |

> **On "publicly fetchable".** A grep proving no deletion call proves the files *survive*; it says nothing about UploadThing's access control on the stored objects. Nothing in this repo configures or asserts an UploadThing file ACL — `packages/shared/src/content-url.ts:21-22` only pins the allowed hosts on write. This document's rule is *evidence or it does not go in*, and this sentence will inform what you tell App Review about what survives deletion, so it is marked **UNVERIFIED** until someone fetches a live `https://<appId>.ufs.sh/f/<key>` URL unauthenticated (incognito, no bearer token) and records the result. Until then, write "retained" and stop there.
>
> **Cheap fix available now:** the deletion SDK is already in the dependency tree — `uploadthing` exports `./server`, which carries `UTApi` (with `deleteFiles`). Wiring `UTApi().deleteFiles(keys)` into `anonymizeAccount` is the next step (risk **D7**) and would let this row, and the media caveat in §3d, be dropped before submission rather than argued.

**Honest framing:** the retained rows are **pseudonymized**, not anonymized in the strict sense — they still point at the same opaque `User.id`, and `Submission.caption`/`notes`/`contentUrl` keep whatever the creator put there. The in-app word "anonymized" describes the **User row**, which has no identifying content left. That is defensible; do not stretch it further.

**A second deletion path exists.** A Clerk `user.deleted` webhook runs the identical anonymization and is idempotent, so it self-heals a crash between the Clerk call and the DB write (`app/api/webhooks/clerk/route.ts:74-95` → `account-deletion.ts:48-50,63-71`). It does **not** run the in-flight-payout check — deleting from the Clerk dashboard bypasses the 409 guard.

### 3c. Edge cases

| Condition | Status | What the server says |
|---|---|---|
| A `Payout` is `PENDING` or `PROCESSING` | **409**, Clerk never called, nothing written | "A payout is still on its way to your bank. You can delete your account once it lands, usually within a few business days." (`app/api/v1/me/route.ts:56,62-63,102-108`; `route.test.ts:213-227`) |
| Clerk `deleteUser` fails (non-404) | **502**, **nothing written** | "We couldn't close your account just now. Nothing was changed -- please try again in a few minutes." (`:64-65,114-121`; `route.test.ts:190-202` asserts no DB write) |
| Clerk returns 404 (identity already gone) | **200** — treated as success, DB half completes | `:75-77,122-124` |
| Clerk succeeded, DB transaction failed | **500** — login gone, scrub outstanding; the webhook retries | "Your sign-in has been removed, but we could not finish clearing your profile. Contact support@creatordocks.com and we will complete it." (`:66-67,127-138`) |
| No `User` row for the caller | **404** `Not found` | `:99-100` |
| >5 delete attempts in 60s | rate-limited | `:98` |

Clerk-first ordering is deliberate and documented at `app/api/v1/me/route.ts:86-97`: DB-first would leave a live login pointing at an anonymized row, which email-based row adoption could then rebind onto another row. All 14 tests in `app/api/v1/me/route.test.ts` pass (`npx vitest run`, 2026-09-07).

**Client-side gap (risk C1):** the app throws the server's message away. `apiFetch` carries it (`mobile/src/lib/api-client.ts:200-202`) but the profile screen replaces it with `onError: () => setDeleteError("Couldn't delete your account. Please try again.")` (`profile/index.tsx:115`). A creator — or reviewer — blocked by the 409 never learns a payout is the reason and could reasonably conclude deletion is broken. **Cheap fix; do it before submitting.**

### 3d. Retention wording, and where the privacy policy falls short

**On deletion and retention specifically, the policy and the code agree** — `app/privacy/page.tsx:27` ("You can request account updates or deletion, subject to any legal, payment, or record-keeping obligations that require some information to be retained") and `:22` (retention "to operate the platform, resolve disputes, meet legal obligations, and maintain transaction records"). Two gaps there, both worth closing:

1. Both confirmation dialogs say "see our privacy policy for details", but the policy contains **no deletion or retention detail** — six short paragraphs, one sentence on deletion. A reviewer who follows Profile → Privacy policy looking for that detail will not find it.
2. The policy says a user can "**request**" deletion; the app performs it instantly and self-serve. Under-claiming, not false — but Apple reads the policy as the authority on what the app does.

#### ⚠️ The policy *does* contradict the App Privacy answers this document tells you to submit

An earlier draft of this section said "**No contradiction**", and rated the policy only Medium ("thin", "gaps rather than conflicts"). That was the one place this dossier under-claimed a risk instead of over-claiming, and it is wrong on two checkable points. Both are in the policy's **first paragraph**, on the page the Notes route the reviewer to (Profile → Privacy policy), and the page is live (`curl https://www.creatordocks.com/privacy` → **200**, 2026-09-07):

| The published policy says | §4b tells you to declare | Verdict |
|---|---|---|
| CreatorDocks collects "… campaign and application content, payout-related information, and **basic usage data**" (`app/privacy/page.tsx:7`) | **Usage Data → Product Interaction / Advertising / Other = No**, resting on "no analytics SDK" | **Direct contradiction.** Either the policy overstates, or the label under-declares. A reviewer reads the policy as the authority |
| Nothing anywhere about push tokens or any device identifier (whole file, `app/privacy/page.tsx:1-51`) | **Identifiers → Device ID = Yes** | **Undisclosed collection.** The label declares an identifier the policy never mentions |

"Privacy answers that do not match the privacy policy" is the exact 5.1.2 / 5.1.1(i) rejection pattern. **This is a High-severity item (risk B9), not a Medium one**, and the fix is web copy, not code: either delete "and basic usage data" and add a sentence naming the push token, or change the label answers — but they must agree at the moment of submission. Both files are one deploy apart.

Two further mismatches in the same paragraph, which belong to the 2.2 problem rather than the label problem: the policy describes "the public creator waitlist and internal marketplace environment" (`:7`) and "the public waitlist and internal creator marketplace workflows" (`:41`), and never mentions an iOS app anywhere. *(A previous draft attributed the phrase "public creator waitlist" to `:41`; it is at `:7`. `:41` carries the second phrasing. Both need rewriting — see risk **A7**.)*

**Do not tell App Review, or any data-protection authority, that deletion removes all personal data.** `WaitlistSubmission` rows and uploaded media survive (§3b).

---

## 4. Privacy nutrition labels

### 4a. What actually leaves the device

Exactly three egress paths; nothing else in `mobile/src` opens a socket.

| Path | Carries | Evidence |
|---|---|---|
| `${EXPO_PUBLIC_API_URL}/api/v1/*` — one `fetch` wrapper, JSON, Clerk Bearer token | everything in §4b except media bytes | request assembled at `mobile/src/lib/api-client.ts:171-178`, which calls `fetchWithTimeout`; **the only literal `fetch(` in the app is `api-client.ts:133`**. Headers are `content-type` + `authorization` only — no device header, no UA override (`:174-176`) |
| Clerk (`clerk.accounts.dev` / Clerk FAPI) | email, password, OAuth grant, verification code | `mobile/src/app/_layout.tsx:44`; `(auth)/sign-up.tsx:39-40`; `(auth)/sign-in.tsx:36`; `components/oauth-buttons.tsx:18-21` |
| UploadThing (`*.ufs.sh`) via our own bearer-authed route | the selected photo/video bytes | `mobile/src/lib/uploadthing.ts:9-11` → `app/api/v1/uploads/route.ts:12-32`; hosts pinned at `packages/shared/src/content-url.ts:21-22` |

**The Expo push token is not being sent today** — `registerForPushNotifications` returns `{status:'unconfigured'}` and never mints a token while `expo.extra.eas.projectId` is absent (`mobile/src/lib/push.ts:75-88`). The moment `eas init` writes that key — which must happen before any build — the token is minted and POSTed (`:104-111`). **Declare Device ID as collected anyway.** Shipping a build whose label omits an identifier the same build then starts sending is the worse failure.

### 4b. The label table

Every "Yes" row is **Linked to the user: Yes** (all of it is stored on a `User` row keyed to the Clerk identity) and **Used for tracking: No**. Purpose for every row is **App Functionality** only.

| Category → Type | Collected | Evidence |
|---|---|---|
| **Contact Info → Email Address** | **Yes** | sign-up `mobile/src/app/(auth)/sign-up.tsx:23,39`; sign-in `:36`; persisted `app/api/v1/onboarding/route.ts:55-57,73-76`; passed to Stripe `app/api/v1/stripe/onboard/route.ts:21-25` |
| **Contact Info → Name** | **Yes** | from the Clerk identity at first launch `app/api/v1/onboarding/route.ts:77`; contract `packages/shared/src/user.ts:8,19` |
| Contact Info → Phone / Address / Other | **No**, on the **same processor-page reasoning as Payment Info** — see §4e.1 | No such field exists in `mobile/src` or any schema in `packages/shared/src`. But Stripe Express onboarding, **launched from inside the app**, collects the creator's phone number, physical address and identity documents on Stripe's own hosted page. We create the Connect account with only the creator's email (`app/api/v1/stripe/onboard/route.ts:21-25`) and the app is told only `{onboarded: boolean}` (`packages/shared/src/stripe-connect.ts:11`). Same caveat as Payment Info, and it applies here too — declaring "No" on the grep alone looks unconsidered rather than reasoned the moment a reviewer presses on Stripe |
| **User Content → Photos or Videos** | **Yes** | picker + upload `mobile/src/components/content-upload-field.tsx:29,54-58`; server accepts `image` ≤16MB ×5 **and `video` ≤256MB ×1** (`app/api/v1/uploads/route.ts:14-15`) — **declare videos**, even though the hook is named `useImageUploader` and the copy says "Pick a photo" |
| **User Content → Other User Content** | **Yes** | application pitch `packages/shared/src/application.ts:6-10` (`apply.tsx:22-23,44`); submission caption/notes `packages/shared/src/submission.ts:7-12` (`submissions/new.tsx:24-25,40-42`); `bio` on the contract `packages/shared/src/user.ts:12,20` |
| User Content → Emails/Messages, Audio, Gameplay, Customer Support | No | support is an out-of-app web link only (`mobile/src/constants/links.ts:13`) |
| **Identifiers → User ID** | **Yes** | Clerk session token on every call `mobile/src/lib/api-client.ts:175`; `packages/shared/src/user.ts:7`; server keys rows by `clerkId` |
| **Identifiers → Device ID** | **Yes** *(declare it)* | `mobile/src/lib/push.ts:104-113` POSTs `{expoPushToken, platform}`; stored against `userId` (`app/api/v1/devices/route.ts:18-30`). **Not an IDFA/IDFV** — an Expo push routing token. Deletion is **best-effort on sign-out, transactionally guaranteed on account deletion**: `unregisterForPushNotifications` returns early unless the module-scope `registeredToken` is set and swallows every failure (warning only under `__DEV__`) (`mobile/src/lib/push.ts:117-133`), whereas account deletion removes every `Device` row inside the same Prisma transaction that scrubs the User row (`app/api/_lib/account-deletion.ts:51-56`). Dormant until `eas init`. **Note the policy never mentions push tokens — see §3d and risk B9** |
| **Financial Info → Other Financial Info** | **Yes** | `proposedRate` typed by the creator (`packages/shared/src/application.ts:9`; `apply.tsx:33,44`); payout amounts + lifetime total returned to the app (`packages/shared/src/payout.ts:28-30`; `earnings/index.tsx:73,133`) |
| Financial Info → **Payment Info** / Credit Info | **No** | no Stripe SDK in the app (`mobile/package.json:5-39`). Bank/identity details are entered on Stripe's own hosted page in `SFSafariViewController`; the app receives back only `{onboarded: boolean}` (`packages/shared/src/stripe-connect.ts:11`), and this codebase never calls `stripe.accounts.retrieve`. **Judgement call — see §4e** |
| Purchases → Purchase History | **No** | no IAP, no StoreKit, no purchase path. *(Resolution: an earlier draft suggested declaring "Purchases"; that is wrong. Purchase History is No; the payout figures belong under Other Financial Info.)* |
| Usage Data → Product Interaction / Advertising / Other | **No** | no analytics SDK in `mobile/package.json:5-39`. Discover's search box filters **client-side only** — the text never leaves the device (`discover/index.tsx:113-124`). The niche chip is a functional query parameter (`use-campaigns.ts:35`), not an analytics event — see §4e. ⚠️ **The published privacy policy says the opposite** ("basic usage data", `app/privacy/page.tsx:7`). Fix the policy or change this answer before submitting — §3d, risk **B9** |
| Diagnostics → Crash / Performance / Other | **No** | no crash reporter or APM: no `sentry`/`bugsnag`/`datadog` in `mobile/package.json`, so **nothing ships any log off-device** — which is what carries the answer. Be precise about the narrower supporting claim: every `console.warn` is `__DEV__`-gated, but `mobile/src/components/app-error-boundary.tsx:18` has an **ungated `console.error`** in `reportRenderError`. It writes to the device console and nowhere else (there is no reporter installed to pick it up), so the conclusion holds; the sentence "all console calls are `__DEV__`-gated" does not. *(Resolution: `docs/platform-split/08-release-qa-sunset.md:30` and `05-security.md:40` assume Sentry — **stale**, it is not installed. Do not declare crash-analytics collection.)* |
| Location, Contacts, Health, Sensitive Info, Browsing History, Search History, Other Data | **No** | no `expo-location`, no contacts module; no sensitive field on any schema; the app opens fixed marketing URLs only and reports nothing about them |

**The sign-up password is deliberately not on this table.** Clerk collects an email address and a password at sign-up (`mobile/src/app/(auth)/sign-up.tsx:39` — `signUp.create({ emailAddress, password })`). Apple's data-type list has **no credentials category**, so declaring nothing for it is the normal reading, and the email itself is already declared under Contact Info. Recorded here in one line so it is not re-litigated at submission.

One extra line worth putting in the Notes if asked: **session tokens live in the Keychain, never AsyncStorage** (`mobile/src/lib/token-cache.ts:1-29`), and every `/api/v1` request is HTTPS **once the build is pointed at the production origin** — today `mobile/.env` sets cleartext `http://localhost:3000` (blocker **A5**). Do not cite `mobile/app.json:12-14` for this: that is the `usesNonExemptEncryption` block and says nothing about transport (§1c).

### 4c. Tracking: **No**

Answer "No" to *"Do you or your third-party partners use data for tracking?"* and leave `NSPrivacyTracking` false / `NSPrivacyTrackingDomains` empty.

- No ATT prompt and no ATT framework: `expo-tracking-transparency` is not a dependency, and nothing in `node_modules` references `AppTrackingTransparency`, `advertisingIdentifier` or `ASIdentifierManager` (0 hits across `*.h`/`*.m`/`*.swift`/`*.podspec`).
- No IDFA is read — there is no code path that could produce one.
- No ad network or attribution SDK. The full native surface is Expo modules + React Native + Clerk + UploadThing (`mobile/package.json:5-39`).
- No data is shared with a data broker or joined with third-party data. The only third parties receiving user data are **Clerk** (auth), **UploadThing** (storage) and **Stripe** (payouts) — service providers acting on instruction, all named in the privacy policy (`app/privacy/page.tsx:15-18`).
- Every SDK manifest in the binary declares `NSPrivacyTracking` **false**. The four Expo manifests also carry an explicit empty `<key>NSPrivacyTrackingDomains</key><array/>` (`node_modules/{expo-device,expo-notifications,expo-constants,expo-file-system}/ios/PrivacyInfo.xcprivacy:10`). **React Native's does not declare `NSPrivacyTrackingDomains` at all** — its whole file is `NSPrivacyAccessedAPITypes` (FileTimestamp `C617.1`, UserDefaults `CA92.1`), an empty `NSPrivacyCollectedDataTypes`, and `NSPrivacyTracking` false (`node_modules/react-native/React/Resources/PrivacyInfo.xcprivacy`). Absent behaves as empty in practice, but do not write that the file contains a key it does not contain.

### 4d. The `PrivacyInfo.xcprivacy` defect and its fix

**Defect 1 — the manifest declares nothing.** `mobile/ios/CreatorDocks/PrivacyInfo.xcprivacy:32-33` is literally `<key>NSPrivacyCollectedDataTypes</key><array/>` while the app collects email, name, photos/videos, pitch/caption text, a user ID, a proposed rate, and (after `eas init`) a push token. The three required-reason API entries it does carry are correct and inherited from the Expo template — `FileTimestamp C617.1`, `UserDefaults CA92.1`, `SystemBootTime 35F9.1` (`:5-31`). **Because every SDK manifest in the binary is empty of collected types, the app-level manifest is the only place these declarations can come from** — this is a real defect, not a cosmetic one.

**Defect 2 — the file is disposable.** `mobile/.gitignore:42` ignores `/ios`. Anything hand-edited there is destroyed by the next `expo prebuild --clean` and is not in version control meanwhile. **A hand-edit is not a fix.**

**The fix: add `ios.privacyManifests` to `mobile/app.json`** — a first-class Expo config key, verified in the installed toolchain: read at `node_modules/@expo/config-plugins/build/ios/PrivacyInfo.js:44` (no-ops when absent, which is why nothing is written today), written and added to the Xcode resources phase at `:52-73`, **merged** with the template's existing entries rather than replacing them at `:91-126`, and run as part of the default prebuild (`node_modules/@expo/prebuild-config/build/plugins/withDefaultPlugins.js:134`). Shape typed at `node_modules/@expo/config-plugins/build/ios/PrivacyInfo.d.ts:4-17`.

Replace the `"ios"` object at `mobile/app.json:10-15` with:

```json
"ios": {
  "bundleIdentifier": "com.creatordocks.app",
  "config": { "usesNonExemptEncryption": false },
  "privacyManifests": {
    "NSPrivacyTracking": false,
    "NSPrivacyTrackingDomains": [],
    "NSPrivacyAccessedAPITypes": [
      { "NSPrivacyAccessedAPIType": "NSPrivacyAccessedAPICategoryFileTimestamp", "NSPrivacyAccessedAPITypeReasons": ["C617.1"] },
      { "NSPrivacyAccessedAPIType": "NSPrivacyAccessedAPICategoryUserDefaults", "NSPrivacyAccessedAPITypeReasons": ["CA92.1"] },
      { "NSPrivacyAccessedAPIType": "NSPrivacyAccessedAPICategorySystemBootTime", "NSPrivacyAccessedAPITypeReasons": ["35F9.1"] }
    ],
    "NSPrivacyCollectedDataTypes": [
      { "NSPrivacyCollectedDataType": "NSPrivacyCollectedDataTypeEmailAddress",      "NSPrivacyCollectedDataTypeLinked": true, "NSPrivacyCollectedDataTypeTracking": false, "NSPrivacyCollectedDataTypePurposes": ["NSPrivacyCollectedDataTypePurposeAppFunctionality"] },
      { "NSPrivacyCollectedDataType": "NSPrivacyCollectedDataTypeName",              "NSPrivacyCollectedDataTypeLinked": true, "NSPrivacyCollectedDataTypeTracking": false, "NSPrivacyCollectedDataTypePurposes": ["NSPrivacyCollectedDataTypePurposeAppFunctionality"] },
      { "NSPrivacyCollectedDataType": "NSPrivacyCollectedDataTypePhotosorVideos",    "NSPrivacyCollectedDataTypeLinked": true, "NSPrivacyCollectedDataTypeTracking": false, "NSPrivacyCollectedDataTypePurposes": ["NSPrivacyCollectedDataTypePurposeAppFunctionality"] },
      { "NSPrivacyCollectedDataType": "NSPrivacyCollectedDataTypeOtherUserContent",  "NSPrivacyCollectedDataTypeLinked": true, "NSPrivacyCollectedDataTypeTracking": false, "NSPrivacyCollectedDataTypePurposes": ["NSPrivacyCollectedDataTypePurposeAppFunctionality"] },
      { "NSPrivacyCollectedDataType": "NSPrivacyCollectedDataTypeUserID",            "NSPrivacyCollectedDataTypeLinked": true, "NSPrivacyCollectedDataTypeTracking": false, "NSPrivacyCollectedDataTypePurposes": ["NSPrivacyCollectedDataTypePurposeAppFunctionality"] },
      { "NSPrivacyCollectedDataType": "NSPrivacyCollectedDataTypeDeviceID",          "NSPrivacyCollectedDataTypeLinked": true, "NSPrivacyCollectedDataTypeTracking": false, "NSPrivacyCollectedDataTypePurposes": ["NSPrivacyCollectedDataTypePurposeAppFunctionality"] },
      { "NSPrivacyCollectedDataType": "NSPrivacyCollectedDataTypeOtherFinancialInfo","NSPrivacyCollectedDataTypeLinked": true, "NSPrivacyCollectedDataTypeTracking": false, "NSPrivacyCollectedDataTypePurposes": ["NSPrivacyCollectedDataTypePurposeAppFunctionality"] }
    ]
  }
}
```

> ⚠️ **The eight `NSPrivacyCollectedDataType*` strings above are NOT verified against Apple.** Apple's *Describing data use in privacy manifests* page renders its key tables client-side and could not be read. `NSPrivacyCollectedDataTypePhotosorVideos` (note the lowercase `or`) and `…OtherUserContent` are corroborated only by third-party SDK vendor docs; `…OtherFinancialInfo` is **not corroborated at all**. Apple's own note is that Xcode silently produces a *blank* privacy report on an unrecognized key rather than an error. **Check each string against `https://developer.apple.com/documentation/bundleresources/describing-data-use-in-privacy-manifests`, then run `expo prebuild --clean` and confirm both the generated file and Xcode's Generate Privacy Report list all seven types.** The required-reason codes are carried over verbatim from what the toolchain already generated and from the pods' own manifests.

### 4e. Two judgement calls, and one build-hygiene item

1. **Stripe Express onboarding → Payment Info = No — and the same reasoning governs Phone, Physical Address and arguably Sensitive Info.** State it once, apply it everywhere it applies:

   > *Bank account and card details, phone number, physical address and identity documents are entered by the creator on **Stripe's own hosted page**, opened in `SFSafariViewController` from the Earnings tab. We create the Connect account with nothing but the creator's email (`app/api/v1/stripe/onboard/route.ts:21-25`), we store nothing but `stripeAccountId`, the app is told nothing but `{onboarded: boolean}` (`packages/shared/src/stripe-connect.ts:11`), and this codebase never calls `stripe.accounts.retrieve`. Data entered on a processor's own page and never received by us is not data we collect.*

   On that basis **No** is accurate for Payment Info, Credit Info, Phone Number and Physical Address alike. **The same UNVERIFIED caveat attaches to all four:** whether the Stripe *platform dashboard* exposes enough connected-account detail to count as our collection under Apple's definition. Verify once, by checking what the Express account object returns to the platform, and the answer settles every row. Do **not** rest the Phone/Address rows on "no such field in `mobile/src`" alone — a reviewer who presses on Stripe will point at the flow the app launches, and a grep is not an answer to that. Either way the privacy policy must name Stripe as a processor (it does, `app/privacy/page.tsx:15-18`).
2. **The `niche` filter → Usage Data = No.** The category chip is a functional query parameter (`use-campaigns.ts:35`); the free-text search never leaves the device. A functional request parameter is not Product Interaction data. **Revisit if a server-side request-logging layer that retains it is added** — `docs/production-readiness-2026-09-06.md:87` proposes exactly that. Vercel/Neon infrastructure logs are excluded as ordinary hosting telemetry; that is the standard reading but is **UNVERIFIED** as an interpretation.
3. **Clerk telemetry (build hygiene, not a label).** Clerk's bundled telemetry collector posts SDK-version/publishable-key events to `clerk-telemetry.com`, gated on `instanceType === 'development'`. `mobile/.env` holds a **`pk_test_…`** key, so a build made from the current env **would** emit it. Shipping with a `pk_live_…` key disables it; you can also pass `telemetry={{disabled:true}}` to `ClerkProvider` (`mobile/src/app/_layout.tsx:44` passes only `tokenCache` today). The payload carries no end-user PII, so no label row changes.

**Do not add crash reporting between locking the labels and submitting.** Adding Sentry/Bugsnag/Crashlytics would add Diagnostics rows (Crash, Performance, and in Sentry's default config Other Diagnostic Data), probably a Device ID/Analytics purpose, and Product Interaction if session replay or tracing is on. Labels are per-version; a build that starts collecting diagnostics after the labels are locked is a false declaration.

---

## 5. Demo account and reviewer access

### 5a. What a reviewer hits on first launch — gate by gate

| # | Gate | Behaviour today | Evidence |
|---|---|---|---|
| 0 | API base URL | Every call goes to `${EXPO_PUBLIC_API_URL}${path}`; the client throws if it is missing. `mobile/.env` currently sets `http://localhost:3000` | `mobile/src/lib/api-client.ts:168-171` |
| 1 | `VersionGate` — wraps the **entire** app, before auth | Calls `GET /api/v1/meta` (the only unauthenticated endpoint). Blocks everything on `maintenanceMode` or a below-minimum build version. **Fails open** on a network error | `mobile/src/app/_layout.tsx:47`; `mobile/src/components/version-gate.tsx:125-153`; `app/api/v1/meta/route.ts:4` |
| 2 | Root redirect | Signed out → `/sign-in`. **There is no browse-before-login path anywhere in the router** | `mobile/src/app/index.tsx:9` |
| 3 | Sign-in | Google + TikTok SSO, plus email + password. **No Sign in with Apple** (risk A1), **no "Forgot password?"** (risk B8 — `grep -rin "forgot\|resetPassword"` over `mobile/src` returns nothing), **no Terms or Privacy link** (risk B7) | `mobile/src/app/(auth)/sign-in.tsx:88,98-126`; `oauth-buttons.tsx:18-21` |
| 4 | Sign-up | Clerk create + emailed 6-digit code, then `/discover`. **Clerk lets them in; the app does not.** No agreement step and no legal links on this screen either — the user agrees to nothing and is shown no policy (risk B7) | `mobile/src/app/(auth)/sign-up.tsx:39-41,56-63,127-182` |
| 5 | Account bootstrap — **the choke point** | Every authenticated session, cold launch included, calls `POST /api/v1/onboarding` before any tab renders | `mobile/src/app/(app)/_layout.tsx:102`; `use-ensure-account.ts:36` |
| 6 | Invite allowlist | No existing `User` row → primary email checked against the allowlist → `403 {"error":"NOT_INVITED"}` | `app/api/v1/onboarding/route.ts:69-71` → `lib/admin-config.ts:69-80` |
| 7 | **Waitlist dead end** | "You're on the list — CreatorDocks is invite-only right now." with a single **Sign out** control. No tabs, no retry that can ever succeed. **This is where a reviewer stops** — and where two separate rejections start: the copy is a Guideline **2.2** exhibit (risk **A7**), and the account they just created is now undeletable in-app (risk **A8**, 5.1.1(v)) | `mobile/src/app/(app)/_layout.tsx:41-73,115`; `lib/mobile-api-guard.ts:163-164` |
| 8 | Discover | Returns **only** campaigns with `status = ACTIVE` **and** `deadline >= now`. Empty → "No campaigns right now" | `app/api/v1/campaigns/route.ts:23-28`; `discover/index.tsx:241` |
| 9 | Apply | **No client-side Stripe pre-check.** The reviewer writes a ≥20-character pitch and a rate, taps Submit, and only then gets `403 "Complete Stripe onboarding before applying to campaigns"` inline. Wasted effort followed by a hard stop — reads as a broken app | `app/api/v1/applications/route.ts:34-40`; `apply.tsx:14,38-41,47-49` |
| 10 | Earnings | If `stripeOnboarded` is false the whole tab is replaced by "Connect payout account", which creates a **real** Stripe Express account and opens Stripe-hosted onboarding. A reviewer will not complete it — and if they try, `return_url` is `${siteUrl}/creator/settings?onboarded=true`, a **web** page that redirects to `/sign-in` without a Clerk web session | `earnings/index.tsx:154-155,84-120`; `app/api/v1/stripe/onboard/route.ts:30-41`; `app/(dashboard)/creator/layout.tsx:10` |
| 11 | Activity / Profile | Applications + submissions lists (`role: 'CREATOR'`); Profile has Privacy policy, Terms, Support, Sign out, Delete account | `app/api/v1/applications/route.ts:76`; `mobile/src/app/(app)/profile/index.tsx:175-189` |

**Who can create an account in production today.** `isTesterEmailAllowed` resolves as: `MARKETPLACE_ACCESS=open` → everyone (**not set**); else the union of `TESTER_ALLOWED_EMAILS` (falling back to `ADMIN_ALLOWED_EMAILS`) and `ADMIN_ALLOWED_EMAILS`; if that union is empty → `NODE_ENV === 'development'` only (`lib/admin-config.ts:52-58,61,69-80`). A `vercel env pull` of production (`.env.production.local`, pulled 2026-09-07) has `ADMIN_ALLOWED_EMAILS` with **one** entry — the owner's — and **no** `TESTER_ALLOWED_EMAILS`, **no** `MARKETPLACE_ACCESS`, **no** `MOBILE_*`. So: **exactly one email address on earth can currently create a CreatorDocks account in production.** (The shorthand "nobody can sign up" is slightly wrong; do not write it that way.)

### 5b. Seeding checklist

**Environment — production Vercel project**

| Variable | Set to | Why |
|---|---|---|
| `TESTER_ALLOWED_EMAILS` | **BLOCKER** — must include **both** review addresses (comma-separated) | `lib/admin-config.ts:61,75`. `ADMIN_ALLOWED_EMAILS` is still unioned in, so this does not lock the owner out. **It gates uploads too, separately from the invite gate:** `app/api/v1/uploads/route.ts:22` re-checks `isTesterEmailAllowed(user.email)` on every upload *in addition to* `role === 'CREATOR'`, so a mis-scoped value gives the reviewer a hard error at exactly the point §6d asks for screenshot 5. The rejection string is surfaced to the user verbatim (`content-upload-field.tsx:47`) and reads *"Only allowlisted creator accounts can upload content while CreatorDocks is in waitlist mode"* — which is also a Guideline 2.2 exhibit (risk **A7**) |
| `MARKETPLACE_ACCESS` | leave **unset** | `open` would also let the reviewer in but throws the platform open to self-serve signup, which the file's own comment says is unsafe until payments are verified end to end (`lib/admin-config.ts:44-48`). Use the allowlist |
| `MOBILE_MAINTENANCE_MODE` | unset, or anything that is not exactly `true` | compared to the literal string `'true'` (`app/api/v1/meta/route.ts:9`); `TRUE`/`1`/`yes` all read as false |
| `MOBILE_MIN_SUPPORTED_VERSION` | unset (defaults `1.0.0`) or ≤ the submitted build version. **Freeze for the whole review window** | `app/api/v1/meta/route.ts:7` |
| `NEXT_PUBLIC_URL` | already `https://www.creatordocks.com` | Stripe return URLs; the onboard route 500s before Stripe is called if it is missing (`app/api/v1/stripe/onboard/route.ts:10-13`; `lib/site-url.ts:1-5`) |
| `EXPO_PUBLIC_API_URL` (**app build**) | **BLOCKER** — the production `https://` origin | `mobile/.env` is `http://localhost:3000` |
| `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` (**app build**) | **BLOCKER** — the production `pk_live_…` key | `mobile/.env` holds a `pk_test_…` key; a test-instance key cannot authenticate a production Clerk user |

**Clerk identities for the reviewer — two of them** — see §1b. Both allowlisted, both `CREATOR`, both `stripeOnboarded = true`, both seeded; the second exists so the destructive 5.1.1(v) test does not burn the primary. Add: no Clerk **session tasks** (e.g. `choose-organization`) on that user; a `pending` session is treated as signed-out and surfaces "Sign-in couldn't be completed for this account. Please contact support." (`sign-in.tsx:41-45`; `oauth-buttons.tsx:89-95`). Email must be **verified** or `onboarding/route.ts:52-64` returns `400 "Unable to determine account email"`.

**The demo `User` row**

| Field | Value | Why |
|---|---|---|
| `role` | `CREATOR` | `/applications`, `/submissions`, `/payouts` all enforce it; `POST /api/v1/onboarding` creates rows as `CREATOR` anyway (`:79`) |
| `stripeOnboarded` | `true` | **BLOCKER twice over**: otherwise Earnings shows only the connect prompt (`earnings/index.tsx:154`) **and** applying 403s (`applications/route.ts:35`) |
| `stripeAccountId` | a **real test-mode Express account that has actually finished onboarding** | the `account.updated` webhook recomputes the flag from `details_submitted && payouts_enabled && capabilities.transfers === 'active'` and writes it by `updateMany({ where: { stripeAccountId } })` (`app/api/webhooks/stripe/route.ts:212-223`). Flipping the boolean with no matching account holds only until an event arrives |
| `name` | filled in | The Profile tab renders it, and the avatar monogram is derived from it: `mobile/src/app/(app)/profile/index.tsx:154-172` draws a coral gradient circle containing `(me.name ?? me.email).charAt(0).toUpperCase()`, then the name and `formatRoleLabel(me.role)`. With `name` null the reviewer sees their own email address and its first letter — legible, but it reads as an unfinished profile |
| `avatarUrl`, `bio` | **irrelevant to the app — set them or don't** | **No mobile screen reads either field.** The avatar is the generated monogram above, never `avatarUrl`; `bio` is rendered on no screen and settable on no screen — `useUpdateMe`, the only caller of `PATCH /api/v1/me`, is imported by nothing but its own test (`grep -rn useUpdateMe mobile/src` → `use-update-me.ts:21`, `use-update-me.test.tsx` only), so there is no profile-editing UI at all. Consistent with §10's note that no screen can set or display `bio`. Seeding them costs nothing and changes nothing a reviewer sees |

**Data — minimum viable shape.** 1 BRAND user (campaigns need an owner, `prisma/schema.prisma:77-78`) · **2 CREATOR users** (primary demo + disposable deletion-test account, §1b) · **10 ACTIVE campaigns** across **≥3 niches**, deadlines **≥60 days out** · applications on the **primary** account: 1 PENDING, 1 REJECTED, 4 ACCEPTED (6 campaigns consumed, 4 left free to apply to) · 4 submissions, one per status · 3 payouts on approved submissions, **at least one `PAID`**, **none `PENDING`/`PROCESSING`**. Give the deletion-test account a smaller version of the same shape — it must not look broken either, since the reviewer signs into it before deleting it — and specifically **no in-flight payout**, or `DELETE /api/v1/me` 409s and the 5.1.1(v) test fails in the most confusing possible way (§3c, risk **C1**).

Why those numbers:
- ≥3 campaigns or the feed drops out of its masonry grid into full-width hero cards (`discover/index.tsx:36-39`). **Seed ≥3 niches** — but state the code correctly, because the seeding advice and the code behaviour are different things: the gate is `{categories.length > 2 && <CategoryChips …/>}` at `discover/index.tsx:213-214`, and `categories` is `[ALL_CATEGORIES, ...niches]` (`:97-99`), so **two distinct niches already render the chip row**. Three is a screenshot choice (a one-chip row beside "All" looks thin), not a threshold. Page size is 20, so 6–10 campaigns is plenty.
- **No image assets needed** — cover art is generated from the campaign id and niche (`campaign-tile.tsx:159`).
- `@@unique([campaignId, creatorId])` means **each application consumes its own campaign** (`prisma/schema.prisma:125`). A submission hangs off an **ACCEPTED** application (`app/api/v1/submissions/route.ts:48-53`) and `Payout.submissionId` is `@unique` (`:166`) — so each payout needs its own submission → its own accepted application → its own campaign.
- The Earnings hero is `meta.lifetimePaidAmount`, aggregated over `status = 'PAID'` **only** (`app/api/v1/payouts/route.ts:74,80`). **Without a PAID payout the hero reads $0.00** and the "creators get paid" story collapses.
- Every payout is joined back through Submission → Application → Campaign → `brand.name` and run through `payoutSchema.parse` (`payouts/route.ts:8-20`). **A payout with a broken chain throws and takes the whole Earnings tab down.**
- `contentUrl` must be `https` on a host ending `.ufs.sh`/`.utfs.io`, or exactly `utfs.io` (`lib/content-url.ts:6-21`). Direct DB inserts bypass the check — use genuinely uploaded URLs anyway so the detail screen renders real media.
- **Seed no `PENDING`/`PROCESSING` payout.** One makes `DELETE /api/v1/me` return 409 (§3c), and reviewers do test deletion under 5.1.1(v). Demonstrate in-flight states with screenshots. If you keep one, say so explicitly in the Notes (the bracketed sentence in §1a).

**Tooling.** `prisma/set-role.mjs` can set the role, is allowlist-gated, and prints the target DB host as a guard (`:28-53`). **There is no seed script in this repo** — `prisma/` contains only `migrations/`, `schema.prisma`, `promote-admin.mjs`, `set-role.mjs`. Campaign/application/submission/payout data has to be created by hand or by a script that does not exist yet.

### 5c. The seeding lands in the production database

**There is no staging environment.** `prisma/set-role.mjs:10-14` says in its own header that the local `.env` `DATABASE_URL` points at the shared Neon database. The only pulled Vercel env is `.env.production.local`; there is no `.env.preview.local` and no second project config. `docs/platform-split/08-release-qa-sunset.md:15` assumes a staging environment ("beta build points at **staging**") — **the configuration contradicts that doc.**

There is also **no "demo" or "hidden" flag on `Campaign`** (`prisma/schema.prisma:75-100`), and `GET /api/v1/campaigns` returns every ACTIVE in-deadline campaign to every authenticated user. **Seeded demo campaigns are visible to real creators, who can apply to them.**

**Recommendation: seed production, carefully.** The submitted binary must point at production; a build pointing at staging is not the build you ship, so the demo data has to live in production regardless. Prefix every seeded record identifiably (`Demo Brand (App Review)`, `[DEMO] …` titles), create it as close to submission as possible, delete it the day approval lands, and never run a bulk delete against production without a dry run. With the allowlist at one address today the exposure is near zero — it grows the moment `TESTER_ALLOWED_EMAILS` widens. Stand up staging for TestFlight beta if you want it, but it does not solve App Review.

### 5d. The launch gate can hard-block a reviewer

`VersionGate` wraps the entire router, so either condition presents an unrecoverable full-screen block **before sign-in**.

| Condition | Result | Today |
|---|---|---|
| `MOBILE_MAINTENANCE_MODE=true` | "Down for maintenance", only a "Check again" button | Not set in the production env pull → false |
| `MOBILE_MIN_SUPPORTED_VERSION` > build version | "Update required" | Not set → defaults `1.0.0`; `mobile/app.json:5` is `1.0.0`; `isVersionBelow('1.0.0','1.0.0')` is false (`mobile/src/lib/version-gate.ts:2-13`). Safe |
| API unreachable | **Fails open** — children render; the reviewer reaches sign-in and every authenticated call then fails instead | — |

Aggravating detail: **`mobile/app.json` has no `expo.extra.appStoreUrl`**, so the "Update required" screen shows **no App Store button at all** — written instructions and "Check again" only (`version-gate.tsx:20-36,141-150`; open item in `mobile/RELEASE-CHECKLIST.md:35-42`). A reviewer who hits it has literally no way forward. **Freeze both `MOBILE_*` values for the entire review window and run no maintenance window while a submission is in review.**

---

## 6. Listing metadata

### 6a. App Store Connect field checklist

| Field | Value | Notes / evidence |
|---|---|---|
| **App name** (30) | `CreatorDocks` (12) | `mobile/app.json:3`; `mobile/ios/CreatorDocks/Info.plist:9-10`. The home-screen display name must match the listing name. **TODO:** confirm not already taken |
| **Subtitle** (30) | `Paid local brand campaigns` (26) | derived from `app/get-the-app/page.tsx:24-25` |
| **Promotional text** (170) | `Local businesses near you are paying for content. Browse live campaigns, apply with your own rate, upload the work, and watch the payout land — all from your phone.` (162) | editable without a new build; reuse later for "now open in \<city\>" |
| **Description** | §6b | ≈150 words, every sentence mapped to shipped behaviour |
| **Keywords** (100, comma-separated, **no spaces after commas**) | `creator,ugc,influencer,brand deals,campaign,local,gig,sponsorship,payout,freelance,collab` (89) | omits "job/jobs" (Apple treats employment claims strictly) and any competitor name; does not repeat the name or subtitle, which are indexed separately |
| **Primary category** | `Business` | Marketplace/gig apps sit here. **Do not choose Social Networking** — it invites full Guideline 1.2 UGC review, and the app has no feed, profiles or messaging |
| **Secondary category** | `Photo & Video` | justified by the upload flow. `Finance` drags in financial-app scrutiny for no benefit |
| **Support URL** | `https://www.creatordocks.com/support` | `mobile/src/constants/links.ts:13`; page live at `app/support/page.tsx:3-40`, lists `support@creatordocks.com` |
| **Marketing URL** | `https://www.creatordocks.com/get-the-app` | optional; safe to fill |
| **Privacy Policy URL** | `https://www.creatordocks.com/privacy` | `mobile/src/constants/links.ts:11`; also linked in-app |
| **Copyright** | `2026 CreatorDocks` | matches the site footer. **UNVERIFIED:** no legal entity name appears anywhere in the repo — if CreatorDocks is incorporated, the copyright line and the ASC legal entity must use the registered name |
| **Version** | `1.0.0` | `mobile/app.json:5`; the in-app Profile row renders the same value, so listing and app agree |
| **Build number** | `1` (Expo default) | no `ios.buildNumber` in `mobile/app.json`; bump per upload |
| **Bundle ID** | `com.creatordocks.app` | `mobile/app.json:11`. **BLOCKER** — not yet registered (banner #1) |
| **Content rights** | **"Yes — contains, shows, or accesses third-party content"** | creators upload media, brands author briefs. The Terms put rights on the parties (`app/terms/page.tsx:15-17`) |
| **Pricing** | Free, no in-app purchases | no IAP dependency in `mobile/package.json:5-39` |
| **Sign-in required** | **Yes** — declare it and supply the §1b demo account | `mobile/src/app/index.tsx:9`; `mobile/src/app/(app)/_layout.tsx:112` |
| **Made for Kids** | No | there is no age gate and no date-of-birth field anywhere in `mobile/src` |
| **Age rating** | see §6c | |

### 6b. Description draft

> CreatorDocks is where local businesses hire creators — and it is free for creators, always.
>
> Browse live campaigns from cafes, gyms, salons, boutiques and home-service brands near you. Filter by niche and platform so you only see briefs that actually fit.
>
> Apply in a couple of taps. Send your pitch and the rate you want straight from the campaign screen — no email threads, no negotiating in DMs.
>
> Track every application as it moves from pending to accepted, and withdraw the ones you have changed your mind about while they are still pending.
>
> When the work is done, upload it from your camera roll, add a caption and any notes for the brand, and resubmit in place if they ask for a revision.
>
> Connect a Stripe payout account once. When a brand approves your submission the payment is released to you and lands in your earnings history.
>
> ~~Push notifications tell you the moment a brand accepts, approves, or asks for a change.~~ ← **delete this line unless `eas init` has run and push is verified working on a device.** Advertising a feature the binary cannot perform is its own rejection (risk B2).

Every remaining sentence maps to shipped behaviour: browse + filter (`mobile/src/app/(app)/discover/index.tsx`, `components/category-chips.tsx`), apply with your own rate (`discover/[id]/apply.tsx`), statuses (`activity/index.tsx`), camera-roll upload (`components/content-upload-field.tsx:54-57`), Stripe connect (`earnings/index.tsx:88-104`). Copy is lifted from `app/get-the-app/page.tsx:49-74` so listing and site stay consistent. **Do not claim Android**, and do not imply creators pay anything — the site says "Creators join free and are never charged in the app" (`app/get-the-app/page.tsx:85`).

### 6c. Age rating questionnaire

**UNVERIFIED:** Apple revised this questionnaire in 2025 (13+/16+/18+ tiers, explicit UGC questions); the live wording on 2026-09-07 cannot be checked from the repo. Walk the form in App Store Connect and match it to these answers.

Violence (all forms), Sexual Content/Nudity, Profanity, Mature/Suggestive, Horror, Medical, Gambling, Contests → **None / No**. **Made for Kids → No.**

Three that need thought:

- **Alcohol, Tobacco, or Drug References → "None", with a caveat.** The app references none, but campaign briefs are written by local businesses and the niche list is an open string (`prisma/schema.prisma:91`), so a bar or vape shop could post a brief mentioning alcohol. Answer "None" only while you can say the brand roster contains no such advertiser; otherwise "Infrequent/Mild".
- **Unrestricted Web Access → No.** Every outbound open is to a fixed or server-issued URL, and the full inventory is the five-row table in §2b. Two of the five use `WebBrowser.openBrowserAsync` (in-app `SFSafariViewController`): the three legal links (`profile/index.tsx:66` ← `constants/links.ts:10-14`) and the Stripe onboarding link returned by the API (`earnings/index.tsx:96`). Two use `Linking.openURL` and **leave the app for Safari**: the App Store listing (regex-validated, `version-gate.tsx:20-23,120`) and the creator's own uploaded file (`activity/submissions/[id].tsx:101`). There is no address bar and no arbitrary-URL entry field, so **No** still holds — but say it with that distinction, not with "the only web surfaces are the legal pages and Stripe".

  One residual honesty point on the media link: the write path pins the host (`packages/shared/src/content-url.ts:51-54` → `isAllowedContentUrl`, `https` on `.ufs.sh`/`.utfs.io`/`utfs.io`), but the **response** schema is a plain `z.string()` (`packages/shared/src/submission.ts:31`), so the app itself does not re-validate what it is handed before opening it. Not a rating answer, but it is the honest version if pressed.
- **Does the app contain user-generated content → Yes.** …and **no in-app moderation, reporting or blocking controls exist** (grep of `mobile/src` returns nothing). Mitigation to state: every participant is admitted individually; there is no creator-to-creator surface at all. **Do not state that abuse reporting is published on the support page or covered by the Terms until it is** — neither is true today (§1a, risk **B5**).

**Recommended rating: 12+/13+, not 4+.** Answering "None" everywhere yields 4+, but declaring UGC with no reporting/blocking control while claiming 4+ is exactly the combination that draws a Guideline 1.2 rejection. A conservative rating costs nothing commercially and removes an argument. **Jackson decides — this is a judgement call, not a fact.**

### 6d. Screenshot plan

**Device sizes.** `TARGETED_DEVICE_FAMILY = 1` (iPhone only, `mobile/ios/CreatorDocks.xcodeproj/project.pbxproj:396,427`) and `mobile/app.json` has no `expo.ios.supportsTablet` key, so Expo's default `false` applies. **iPad screenshots are not required and must not be uploaded** — uploading them implies iPad support the binary does not declare. Portrait only (`mobile/app.json:6`).

Required set: **one 6.9"/6.5" portrait set** (1290×2796 or 1242×2688); App Store Connect scales down for smaller iPhones. **UNVERIFIED against Apple's live 2026 requirements — confirm in the Media Manager before capture.** `docs/platform-split/08-release-qa-sunset.md:19` plans 6.7" + 6.1", which is the older requirement set; treat the Media Manager as the source of truth.

Capture six screens in this order — the order is the product story:

1. **Discover** — the campaign mosaic with the money pill. *"Live campaigns from brands near you."*
2. **Campaign detail** — the brief plus the amount chip. **"See the brief and what it pays."** ← load-bearing caption: the chip is labelled `Budget` and the tile pill is a bare amount; only the tile's accessibility label spells out "payout". A reviewer glancing at "$500" must not read it as a price.
3. **Apply** — pitch + your own rate. *"Apply with your own rate."*
4. **Activity** — applications and submissions with status pills. *"Track every application."*
5. **Submit content** — the upload tile with a preview. *"Upload the work from your camera roll."*
6. **Earnings** — lifetime total + payout rows. **"Get paid — creators are never charged."**

Screens 1, 2 and 6 must show seeded, plausible data (§5b). **Do not screenshot** the invite-only gate (`_layout.tsx:41-73`) or the maintenance/force-update block (`version-gate.tsx:95+`). App preview video: skip for 1.0.

**The screen this plan does not cover, and the reviewer will.** Screenshot 4 (Activity) invites a tap, and the row beneath it leads to the **submission detail screen**, which renders the creator's own upload as a bare `https://<appId>.ufs.sh/f/<key>` string with an open-in-new chevron — no thumbnail, no player, no filename (`mobile/src/app/(app)/activity/submissions/[id].tsx:96-112`; the `<ThemedText>` label *is* `{submission.contentUrl}`). Tapping it hands the URL to Safari and leaves the app. Screenshot 5 covers the *upload* tile with its preview; nothing covers this. A reviewer walking Activity → a submission sees the least finished surface in the product, and this document had no risk row for it until now — see **C9**. Either render a real preview before submitting (the cheap version: an `<Image>` for image content, the file name as the link label instead of the raw URL), or accept that the reviewer sees it and do not screenshot it.

### 6e. Permissions

| Permission | Requested? | When | Shipping copy |
|---|---|---|---|
| **Photo library** (`NSPhotoLibraryUsageDescription`) | **Yes** | first tap of the upload tile on the submission screen (`components/content-upload-field.tsx:52-57`) | *"CreatorDocks needs access to your photos so you can upload content for your campaign submissions."* (`mobile/app.json`, `expo-image-picker` plugin) — purpose-specific, names the feature. **Good as-is** |
| **Push notifications** | Yes | after the account exists, from the tab layout (`_layout.tsx:106`) — after sign-in, not at cold launch | iOS supplies the system prompt; no usage string needed. No pre-permission priming screen; denial is handled gracefully (`push.ts:102`) |
| Camera | **No** | — | `cameraPermission: false` |
| Microphone | **No** | — | `microphonePermission: false` |
| Face ID | **No** | — | `faceIDPermission: false`; the token cache uses plain Keychain, no biometric gate |
| Location / Contacts / Calendar / ATT | **No** | — | no such dependency in `mobile/package.json:5-39` |

#### ⚠️ The stale-Info.plist trap — read before archiving

`mobile/ios/` is gitignored generated output and is **stale**. Its Info.plist still carries three Expo-template permission strings for permissions the app does not use:

- `NSCameraUsageDescription` = "Allow $(PRODUCT_NAME) to access your camera" (`mobile/ios/CreatorDocks/Info.plist:48-49`)
- `NSFaceIDUsageDescription` = "Allow $(PRODUCT_NAME) to access your Face ID biometric data." (`:50-51`)
- `NSMicrophoneUsageDescription` = "Allow $(PRODUCT_NAME) to access your microphone" (`:52-53`)

Archiving that directory as-is ships three purpose strings for capabilities the app never invokes — generic template copy is exactly what App Review flags under 5.1.1, and it forces you to justify camera/mic access you do not have. Two further proofs it is stale: the Xcode project still names the old bundle ID `com.anonymous.creatordocks` (`project.pbxproj:391,423`), and `MARKETING_VERSION = 1.0` (`:384`) does not match `1.0.0`. The plist also registers a leftover `com.anonymous.creatordocks` URL scheme alongside the real `creatordocks` one (`Info.plist:28-32`); only `creatordocks` is used, by the SSO redirect (`oauth-buttons.tsx:83`).

**Fix (the repo's own checklist):** `xattr -cr mobile/ios && npx expo prebuild --clean` (`mobile/RELEASE-CHECKLIST.md:18`), **after** the App ID is registered — then re-open the regenerated plist and confirm only `NSPhotoLibraryUsageDescription` remains. `mobile/app.json` is the source of truth; `mobile/ios/` is disposable output.

---

## 7. Rejection risk register

Merged and deduplicated across all research. Severity is the risk to *this* submission. Status describes the code on 2026-09-07. Owner is Jackson throughout; the parenthetical says which console or surface the fix lives in.

### Blockers — the submission cannot succeed until these are closed

| # | Risk | Guideline | Status | Mitigation | Owner |
|---|---|---|---|---|---|
| **A1** | **No Sign in with Apple** while Google and TikTok SSO are offered (`oauth-buttons.tsx:18-21`; no `oauth_apple` anywhere in `mobile/src`) | 4.8 | **Open** | Add Clerk's Apple provider + an Apple-branded button, or remove both third-party providers for 1.0. There *is* an argument that the app's own email+password system (`sign-up.tsx:38-41,57`) satisfies 4.8's "another login option" — it collects only email and is not used for advertising — but that is decided by the individual reviewer and losing it costs a full cycle. **Ship SiwA** | Jackson (code + Clerk) |
| **A2** | **The app cannot be built.** No Apple App ID registered for `com.creatordocks.app`; no EAS project (`mobile/app.json` has no `extra`) | — (pre-submission) | **Open** | Register the App ID with Push Notifications enabled, then `eas init` (`mobile/RELEASE-CHECKLIST.md:8-34`) | Jackson (Apple portal + EAS) |
| **A3** | **Reviewer cannot get in.** `/api/v1` is **confirmed not deployed** — `curl https://www.creatordocks.com/api/v1/meta` returns **404** with the marketing site's HTML 404 body while `/privacy` returns 200 (2026-09-07). Production also has no `TESTER_ALLOWED_EMAILS`, so `isTesterEmailAllowed` is false for every email but the owner's and the app renders the invite-only wall (`lib/admin-config.ts:69-79`; `_layout.tsx:115`). Aggravated by `VersionGate` failing open on a meta error (`version-gate.tsx:125-153`): the reviewer signs in through Clerk and dead-ends on "Couldn't open your account." with a Retry that can never succeed (`_layout.tsx:116-122`) | 2.1 | **Open (confirmed, not inferred)** | Deploy `/api/v1`; re-run the curl and get a 200 JSON body; add **both** review emails to `TESTER_ALLOWED_EMAILS`; seed per §5b; put the credentials in the ASC fields **and** repeat the roster explanation in the Notes | Jackson (deploy + Vercel env) |
| **A4** | **Reviewer sees an empty or broken product.** Empty Discover/Activity/Earnings; or the reviewer writes a pitch, submits, and gets a 403 they cannot resolve; or is asked to complete real Stripe identity/bank onboarding to use the app — explicitly forbidden by the team's own plan (`docs/platform-split/08-release-qa-sunset.md:23`) | 2.1 | **Open** | Seed per §5b, with `stripeOnboarded = true` backed by a genuinely onboarded test-mode Express account, ≥1 `PAID` payout, and no `PENDING`/`PROCESSING` payout | Jackson (seed data) |
| **A5** | **The build points at localhost with a test Clerk key.** `mobile/.env` has `EXPO_PUBLIC_API_URL=http://localhost:3000` and a `pk_test_…` key — a build from it reaches nothing on a reviewer's device | 2.1 | **Open** | Set both to production values in the EAS build profile before archiving | Jackson (EAS build config) |
| **A6** | **The whole implementation is uncommitted.** `app/api/_lib/` untracked; `app/api/v1/me/route.ts`, `app/api/webhooks/clerk/route.ts`, `mobile/src/app/(app)/profile/index.tsx` modified (`git status`, 2026-09-07). Nothing described in §3 exists in production | — (pre-submission) | **Open** | Commit, run CI, deploy | Jackson (git) |
| **A7** | **The app tells the reviewer it is an internal test, in four places they reach.** (1) `WaitlistGate`: *"CreatorDocks is invite-only right now. We'll email you as soon as your spot opens up."* (`mobile/src/app/(app)/_layout.tsx:52`) — the first screen a reviewer's own account lands on. (2) The Support page, opened from Profile and named in the ASC Support URL field: *"Get help with waitlist access, **testing accounts**, and payout setup"*, *"**internal testing** issues for approved accounts"*, *"**tester access** issues"* (`app/support/page.tsx:5-8,14`). (3) The Privacy page, which the Notes route them to: *"the public creator waitlist and **internal marketplace environment**"* / *"internal creator marketplace workflows"* (`app/privacy/page.tsx:7,41`); it never mentions an iOS app. (4) The upload rejection string, surfaced to the user verbatim by `onUploadError` (`mobile/src/components/content-upload-field.tsx:47`): *"Only allowlisted creator accounts can upload content **while CreatorDocks is in waitlist mode**"* (`app/api/v1/uploads/route.ts:24-25`). **"Demos, betas and trial versions belong on TestFlight" is the cheapest rejection a reviewer can write, and every one of those strings is their evidence.** A paragraph of Notes copy explaining the waitlist wall as "intended behaviour" is an admission, not a mitigation | **2.2** | **Open** | This is copywriting, not architecture, and it is a few hours: rewrite the support page to describe a shipped product (drop "testing accounts", "internal testing", "tester access"); rewrite the privacy page to describe the CreatorDocks iOS app and marketplace rather than a waitlist environment (this also fixes **B9**); change the upload error string to something like *"Your account isn't approved for uploads yet — contact support@creatordocks.com."*; and decide whether `WaitlistGate` should say "invite-only" at all rather than "Your account is awaiting approval." Then paste the "THIS IS NOT A BETA" paragraph from §1a | Jackson (web copy + code) |
| **A8** | **An account the reviewer creates cannot be deleted from inside the app.** Reviewers create their own account as step one. That account is not allowlisted, so `POST /api/v1/onboarding` 403s (`app/api/v1/onboarding/route.ts:69-71` → `lib/admin-config.ts:69-80`) and the router renders `WaitlistGate`, whose entire control surface is **one Sign out link** (`mobile/src/app/(app)/_layout.tsx:41-73,115`). No tab bar ⇒ no Profile ⇒ no Delete account. And a Delete control there would not help: `DELETE /api/v1/me` is wrapped in `withMobileApi`, which **401s when `getCurrentAppUser()` finds no `User` row** (`lib/mobile-api-guard.ts:163-164`; `lib/current-app-user.ts:20,27`). So a Clerk identity with a verified email address, created inside the app, is **permanently undeletable in-app** | **5.1.1(v)** | **Open** | Options, cheapest first: (a) add a "Delete account" control to `WaitlistGate` and make `DELETE /api/v1/me` handle the no-row case by deleting the Clerk identity alone (there is nothing else to scrub — this is a few dozen lines and closes the finding outright); (b) fall back to a documented, honoured out-of-app deletion path, which Apple accepts only grudgingly for account*creation* inside the app. **(a).** Whatever you choose, the Notes must not describe deletion as "four taps from launch" without saying it needs an approved account | Jackson (code) |

### High

| # | Risk | Guideline | Status | Mitigation | Owner |
|---|---|---|---|---|---|
| **B1** | **`PrivacyInfo.xcprivacy` declares zero collected data types** (`mobile/ios/CreatorDocks/PrivacyInfo.xcprivacy:32-33`) while the app collects seven, and every bundled SDK manifest is also empty — so the app-level manifest is the only source. Hand-editing is destroyed by the next prebuild (`mobile/.gitignore:42`) | 5.1.2 / privacy manifest | **Open** | Add `ios.privacyManifests` to `mobile/app.json` per §4d, **after** verifying the eight key strings against Apple's docs; then `prebuild --clean` and check Xcode's Generate Privacy Report | Jackson (code) |
| **B2** | **Push notifications are inert.** `registerForPushNotifications` returns `unconfigured` and no device registers while `expo.extra.eas.projectId` is absent (`push.ts:75-88`). Advertising them in the listing is itself a rejection | 2.1 / 2.3.1 | **Open** | `eas init` + APNs credentials (`RELEASE-CHECKLIST.md:28-34`); until then **remove the push line from the description** (§6b) | Jackson (EAS) |
| **B3** | **Generic/unused permission strings in the shipped binary** — template camera, mic and Face ID strings in the stale plist (`Info.plist:48-53`) for permissions `mobile/app.json` disables | 5.1.1 | **Open** | `xattr -cr mobile/ios && npx expo prebuild --clean`, then verify only `NSPhotoLibraryUsageDescription` survives (§6e) | Jackson (build) |
| **B4** | **The launch gate can hard-block the reviewer.** `VersionGate` blocks the entire app before sign-in on `maintenanceMode` or a below-minimum version, and the "Open the App Store" escape only renders when `expo.extra.appStoreUrl` is set — `mobile/app.json` has no `extra` block at all | 2.1 | **Open** | Freeze `MOBILE_MAINTENANCE_MODE` unset and `MOBILE_MIN_SUPPORTED_VERSION` ≤ `1.0.0` for the whole review window; add `expo.extra.appStoreUrl` once the ASC record exists; run no maintenance window during review | Jackson (Vercel env + code) |
| **B5** | **UGC with no reporting, blocking or filtering controls — and the prepared argument is disprovable.** Brands publish briefs every creator sees (`prisma/schema.prisma:75-98`, with no admin-approval state in `CampaignStatus`); creators upload media. No report/block UI in `mobile/src`. Apple's 1.2 checklist is roughly four items — filtering, a report mechanism, a block mechanism, and published contact — and the app has arguably **one**. Worse, the two supports an earlier draft leaned on **do not exist**: the support page never mentions abuse, objectionable content, harassment or reporting a user (its own "Best uses for support" list is payout onboarding, submission/approval issues, application bugs, account access, privacy/terms questions — `app/support/page.tsx:12-15,29-35`), and the Terms' "Prohibited conduct" covers fraud, impersonation, unlawful campaigns, infringement, spam and payment abuse with **no objectionable-content clause and no zero-tolerance statement** — the specific EULA commitment 1.2 asks a UGC app to carry (`app/terms/page.tsx:24-33`; neither file contains "objectionable", "offensive", "harass", "report" or "block") | 1.2 | **Open** | **Build the report control before submitting; do not hold it back as a contingency.** A "Report this campaign" row on the campaign detail screen (and a report affordance on a submission) is a screen, a `POST`, and an email — cheaper than one rejection cycle, and it converts the argument from "we have a contact address" to "we have a report mechanism". At the same time, add an objectionable-content prohibition + zero-tolerance sentence to the Terms and an abuse/reporting line to the support page. Only then may the §1a bracketed sentence be pasted. Also: no feed, profiles or messaging; every participant admitted individually; rate 12+/13+ rather than 4+ (§6c) | Jackson (code + web copy) |
| **B6** | **Data-use declaration must match the binary.** Under-declaring is the rejection risk; over-declaring crash analytics that do not exist is the opposite error | 5.1.2 | **Partly** | Use §4b verbatim: Contact Info (email, name), User Content (photos/**videos**, other), Identifiers (user ID, **device ID**), Financial Info → Other Financial Info. All linked, none tracking, ATT = No. **Purchase History = No. Diagnostics = No** — there is no Sentry, contrary to `docs/platform-split/08-release-qa-sunset.md:30` | Jackson (ASC) |
| **B7** | **No Terms or Privacy link on the sign-up or sign-in screens, and no agreement step of any kind.** Both auth screens render logo, OAuth buttons, two text inputs, a submit button and a cross-link to the other screen — and nothing else (`mobile/src/app/(auth)/sign-up.tsx:127-182`; `sign-in.tsx:80-133`; `grep` for `LEGAL_LINKS\|privacy\|terms` over `mobile/src/app/(auth)/` returns nothing). The legal links live only on the **Profile tab**, i.e. only *behind the invite gate*. So a user creates an account having agreed to nothing and having been shown no policy — and a reviewer's own test account hits the waitlist wall and never reaches the policy at all. An earlier draft treated the link requirement as satisfied by "in-app row + ASC URL field" (**C6**) without noticing the row is unreachable for exactly the users who just signed up | 5.1.1(i), and the other half of the 1.2 EULA expectation | **Open** | Add a one-line "By continuing you agree to our Terms of Use and Privacy Policy" with both links under the submit button on **both** auth screens, reusing `LEGAL_LINKS` (`mobile/src/constants/links.ts:10-14`) and `openBrowserAsync`. Small, and it closes two guidelines at once | Jackson (code) |
| **B8** | **No password reset anywhere in the app.** `grep -rin "forgot\|resetPassword\|reset_password" mobile/src` → **nothing**. Sign-in offers email+password, Google and TikTok and no recovery link (`mobile/src/app/(auth)/sign-in.tsx:88,98-126`). The entire submission rests on passwords typed into an ASC field; if one is wrong, expired, or belongs to the other Clerk instance, the reviewer's in-app recovery is **none** and the rejection writes itself under 2.1. §1b lists eight requirements for the demo identities and this is the ninth | 2.1 | **Open** | Two independent fixes, do both: (a) add Clerk's password-reset flow to the sign-in screen — expected by users regardless of review; (b) sign in with **both** credential pairs on a real device from the exact archive being submitted, immediately before uploading it | Jackson (code + test) |
| **B9** | **The published privacy policy contradicts the App Privacy answers.** The policy's first paragraph says CreatorDocks collects "basic usage data" (`app/privacy/page.tsx:7`) while §4b declares Usage Data → Product Interaction / Advertising / Other = **No**; and the policy never mentions push tokens or any device identifier while §4b declares Identifiers → Device ID = **Yes**. The policy is live (`curl …/privacy` → 200) and the Notes route the reviewer to it. This is a checkable conflict on the first screen of the document Apple treats as authoritative, not a "gap" | **5.1.2 / 5.1.1(i)** | **Open** | Rewrite the policy's "What we collect" section to enumerate what §4b declares — account email and name, campaign/application/submission content including photos and video, a user identifier, a push notification token, proposed rates and payout amounts — and either delete "basic usage data" or declare Usage Data. Do it in the same pass as **A7** (same two files) | Jackson (web copy) |

### Medium

| # | Risk | Guideline | Status | Mitigation | Owner |
|---|---|---|---|---|---|
| **C1** | **The 409 payout message never reaches the creator** — the profile screen replaces every server error with "Couldn't delete your account. Please try again." (`profile/index.tsx:115`). A reviewer with an in-flight payout sees that forever and concludes deletion is broken | 5.1.1(v) | **Open** | Surface the server message (`api-client.ts:200-202` already carries it). Cheap; do it. Also seed no in-flight payout (§5b) | Jackson (code) |
| **C2** | **The Delete account row only renders when the profile query has data** (`profile/index.tsx:150,188`). A cold load failure shows "Couldn't load your profile." with **no deletion control on screen** | 5.1.1(v) | **Open** | Render the settings group (or at least the delete row) independently of the profile query | Jackson (code) |
| **C3** | **`WaitlistSubmission` rows survive account deletion untouched** — real name, email, handle, niche, follower range (`prisma/schema.prisma:41-60`), because there is no FK to `User` | 5.1.1(v) / privacy accuracy | **Open** | Either delete matching waitlist rows on account deletion, or never claim that deletion removes all personal data — to App Review or to a data-protection authority | Jackson (code) |
| **C4** | **TikTok SSO fails review if the redirect is misconfigured.** A reviewer *will* tap "Continue with TikTok" — 4.8 is exactly what they are checking on that screen. The failure copy is generic, "Unable to continue. Please try again." (`mobile/src/components/oauth-buttons.tsx:103`), with the real diagnostic kept behind `__DEV__` (`:102`), so they get a dead button and no explanation. And **the Notes never mention the third-party providers at all** | 2.1 (secondary 4.8) | **Partly** | Test both providers on a real device **from the exact archive being submitted**, or hide TikTok for 1.0 (`oauth-buttons.tsx:18-21` is a two-line change). Either way, say in the Notes which providers are live — the SIGN-IN OPTIONS line in §1a | Jackson (test + Notes) |
| **C5** | **Stripe onboarding's return URL dumps the reviewer on a web sign-in page.** `return_url` is `${siteUrl}/creator/settings?onboarded=true` (`app/api/v1/stripe/onboard/route.ts:36-37`), which redirects to `/sign-in` without a Clerk *web* session (`app/(dashboard)/creator/layout.tsx:10`). W4-1 is still open — the app has no URL scheme to deep-link back with | 2.1 | **Open** | Primary mitigation is that the demo account is already onboarded so the reviewer never opens it. The app does refetch Stripe status when the browser is dismissed (`earnings/index.tsx:101`), so the Notes tell the reviewer to close the browser and pull to refresh (§1a) | Jackson (Notes; code for W4-1) |
| **C6** | **The privacy policy is thin** — the residue after **B9** (which owns the outright contradiction) and **A7** (which owns the "internal marketplace" framing). Both deletion dialogs say "see our privacy policy for details", but the policy has one sentence on deletion and does not enumerate what the app collects; it describes "the public creator waitlist and internal marketplace environment" (`app/privacy/page.tsx:7`) rather than an iOS app; and it says a user can "request" deletion when the app does it instantly. Apple reads the policy as the authority on what the app does | 5.1.1(i) | **Partly** | Expand the policy to match the App Privacy card and the in-app copy, in the same pass as B9/A7. **Note the *link* requirement is NOT simply "met":** the in-app rows sit behind the invite gate — see **B7** | Jackson (web copy) |
| **C7** | **Login wall in front of all content** — nothing is browsable signed-out (`mobile/src/app/index.tsx:9`) | 2.1 / 5.1.1(i) | **Partly** | Defensible on its own: applying for paid work and receiving payouts genuinely requires an account, which is the 5.1.1 carve-out. **It is only a problem in combination with A3** — fully mitigated by a working demo account, not mitigated today | Jackson (demo account) |
| **C8** | **Seeded demo data is visible to real creators.** No demo/hidden flag on `Campaign`; `GET /api/v1/campaigns` returns every ACTIVE in-deadline campaign to every authenticated user | — (operational) | **Open** | Prefix records `[DEMO]` / `Demo Brand (App Review)`, seed close to submission, delete the day approval lands (§5c) | Jackson (seed data) |
| **C9** | **The submission detail screen is a reviewer-visible unfinished surface.** It renders the creator's own upload as a bare `https://<appId>.ufs.sh/f/<key>` string — the link's own label is `{submission.contentUrl}` — with an open-in-new chevron, no thumbnail and no player, and `Linking.openURL` throws the reviewer out to Safari rather than an in-app browser (`mobile/src/app/(app)/activity/submissions/[id].tsx:96-112`, `:101`). §6d's screenshot plan covers the *upload* tile with a preview, not this screen, and Activity is screenshot 4 — so the tap that leads here is one the plan actively invites | 2.1 (reads as unfinished) / 4.2 at the margin | **Open** | Render the media: an `<Image>` for image content and the file name (not the URL) as the link label is enough to stop it reading as a debug screen. Fallback if you ship as-is: expect it, do not screenshot it, and know the app leaves for Safari there (§2b, §6c) | Jackson (code) |

### Low

| # | Risk | Guideline | Status | Mitigation | Owner |
|---|---|---|---|---|---|
| **D1** | **In-app purchase — reviewer misreads a dollar figure.** The tile shows a bare currency pill; the Apply screen has a `$` input above a Submit button | 3.1.1 | **Mitigated** | Nothing is sold; no IAP dependency; money flows to the creator. State it plainly in the Notes (§1a) and caption screenshot 2 and 6 accordingly (§6d) | — |
| **D2** | **Payment facilitation** — the app links out to Stripe Connect onboarding | 3.1.5(a) / 3.2.1 | **Mitigated** | Money moving *to* the user for real-world services is outside IAP. Name Stripe as the processor, consistent with the Terms (`app/terms/page.tsx:20-22`) and policy | — |
| **D3** | **Minimum functionality / "website in a wrapper"** | 4.2 | **Mitigated** | Native throughout: four native tabs, SF Symbols, haptics, native image picker, push, offline/timeout handling (`api-client.ts:13`), Dynamic Type, 44pt targets. **No WebView shell anywhere.** State the outbound surfaces exactly (§2b's five-row table), not as "the legal pages and Stripe": four fixed/server-issued URLs open in `SFSafariViewController` via `expo-web-browser`, and two more — the creator's own uploaded file and the App Store listing — hand off to Safari via `Linking.openURL`. Every one is fixed or server-issued; there is no address bar. See **C9** for the media screen's presentation | — |
| **D4** | **Account deletion requirement** | 5.1.1(v) | **Mitigated** | In-app, Profile → Delete account, two confirmations, four taps; retention disclosed in the dialog and the policy (§3). Residual risks are C1–C3 | — |
| **D5** | **Metadata accuracy — iPhone-only, no Android app** | 2.3.x | **Mitigated** | `TARGETED_DEVICE_FAMILY = 1`; the site already says iPhone-only (`app/get-the-app/page.tsx:92-94`). Just don't upload iPad screenshots | — |
| **D6** | **Earnings shows gross while the push notification quotes net.** A $500 rate produces a push saying "$425 is on its way" and an Earnings row reading "$500.00" (§2d) | — (product bug) | **Open** | Not a guideline violation and not worth blocking on, but **never claim in the Notes that the app shows take-home pay**. Fix by showing the fee breakdown — `platformFee` is already on the wire | Jackson (code) |
| **D7** | **Uploaded media persists at UploadThing URLs after account deletion.** Planned as W6-8, not built; no cron config exists. (Whether those objects are *publicly* fetchable is UNVERIFIED — §3b) | — (privacy accuracy) | **Open** | **The SDK is already in the tree**: `uploadthing` exports `./server`, which carries `UTApi`/`deleteFiles`. Adding one call to `anonymizeAccount` (`app/api/_lib/account-deletion.ts:51-56`) is the cheap next step and lets this dossier drop the "media survives" caveat before submission instead of arguing it. Otherwise, keep the deletion copy silent on media as it currently is (it is) | Jackson (code) |
| **D8** | **The Stripe Connect account is not deauthorized on deletion** — only our pointer is cleared (`account-deletion.ts:24-28`, Q-P4 open) | — (privacy accuracy) | **Open** | Open product decision. Do not claim the creator's Stripe-held data is removed | Jackson (product) |
| **D9** | **Clerk telemetry fires from a `pk_test_…` build** (§4e.3) | — (build hygiene) | **Open** | Ship with `pk_live_…` and/or `telemetry={{disabled:true}}` on `ClerkProvider` | Jackson (build config) |
| **D10** | **No legal entity name anywhere in the repo** — the ASC legal entity and the copyright line must be the registered name if CreatorDocks is incorporated | 2.3 / ASC | **Open (unverified)** | Confirm the entity and use it | Jackson (ASC) |

---

## 8. Owner action list

Every item is Jackson's. Ordered by dependency — later steps genuinely need earlier ones.

**Unblock the build**

1. Register the App ID **`com.creatordocks.app`** in the Apple Developer portal **with the Push Notifications capability enabled**. *(A2)*
2. Create the App Store Connect app record; confirm the name **CreatorDocks** is available. *(A2, §6a)*
3. Run **`eas init`** in `mobile/` — writes `expo.extra.eas.projectId`, which unblocks both builds and push registration. Configure APNs credentials. *(A2, B2)*

**Code changes, before the archive**

4. Add **Sign in with Apple**: enable Clerk's Apple provider and add an Apple-branded button to `mobile/src/components/oauth-buttons.tsx`. *(A1)*
5. **Make a self-created account deletable.** Add a Delete account control to `WaitlistGate` (`mobile/src/app/(app)/_layout.tsx:41-73`) and teach `DELETE /api/v1/me` to handle the no-`User`-row case by deleting the Clerk identity alone — today `withMobileApi` 401s before the handler runs (`lib/mobile-api-guard.ts:163-164`). Without this, a reviewer's own account is undeletable and 5.1.1(v) is open regardless of what the demo account can do. *(A8)*
6. **Build the "Report this campaign" control** (campaign detail screen, and a report affordance on submissions), rather than holding it back as a contingency. This is what turns the 1.2 answer from "we publish a support address" into "we have a report mechanism". *(B5)*
7. **Add Terms + Privacy links and an agreement line to both auth screens** (`sign-up.tsx`, `sign-in.tsx`), reusing `LEGAL_LINKS`. Today they exist only on Profile, behind the invite gate. *(B7)*
8. **Add a password-reset flow** to the sign-in screen (Clerk supports it; the app exposes nothing). *(B8)*
9. **Render the submission's media** instead of the raw `ufs.sh` URL on `activity/submissions/[id].tsx` — an `<Image>` for image content, the file name as the link label. *(C9)*
10. Verify the eight `NSPrivacyCollectedDataType*` strings against Apple's docs, then add the **`ios.privacyManifests`** block to `mobile/app.json` (§4d). *(B1)*
11. Add **`expo.extra.appStoreUrl`** to `mobile/app.json` now that the ASC record exists, so the force-update screen has a button. *(B4)*
12. Cheap deletion fixes: **surface the server's error message** instead of the generic string (`profile/index.tsx:115`) *(C1)*, and **render the Delete account row independently of the profile query** *(C2)*.
13. Optional but cheap, and it removes a caveat from §3b/§3d: **delete uploaded media on account deletion** via `UTApi.deleteFiles`, already available from `uploadthing/server`. *(D7)*
14. **Commit everything and run CI.** The entire deletion implementation is currently untracked/modified. *(A6)*

**Rewrite the copy that says "beta"** — a few hours of web copy that removes the cheapest rejection on the board

15. **`app/support/page.tsx`** — drop "testing accounts", "internal testing issues for approved accounts", "tester access issues". Describe supporting a shipped product, and **add an abuse / objectionable-content reporting line** naming `support@creatordocks.com`. *(A7, B5)*
16. **`app/privacy/page.tsx`** — stop describing "the public creator waitlist and internal marketplace environment" (`:7`) and "internal creator marketplace workflows" (`:41`); describe the CreatorDocks iOS app. In the same edit, **enumerate what §4b declares** — email, name, photos/video and other user content, a user identifier, **a push notification token**, proposed rates and payout amounts — and either delete "basic usage data" or change the Usage Data label answer. *(A7, B9, C6)*
17. **`app/terms/page.tsx`** — add an objectionable-content prohibition and a zero-tolerance sentence to "Prohibited conduct". *(B5)*
18. **`app/api/v1/uploads/route.ts:24-25`** — change the rejection string; it is shown to the user verbatim and currently says "while CreatorDocks is in waitlist mode". *(A7)*
19. **`mobile/src/app/(app)/_layout.tsx:52`** — decide whether `WaitlistGate` should say "invite-only" at all, or "Your account is awaiting approval." *(A7)*

**Deploy and configure production**

20. **Deploy `/api/v1` to production**, then re-run `curl https://www.creatordocks.com/api/v1/meta` and confirm a **200 with a JSON body**. It returns a 404 HTML page today. *(A3)*
21. Set production Vercel env: **`TESTER_ALLOWED_EMAILS`** including **both** review addresses; confirm `MARKETPLACE_ACCESS` **unset**, `MOBILE_MAINTENANCE_MODE` **unset**, `MOBILE_MIN_SUPPORTED_VERSION` **unset or ≤ 1.0.0**, `NEXT_PUBLIC_URL` = `https://www.creatordocks.com`. Remember `TESTER_ALLOWED_EMAILS` also gates uploads (`uploads/route.ts:22`). *(A3, B4)*
22. **Confirm whether the production `STRIPE_SECRET_KEY` is test-mode or live-mode** before seeding — a test-mode Connect account id will not resolve against a live key, and `account.updated` only fires for accounts in the same mode. *(§10)*

**Reviewer access**

23. Create **two reviewer Clerk identities** in the same instance the binary will point at: email + password, verified, **no 2FA, no email-code sign-in step, no pending session tasks**. One primary, one disposable for the deletion test. *(A3, A4, §1b)*
24. **Seed production** to the §5b minimum shape, with `[DEMO]` prefixes: 1 BRAND user, 10 ACTIVE campaigns across ≥3 niches with ≥60-day deadlines, applications 1 PENDING / 1 REJECTED / 4 ACCEPTED, 4 submissions one per status, 3 payouts with ≥1 `PAID` and **none** `PENDING`/`PROCESSING`. Set both creator users `role = CREATOR`, `stripeOnboarded = true` backed by genuinely onboarded test-mode Express accounts, with `name` filled in (`avatarUrl` and `bio` are rendered nowhere — §5b). Give the deletion-test account a smaller but non-empty version of the same shape. *(A4, C8)*

**Build and verify**

25. Point the EAS build profile at production: **`EXPO_PUBLIC_API_URL` = the production https origin**, **`EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` = `pk_live_…`**. *(A5, D9)*
26. **`xattr -cr mobile/ios && npx expo prebuild --clean`**, then open the regenerated `Info.plist` and confirm **only `NSPhotoLibraryUsageDescription`** remains, the bundle ID is `com.creatordocks.app`, and `MARKETING_VERSION` is `1.0.0`. Note that `NSAllowsLocalNetworking = true` will be re-emitted by the template — that is expected; do not describe ATS as "Apple default" anywhere (§1c). Confirm the regenerated `PrivacyInfo.xcprivacy` lists all seven collected types, and run Xcode's **Generate Privacy Report**. *(B3, B1)*
27. On a real device, **from the exact archive being submitted**: sign in with **both** credential pairs (there is no password recovery — B8); walk Discover → Apply → Activity → **open a submission** → Earnings → Profile; run **Delete account on the disposable account only**; create a throwaway un-allowlisted account and confirm the A8 fix lets you delete it from the waitlist screen; and **test every SSO provider you are shipping**. *(A4, A8, B8, C4, C9)*
28. Capture the **six portrait screenshots** at 6.9"/6.5" (§6d) against seeded data. **No iPad screenshots.** *(D5)*

**Fill in App Store Connect**

29. Paste **§1a Notes**, **§1b credentials**, **§1c export compliance**. **Resolve every bracketed line in the Notes against the table under §1a** — the second account, the live SSO providers, the in-flight payout sentence, and the reporting/Terms sentence. Do not paste a claim a reviewer can disprove by tapping a link you gave them.
30. Fill the §6a fields. Use the §6b description — **with the push line deleted unless step 3 is verified working**. *(B2)*
31. Answer the **age-rating questionnaire** per §6c; declare UGC = Yes; rate **12+/13+**. *(B5)*
32. Answer **App Privacy** per §4b. Tracking = **No**. Purchase History = **No**. Diagnostics = **No**. Phone / Physical Address = **No**, on the §4e.1 processor-page reasoning — and confirm the privacy policy now agrees with every answer (**B9**). *(B6)*
33. Confirm the **legal entity name** and copyright line. *(D10)*

**During and after review**

34. **Freeze `MOBILE_MAINTENANCE_MODE` and `MOBILE_MIN_SUPPORTED_VERSION` for the entire review window.** No maintenance windows. No new crash/analytics SDK between locking the labels and approval. *(B4, §4e)*
35. After approval: **delete the `[DEMO]` seed data** (dry-run first — there is no teardown tooling in the repo). *(C8)*

---

## 9. What is unverified

Nothing here was quietly dropped. Each item says what would confirm it.

**Apple policy and App Store Connect**

| Unverified | How to confirm |
|---|---|
| Every guideline number in this document (4.8, 5.1.1(v), 5.1.1(i), 5.1.2, 3.1.1, 3.1.5(a), 1.2, 2.1, 2.3.1, 4.2) is cited from memory | Read the current [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) before submitting |
| The eight `NSPrivacyCollectedDataType*` strings in §4d. `…PhotosorVideos` and `…OtherUserContent` are corroborated only by third-party vendor docs; **`…OtherFinancialInfo` is not corroborated at all**. A typo yields a *blank* privacy report, not an error | Check each against `https://developer.apple.com/documentation/bundleresources/describing-data-use-in-privacy-manifests`, then `prebuild --clean` + Xcode → Generate Privacy Report |
| The exact wording of the 2026 age-rating questionnaire (Apple revised it in 2025) | Walk the form in App Store Connect and match §6c to it |
| The required screenshot sizes as of 2026 (`docs/platform-split/08-release-qa-sunset.md:19` is on the older 6.7"/6.1" set) | The App Store Connect Media Manager at upload time |
| Whether the app name **CreatorDocks** is available | Create the ASC record |
| Whether Apple accepts an invite-only app with demo credentials on the first pass | Judgement, not evidence. Apple generally does |
| Export-compliance exemption as a **legal** matter (§1c is an engineering read of the code) | Export-control advice, if you want certainty |

**Production and infrastructure**

| Unverified | How to confirm |
|---|---|
| ~~Whether `/api/v1` is deployed to production~~ — **RESOLVED 2026-09-07 and promoted to a confirmed blocker** (banner row 1, risk A3). `curl https://www.creatordocks.com/api/v1/meta` → **404**, body is the marketing site's HTML 404 page; `/privacy` and `/support` → 200. Every screen in this document is currently unreachable | done; re-run the same curl after step 20 and require a 200 JSON body |
| Whether the retained UploadThing objects behind `Submission.contentUrl` are **publicly fetchable** after account deletion. Retention is confirmed (no `UTApi`/`deleteFiles` anywhere); the access-control half is not, and nothing in the repo configures a file ACL | Fetch a live `https://<appId>.ufs.sh/f/<key>` URL unauthenticated, in a private window with no bearer token, and record the status |
| Whether the production `STRIPE_SECRET_KEY` is test-mode or live-mode. Reading it was declined by policy. Matters for seeding: a test-mode Connect account will not resolve against a live key, and `account.updated` only fires within one mode | `vercel env pull` or the Vercel dashboard |
| Whether any staging Vercel project or Neon branch exists outside this repo. Only `.env.production.local` is present; no preview env file, no second project config | Check the Vercel and Neon dashboards |
| Clerk instance configuration: session tasks, 2FA requirements, and whether the production instance is the same one `mobile/.env`'s `pk_test_` key belongs to | Clerk dashboard |
| Server log retention window (a hosting-platform setting, not in the repo) | Vercel project settings |

**Behaviour not exercised**

| Unverified | How to confirm |
|---|---|
| Whether `SFSafariViewController` carries a usable Clerk web session to the Stripe `return_url` landing page, or dumps the reviewer at `/sign-in` (C5) | Complete a Stripe test-mode onboarding on a device and observe the landing page |
| Whether Clerk purges the avatar CDN object on user deletion (we null our `avatarUrl` pointer; the image lives at Clerk) | Clerk's retention policy / support |
| What Clerk retains internally after `deleteUser` | Same |
| Whether the Stripe **platform dashboard** exposes enough connected-account banking detail to count as our collection under Apple's definition — this is what makes "Payment Info = No" a judgement call (§4e.1) | Inspect what the Express account object returns to the platform |
| Whether excluding Vercel/Neon infrastructure logs from the labels is the right reading. It is the standard one; a request-logging layer that records creator identity plus behaviour would change it | Decide when `docs/production-readiness-2026-09-06.md:87`'s per-request logging lands |
| ~~How the submission detail screen renders `contentUrl`~~ — **RESOLVED: the whole premise was wrong.** The earlier note said the file "was read only for its `openBrowserAsync` call". `mobile/src/app/(app)/activity/submissions/[id].tsx` **contains no `openBrowserAsync`** — repo-wide, that call appears only at `profile/index.tsx:66` and `earnings/index.tsx:96`. The screen imports `expo-linking` (`:1`) and calls `Linking.openURL(submission.contentUrl)` (`:101`), which leaves the app for Safari. It renders no media at all: the link's own label is the raw URL (`:104-106`). Now owned by risk **C9** and documented in §2b, §6c and §6d | done; look at the screen with seeded data before capturing screenshots |
| Whether the Stripe *platform dashboard* exposes connected-account **phone, address or identity-document** detail to us — the same question as Payment Info, now applied to the Phone / Physical Address / Sensitive Info rows (§4e.1) | The same check: inspect what the Express account object returns to the platform |

### Corrections applied on 2026-09-07, and the one that was only half right

This document was fact-checked against the working tree and against production on 2026-09-07. Every claim challenged was checked; **all of them held, and all were fixed** — nothing was rejected as unfounded. The list, so nobody re-derives it:

| Was wrong | Now |
|---|---|
| §9 said `submissions/[id].tsx` was read only for its `openBrowserAsync` call | That file has no such call. Corrected above and in §2b/§6c/§6d; risk **C9** added |
| §2b / §7 D3: "the only web surfaces are the legal pages and Stripe onboarding, in `expo-web-browser`" | Five outbound opens, two mechanisms — full table in §2b. Two leave the app via `Linking.openURL` |
| §1c / §4b: ATS "left at Apple's default-strict setting", cited to lines that also set `NSAllowsLocalNetworking = true`; and `mobile/app.json:12-14` cited for HTTPS | §1c rewritten. The plist relaxation is named; `app.json:10-15` is the encryption block only; "every request is HTTPS" is now conditioned on fixing **A5** |
| §2b: the money routes "require a Clerk *cookie session*"; `release-payout:29-31` cited for the origin check | Both call `auth()`, which accepts a Bearer header. The real gates are `isTrustedOrigin()` (no `Origin`+no `Referer` ⇒ false in production, `lib/request-security.ts:52-54`) and the BRAND role. `release-payout` origin check is `:14`; `:29-31` is the role gate |
| §3b: uploaded media "still publicly fetchable" | Split: retention confirmed, public-fetchability marked **UNVERIFIED** (above) |
| §5b: "≥3 niches or the category chip row collapses (`discover/index.tsx:97-108`)" | The gate is `categories.length > 2` at `:213`, over `['All', ...niches]` built at `:97-99` — **two** niches already render the row. Seeding advice unchanged, code behaviour restated |
| §4c: every SDK manifest "declares … empty tracking domains" | React Native's manifest has no `NSPrivacyTrackingDomains` key at all; the four Expo ones do |
| §1a Notes: "the Earnings tab shows payouts the creator has already received" / "track money they have received" | The list renders **every** `Payout` row with a status pill including PENDING/PROCESSING/FAILED (`earnings/index.tsx:72-79`; `app/api/v1/payouts/route.ts:59-75`); only the hero is filtered to `PAID`. Notes rewritten to "payout history and lifetime total paid", with the status labels named |
| Four imprecise citations: `payouts/route.ts:66` for `platformFee`; `api-client.ts:171-178` as "the only `fetch` call"; the privacy-policy quote attributed to `page.tsx:41`; §3a's "second group: Delete account" | `:67` (`:66` is `amount`); the only literal `fetch(` is `api-client.ts:133`; the phrase is at `page.tsx:7`; the second group's first row is **Sign out** |
| §3d: "**No contradiction**" between policy and code, and C6 rated Medium ("gaps rather than conflicts") | There *is* a direct contradiction with the **App Privacy answers** — "basic usage data" vs Usage Data = No, and an undisclosed Device ID. Promoted to **B9**; §3d rewritten |
| §5b: `avatarUrl` and `bio` "the Profile tab renders them" | It renders neither. Corrected, with the `useUpdateMe`-has-no-caller evidence |
| §3a: the invite-gate prerequisite cross-referenced **B3** | B3 is template permission strings. The real risk had no owner; it is now **A8** |
| §1a Notes: abuse "reported to support@creatordocks.com, published at creatordocks.com/support and in our Terms of Use", backed by "Terms prohibited-conduct/termination clauses" | Neither page supports it. The sentence is now bracketed and conditional; **B5** upgraded from "argue it in the Notes" to "build the report control and amend the Terms before submitting" |

**The one partially-upheld item, recorded for honesty:** the fact-check said the dossier's quoted phrase "public creator waitlist" was not the policy's actual string. The phrase *is* in the policy — at `app/privacy/page.tsx:7` ("the public creator **waitlist** and internal marketplace environment"), not at `:41`, which reads "across the public waitlist and internal creator marketplace workflows". So the quotation was real and the **citation** was wrong. Fixed as a citation error rather than a fabricated quote; both lines need rewriting anyway under **A7**.

**Additions accepted without a prior claim to correct:** Guideline **2.2** (never mentioned anywhere in the previous draft — now **A7** and banner row 6); the undeletable self-created account (**A8**); missing auth-screen legal links (**B7**); no password reset (**B8**); the policy/label contradiction (**B9**); the raw-URL submission screen (**C9**); the destructive-deletion-test problem (two accounts, §1b/§5b); the `TESTER_ALLOWED_EMAILS` upload gate (§5b); the sign-up password's absence from the label table (§4b); the ungated `console.error` (§4b Diagnostics); push-token unregister being best-effort (§4b Device ID); Phone/Address inheriting the processor-page reasoning (§4b, §4e.1); and `UTApi` already being in the tree (§3b, **D7**).

---

## 10. Where the plan docs are stale (code wins)

Recorded so nobody re-derives these. In every case this dossier follows the code.

- `docs/platform-split/02-mobile-api.md:28` — "reject **or defer** if PROCESSING payouts exist". The code always rejects, and checks **PENDING and PROCESSING** (`app/api/v1/me/route.ts:56`). The defer branch exists only as a flag comment (`:44-53`).
- `docs/platform-split/04-payments-payouts.md:15-17` — states the IAP position; the code supports it, but **W4-1 is still open**: the Stripe return URL is still a web page, not a `creatordocks://` deep link (`app/api/v1/stripe/onboard/route.ts:30-33`).
- `docs/platform-split/05-security.md:39` — "payout/submission history is anonymized (not deleted)". Accurate as intent; precisely, the rows are untouched and it is the **User row they reference** that is scrubbed.
- `docs/platform-split/05-security.md:40-41` — names **Sentry** and lists `bio` in the PII inventory. There is no Sentry in any `package.json` in this repo, and no screen can set or display `bio`.
- `docs/platform-split/06-notifications-media.md:43` (W6-8) — media deletion on account deletion. **Not implemented**; no file-deletion call exists anywhere.
- `docs/platform-split/08-release-qa-sunset.md:15` — assumes a **staging** environment. None exists (§5c).
- `docs/platform-split/08-release-qa-sunset.md:19` — screenshots at 6.7" + 6.1". Older requirement set (§6d).
- `docs/platform-split/08-release-qa-sunset.md:30` — assumes **Sentry** crash reporting. Not installed; do not declare crash-analytics collection (§4b).
- Per the shared brief: **every acceptance checkbox in `docs/platform-split/*.md` is unticked regardless of what is actually done.** Nothing in this dossier relies on one.

### Conflicts between the researched sections, and how they were resolved

| Conflict | Resolution (read from code) |
|---|---|
| Is the Discover tile pill "the creator's payout" or "the campaign budget"? | **The campaign budget.** `mobile/src/components/campaign-tile.tsx:127` is `formatCentsCompact(campaign.budget)`, assigned to a local named `payout` and announced by VoiceOver as "`$X` payout" (`:63`). It is a pool for multi-creator campaigns (`app/api/applications/[id]/route.ts:113-120`). Still unambiguously money offered *to* creators, so the IAP position is unaffected — but do not tell the reviewer it is what this creator will be paid |
| Stripe `return_url` — `/creator/settings` or `/creator/settings?onboarded=true`? | **`return_url` = `${siteUrl}/creator/settings?onboarded=true`; `refresh_url` = `${siteUrl}/creator/settings`** (`app/api/v1/stripe/onboard/route.ts:36-37`) |
| Does the app call `/api/v1/uploads`? One section's endpoint list omitted it | **Yes.** `mobile/src/lib/uploadthing.ts:9-11` points the UploadThing client at `${apiUrl}/api/v1/uploads`, and the route exists (`app/api/v1/uploads/route.ts`). The corrected list is in §2b. This matters — it is the media egress path in §4a |
| Financial labels — "Purchases / Financial (payout records)" vs "Other Financial Info only"? | **Other Financial Info = Yes; Purchase History = No; Payment Info = No.** There is no purchase path of any kind |
