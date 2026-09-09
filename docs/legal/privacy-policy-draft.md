**DRAFT — NOT REVIEWED BY A LAWYER. NOT IN FORCE. DO NOT PUBLISH.**
Written 2026-09-08 against commit `6a2b3eb` ("chore: override effect to 3.20 and record the UploadThing rollout", 2026-09-08). The working tree also carried uncommitted edits to five tracked files — CI config, two docs files (`docs/PROJECT-STATE.md`, `docs/vercel-domain-launch.md`), the mobile Discover screen and its test — plus six untracked paths: this `docs/legal/` folder, `docs/web-redesign-2026-09/mockups/`, `mobile/src/lib/pull-refresh.ts` and its test, `prisma/set-role.mjs`, and a stray `app/(dashboard)/creator/payouts/page 2.tsx`. None of them changes a flow described here. The stray dashboard file is a duplicate of the payouts page; because it is not named `page.tsx` it does not create a route. Verified with `git status --porcelain`. This text replaces nothing until an attorney has reviewed it and Jackson has filled every placeholder.

---

### How to read this draft

- Everything under a `##` heading is one section of the finished page. The prose under it is the section body.
- `[PLACEHOLDER: …]` marks a value only Jackson can supply. Nothing was guessed.
- `[ATTORNEY: …]` marks a legal decision. No legal position has been invented or stated as settled.
- `[UNVERIFIED: …]` marks a factual claim that cannot be settled from this repository — vendor behaviour, or something only an empirical test can answer. It is neither asserted nor denied. Each one names the check that would resolve it. These must be resolved, not deleted, before the text is applied to the page.
- Lines beginning `_Source:_` are drafting apparatus, not published text. They cite the code each section rests on so a reviewer can check it. **Delete them when the text is applied to the page.**
- Sections marked **(needs list rendering)** use bullets. The current page component renders each body as a single paragraph and cannot show a list. See `README.md` in this folder for the five-line change that fixes it.

---

## Effective date

This policy takes effect on [PLACEHOLDER: effective date] and replaces the version published before that date. [PLACEHOLDER: decide whether this policy goes live before the marketplace deploys or at the same moment. Today www.creatordocks.com serves the creator waitlist only — the marketplace and the iOS app described below are built but not pushed to production. One deploy makes all of it live. A policy describing flows nobody can reach yet is not wrong, but the sequencing should be a decision, not an accident.]

_Source: docs/PROJECT-STATE.md:122-124; docs/dpa-draft.md:15,25,73_

## Who we are

CreatorDocks is a marketplace. Brands post paid content campaigns. Creators apply to make the content, deliver it, and get paid. We run the platform that carries all of that. [PLACEHOLDER: registered legal entity name, entity type, country of incorporation, and registered postal address. Nothing in the product names a company today, and a privacy policy needs a named, addressable one.] We decide what the service collects and why, which is what makes us responsible for it. [ATTORNEY: confirm the controller characterisation, and whether an EU or UK representative, or a data protection officer, is required and appointed. Settle this one before the rest: an unreviewed customer data processing agreement already sits in the repository asserting the opposite arrangement — that a brand customer is the controller and CreatorDocks the processor, over creators’ pitches, rates, submissions and media, and over the public waitlist as well. Waitlist members joined our own marketing funnel and have no relationship with any brand, so that characterisation is hard to defend and it contradicts this page on its face. The two cannot both be signed. Which way this goes decides who owes a creator an answer to an access or erasure request, and whether a brand can be told to delete a creator’s pitch once it has landed in their dashboard.]

## What this policy covers

This policy covers the CreatorDocks website, the CreatorDocks iOS app that creators use, and the brand dashboard on the web. It also covers the creator waitlist, which anyone can join from the website without an account. It does not cover what Apple, Google, TikTok, Stripe, or the social platforms you post to do with your information under their own policies. If you sign in with Apple, Google or TikTok, that sign-in is between you and them.

_Source: mobile/src/constants/links.ts:8-14; proxy.ts:5-15; mobile/src/components/oauth-buttons.tsx:19-22,121; mobile/src/components/apple-sign-in-button.tsx:39-48_

## What you give us **(needs list rendering)**

Some of this you type in. Some of it you choose to send.

- Your email address, and either a password or a Sign in with Apple, Google or TikTok sign-in. Your password goes straight to Clerk, our sign-in provider. It never reaches a CreatorDocks server. In the iOS app, Sign in with Apple is the first option on the sign-in screen.
- If you use Sign in with Apple, you can choose Apple’s Hide My Email option. Apple then gives us a relay address ending `@privaterelay.appleid.com` rather than your real one, and that relay address becomes the email address on your CreatorDocks account. It is where every payout email goes, and it is the key we use to re-attach a sign-in to an existing account. If you later switch the relay off in your Apple ID settings, our emails stop reaching you — and there is no way to change your email address anywhere in the product. [PLACEHOLDER: confirm in a live run what Clerk hands us for a Hide My Email sign-up, and decide whether an email-change path ships before this policy does. This is a product gap, not just a sentence.]
- Your display name and your profile photo. Both start from your sign-in account. You can change your name in the app.
- A short bio, if you write one. Up to 500 characters.
- If you are a creator applying to a campaign: your pitch (up to 2,000 characters) and the rate you are asking for.
- If you are a creator delivering work: photos or videos (up to five images at 16 MB each, or one video up to 256 MB), plus a caption and private notes to the brand.
- If you are a brand: everything in your campaign brief — title, description, objective, deliverables, target audience, creator requirements, call to action, usage rights, budget, deadline, niche and platforms.
- If you are a brand reviewing work: your written review note about the creator’s submission, up to 2,000 characters.
- If you join the waitlist: your email address, and then optionally your name, social handle, main platform, niche, follower range, and a referral code if someone sent you one.

_Source: app/api/v1/onboarding/route.ts:73-82; app/api/v1/me/route.ts:24-41; packages/shared/src/application.ts:8-9; packages/shared/src/submission.ts:10-11; app/api/v1/uploads/route.ts:36-38; app/api/campaigns/route.ts:8-20; app/api/submissions/[id]/route.ts:16; app/api/waitlist/route.ts:14-24; mobile/src/components/oauth-buttons.tsx:121; mobile/src/components/apple-sign-in-button.tsx:1-2,48; lib/current-app-user.ts:22-37 (email is the key for re-attaching a sign-in)_

## What we create about you **(needs list rendering)**

We also generate records about you as you use the platform.

- An internal account number. Every other record we hold is attached to it.
- Your role: creator, brand, or admin.
- Your applications and submissions, and every status they have been in. A rejection is a permanent record that a named brand turned down a named person.
- Payout records: the agreed rate, the platform fee, the status, and Stripe’s reference for the charge. The status is one of processing, paid or failed; the database also defines a “pending” state, but nothing in the product ever writes it.
- Whether you finished Stripe’s payout setup. That flag records that you completed Stripe’s identity and bank checks.
- If you joined through the waitlist, who referred you and how many people you have referred.
- Earnings and spending figures we calculate for brand dashboards. No payout record is ever sent to a brand — but on a campaign with one accepted creator, the spend figure the brand sees is that creator’s exact gross payout.
- Outcome rates we calculate for brand dashboards from how submissions were reviewed: the share of submissions a brand rejected, and the share it sent back for changes. On a campaign with one creator, those percentages describe that one named creator.

_Source: prisma/schema.prisma:9-27,110-155,164-185; lib/payout.ts:62,71-72,81-82 (the column is named `stripeTransferId`, but both writers store the payment intent’s `latest_charge` — a Stripe charge ID, not a transfer ID); app/api/webhooks/stripe/route.ts:68,77,214-222; lib/brand-metrics.ts:219,250-251,340-374_

## What your device sends **(needs list rendering)**

- Your IP address, on nearly every request. We use it to limit how often a single source can hit our API, which is how we keep abuse down. On the public waitlist form we also send it to Cloudflare for a bot check.
- A push notification token, if you allow notifications in the iOS app. It is the address your notifications are delivered to. We store it with the platform your device reports — “ios” on every build we ship, though the field accepts whatever the device says — the time your device registered, and a “last seen” time that is rewritten every time the app registers again. Nothing in the product reads that last-seen time today; it is a record of roughly when you last opened the app.
- Your session token, which keeps you signed in. On iPhone it is stored in the iOS Keychain. There is no Face ID or Touch ID lock on it.
- On the website only: page views, through Vercel’s analytics. It does not use cookies and does not follow you to other sites. Two extra events fire on the waitlist form: one when you submit your email, carrying only whether you arrived with a referral code, and one when you complete your profile, carrying your main platform, your niche and your follower range.
- On the website waitlist only: signals the Cloudflare Turnstile bot check gathers in your browser. That script loads on the waitlist page and nowhere else.
- In the iOS app, the category chip you pick on the Discover screen is sent to our server as part of the request for campaigns. The search box next to it filters on your phone, and what you type there never leaves the device.
- Whatever metadata is inside a photo or video you upload. We do not strip it ourselves — there is no metadata-stripping code anywhere in our repository. [UNVERIFIED: whether GPS coordinates or a capture time actually survive the trip. Your photo passes through Apple’s photo picker and our upload provider’s library before it reaches storage, and neither is our code; iOS pickers commonly drop location on the way out. Nobody has yet uploaded a geotagged photo and read the metadata back off the stored file, which is the only thing that settles it. Until someone does, this policy must not assert either that your coordinates travel with the file or that they do not — and the App Store “Location” label rests on the same unanswered question. See the note under “What the iOS app does not collect”.]

_Source: lib/request-security.ts:64-72; lib/turnstile.ts:36-39; mobile/src/lib/push.ts:104-113; app/api/v1/devices/route.ts:18-30; prisma/schema.prisma:29-40; mobile/src/lib/token-cache.ts:1-29; mobile/app.json:47; app/layout.tsx:3,55; app/waitlist/WaitlistForm.tsx:125-135,215-217,240-244; mobile/src/lib/queries/use-campaigns.ts:31,35; mobile/src/app/(app)/discover/index.tsx:114-125; grep for exif|strip-metadata across app, lib, packages, mobile/src → 0 hits_

## What our providers collect straight from you **(needs list rendering)**

Some information never passes through our servers at all. You give it directly to a company we use.

- Clerk, our sign-in provider, receives your email, your password, verification codes, and your Apple, Google or TikTok grant. It also sees your device’s IP address and browser details. Clerk serves profile photos, so it also sees the IP address of anyone whose screen those photos appear on — including creators browsing the campaign feed.
- Apple receives your Sign in with Apple request, if you choose it, and tells us — through Clerk — the identity it issued and the email address or relay address you allowed. This runs in Apple’s own sheet on your phone; we do not see what you type into it.
- Stripe receives a brand’s card details, typed into a Stripe form on the page. We never see or store a card number.
- Stripe also receives a creator’s full payout identity file — legal name, date of birth, address, tax ID, government ID and bank account — entered on Stripe’s own page. We create the account with only your email address, and Stripe tells us one thing back: whether you finished. [PLACEHOLDER: confirm what the Stripe dashboard exposes back to us about a connected account. The code never asks for it, but a reviewer will press on this, and the answer settles four App Store privacy labels at once.]
- UploadThing receives the actual bytes of your photos and videos, plus your device’s IP address, because your device uploads to them directly.
- Cloudflare receives the bot-check signals on the public waitlist form.

_Source: mobile/src/app/(auth)/sign-up.tsx:39; mobile/src/components/apple-sign-in-button.tsx:1-2,48; mobile/src/components/campaign-tile.tsx:195; app/(dashboard)/brand/campaigns/[id]/ApplicationActions.tsx:39-43; app/api/v1/stripe/onboard/route.ts:20-24; packages/shared/src/stripe-connect.ts:11; app/api/v1/uploads/route.ts:35-44_

## Why we use it **(needs list rendering)**

- To create and run your account, and keep you signed in.
- To run the marketplace: show campaigns, carry applications, move submissions and review notes between brand and creator.
- To charge brands and pay creators, and to keep the financial record of what was paid.
- To tell you what happened. We send eight kinds of email and seven kinds of push notification, covering application decisions, submission decisions, payouts, waitlist confirmation, referral milestones and invites. One email and one push notification state a dollar amount you have been paid, and a push notification shows on a locked screen by default.
- To review and admit waitlist members.
- To prevent abuse: rate limiting on nearly every request, and a bot check on the public waitlist.
- To handle payment disputes and refunds. When Stripe reports that a dispute was opened or closed, or that a charge was refunded, we email our own admin inboxes with the campaign, the amount, a short reason and status from Stripe, and the creator’s name — or the creator’s email address, if we do not hold a name for them.
- To support you, and to run the platform internally.
- To understand website traffic. This one is website-only. The iOS app sends us no usage data at all.

_Source: lib/email.ts:60,74,88,109,118-121,128,142,154-184,186; lib/push.ts:70-137; app/api/webhooks/stripe/route.ts:155-210 (dispute opened, dispute closed and charge refunded all call the same admin alert); :167 (`creatorName: application.creator.name ?? application.creator.email`); :169 (`detail` is a reason code plus a status string); app/api/waitlist/route.ts:59-71,130-148; lib/rate-limit.ts:71-72; app/layout.tsx:55_

## Our legal bases for using it

[ATTORNEY: this whole section is a legal judgement and has been left blank rather than guessed. Each purpose above needs a basis assigned. Four are genuinely contested and should not be treated as routine. (1) Payments sit across contract performance and a legal record-keeping obligation over the same data; those are two bases and probably need separating. (2) The waitlist confirmation, referral-milestone and invite emails go to people who have no account, never agreed to anything, and have no way to unsubscribe — no email we send carries an unsubscribe link or a List-Unsubscribe header. (3) Website analytics loads on every page of the site, without exception and without a consent step; the Cloudflare bot script is narrower — it is injected by the waitlist form component, so it loads on the waitlist page only. Neither is gated on consent, and there is no consent mechanism of any kind anywhere in the product, so “legitimate interests” versus “consent” is a real decision here, not a formality. Please reason about the two separately: they have different scopes. (4) Whether a legitimate-interests assessment needs to exist and be documented for waitlist vetting, abuse prevention and internal operations.]

_Source: grep for unsubscribe across app, lib, packages, mobile/src → 0 hits in any email template; app/layout.tsx:55; app/waitlist/WaitlistForm.tsx:125-135_

## Who we share it with **(needs list rendering)**

These are the companies that actually receive your information. Every one of them is in the code today. None of them is optional — there is no alternative provider configured for any of these jobs.

- Clerk — sign-in and sessions. Receives your email, password, verification codes, name, profile photo and session tokens, and sees your IP and browser at their edge. Clerk’s own software development kit also reports usage telemetry to a Clerk address; we have not switched that off, and our site’s security policy is written to permit it. [PLACEHOLDER: confirm in a live run whether that telemetry actually fires on the production site and what it carries. Then either disclose it here or switch it off. Do not publish a statement in either direction until someone has looked.]
- Stripe — payments and creator payouts. Receives your email when we create your payout account, the charge, fee and payout amounts, and our internal record IDs. Brands’ card details and creators’ identity documents go to Stripe directly, not through us. [ATTORNEY: confirm the split — Stripe is likely our processor for the charge instruction but an independent controller for its own identity and anti-money-laundering checks.]
- UploadThing (Ping Labs) — storage and delivery of uploaded photos and videos. Receives the file, whatever metadata is inside it, your IP address, and an identifier for you.
- Resend — sends our emails. Receives the recipient’s address and the whole body of the message. For a payout email that body includes the dollar amount. For an alert to our own admin inboxes about a dispute or a refund, it includes the campaign, the amount, a reason code and status from Stripe, and the creator’s name — or, if we hold no name for that creator, their email address, which means Resend can receive a second person’s address inside the body of a message.
- Expo — delivers push notifications, handing them on to Apple’s notification service. Receives your push token and the text of the notification, including the dollar amount on a payout notification. Expo also issues the push token in the first place, so its servers see your device when it registers.
- Apple — two separate things. If you choose Sign in with Apple, Apple receives that sign-in; it is not working for us there, it acts on its own account. And Apple’s notification service delivers every push notification to your iPhone, so it receives the delivery address and the text, including the dollar amount on a payout notification.
- Vercel — hosts the website and the API. Sees every request’s IP address, browser and URL, plus our server logs. Also provides the website analytics. Two things that reach those logs are worth naming: the internal account ID in an admin’s “view as” web address, and your push notification token in the address used to remove it. And when our email provider is not configured in an environment, the recipient’s address and the subject line of the message are written to that environment’s log instead of being sent.
- Neon — the database. Holds everything described in this policy that we store ourselves. [PLACEHOLDER: this one is named from our deployment configuration and runbooks, not from the code — the application only knows it is talking to a PostgreSQL database. Confirm the provider and the region before publishing the name.]
- Upstash — rate limiting. Receives keys containing your IP address, your internal account ID and your sign-in ID, held for about a minute at a time.
- Cloudflare — the bot check on the public waitlist form. Receives your IP address and the check’s signals.
- Svix — delivers sign-in events from Clerk to us. Those messages carry your sign-in ID, email, name and profile photo URL.
- Google and TikTok — only if you choose to sign in with them. They are not working for us; they act on their own account.

[PLACEHOLDER: confirm which of these are provisioned in production before publishing, with `vercel env ls production`. Two of them behave in ways worth stating precisely, because the earlier note here described both backwards. The deploy runbook records the Cloudflare bot-check credentials as empty in production as of 2026-09-07, independently confirmed by loading the live waitlist page; the Upstash credentials are recorded as missing. **An unconfigured bot check does not go quiet — it fails closed.** On a production deployment, every submission to the public waitlist form is refused with “Verification is not configured” before anything is read or stored. If the credentials are still empty, that is a live outage on the one form the production site exists to serve, not a dormant integration, and it should be fixed before anyone reasons about what Cloudflare receives. **Rate limiting, by contrast, does not stop when Upstash is absent** — it falls back to an in-memory limiter inside each running instance, so requests are still limited, just not across instances. What does stop is the egress: with no Upstash credentials, no IP address, account ID or sign-in ID is sent to Upstash at all. So today the Upstash bullet above describes a flow that is not running, and the Cloudflare bullet describes one that is rejecting everybody. Re-read both bullets once the credentials are set.]

[ATTORNEY: whether a written data processing agreement is in place with each of these. The repo’s own open-actions list still has “accept each vendor’s DPA in its dashboard” as an outstanding task, so assume none is executed until a dashboard shows otherwise.]

[ATTORNEY: the customer data processing agreement draft names five providers plus an unidentified database host. This policy names thirteen companies. A brand customer reading both gets a policy disclosing more third parties than the contract that governs their own data — Expo, Upstash, Cloudflare, Svix, Neon, Apple, Google and TikTok are all missing from that annex, and the annex’s footnote claims the list was verified against dependencies and environment variables, which cannot be right. Its list of data categories is short by the same margin: push tokens and device identifiers, IP addresses, payout amounts travelling inside emails and notifications, the brand’s written review of a named creator, whatever metadata rides inside uploaded media, and the entire waitlist dataset are all disclosed here and absent there — while the analytics it does list is the waitlist funnel, which is our own prospect data rather than the customer’s. The two documents have to be reconciled before either is signed or published.]

_Source: lib/email.ts:47-50 (when `RESEND_API_KEY` is unset the recipient address and subject are written to the log; note production currently holds a placeholder rather than an empty value, so on production the send is attempted and fails instead — the logging path is live in any environment where the key is absent), :47-58; lib/push.ts:36-42,127; lib/rate-limit.ts:78-81 (in-memory fallback when Upstash is absent); prisma/schema.prisma:5-7 and package.json:24 (the code knows only “postgresql” and the pg adapter; “Neon” appears only in env files and docs/runbooks/deploy.md:59, docs/runbooks/migrate.md:5); lib/turnstile.ts:25-27 and app/api/waitlist/route.ts:189-195,240-241 (503 fail-closed when unconfigured in production); next.config.ts:15 (the policy permitting Clerk telemetry); grep for CLERK_TELEMETRY_DISABLED → 0 hits; app/api/webhooks/clerk/route.ts:12-31; docs/BLOCKED-ON-JACKSON.md:80; docs/dpa-draft.md:79-88; docs/runbooks/deploy.md:60-73_

## Who else can see your information inside CreatorDocks **(needs list rendering)**

- The brand you apply to sees your name, your profile photo, your full pitch, the rate you proposed, and every submission you send them — the file, the caption, and the notes.
- The brand also sees spending figures we calculate from payouts. On a campaign with one accepted creator, that figure is your exact gross payout.
- The brand also sees rates we calculate from how it reviewed the work: what share of submissions it rejected, and what share it sent back for changes. On a campaign with one creator, those are figures about you.
- Any signed-in user can read the full text of any active campaign, including the target-audience and creator-requirements fields the brand wrote. This is not limited to creators who applied.
- A waitlist member sees the name and referral code of whoever referred them.
- Our admins can list every brand and creator with name, email and activity, view the whole waitlist, export it, and open any user’s dashboard read-only. That read-only view checks only the admin role — not the separate list of allowed admin email addresses that guards the internal pages — and nothing anywhere records that it happened. There is no audit log in this system.
- Two consequences of that worth saying plainly. Loading the internal waitlist page sends every waitlist row to the admin’s own browser, and one click downloads the whole table as a spreadsheet onto whatever computer they are using; nothing records who exported what, or when. And when an admin opens someone’s dashboard read-only, that person’s internal account ID travels in the web address, which means it is written into our host’s access logs. Since there is no audit log, those access logs are the only trace this leaves anywhere. The same is true of the address used to remove a push notification token, which carries the token itself.

[ATTORNEY: once a brand holds a creator’s pitch, rate, submission, caption and notes — and, on the defective route below, their email address and bio — we have no way to make the brand delete any of it. There is no control, no obligation in the terms of use, and no mechanism. A creator reading this page would reasonably assume otherwise, and the terms’ only brand-side content obligation (“never use a rejected creator’s content”) is itself unenforceable: the rejected submission stays on the brand’s dashboard with a working link to the file, indefinitely. Decide what to tell a creator about this, and decide whether an obligation on brands belongs in the terms.]

[PLACEHOLDER: one brand-facing route currently returns a creator’s entire account record — email address and bio included — when a brand saves an application without changing its status (`app/api/applications/[id]/route.ts:51-68`). Every brand-facing screen query is correctly narrow; this is a single route defect. Fix the route before this policy is published, or the first bullet above must also say that brands can receive your email address. Do not publish either version until this is resolved.]

_Source: app/(dashboard)/brand/campaigns/[id]/page.tsx:198; app/(dashboard)/brand/campaigns/[id]/applications/page.tsx:131-135 (caption and notes rendered to the brand); lib/brand-metrics.ts:250-251,340-374; app/api/v1/campaigns/[id]/route.ts:7-9; app/api/waitlist/route.ts:130-148; lib/admin-config.ts:29-31; lib/view-as.ts:30 (role check only, no email allowlist); app/internal/waitlist/page.tsx:41-51; app/internal/waitlist/export/route.ts:12-33; app/api/v1/devices/[token]/route.ts:6-9 (token in the path); twelve dashboard routes read `viewAs` from the query string; prisma/schema.prisma (no audit log model)_

## We do not sell your information

We do not sell your personal information and we do not share it with advertising networks or data brokers. There is no advertising SDK, no attribution SDK and no tracking framework anywhere in the iOS app, and we do not track you across other companies’ apps or websites. [ATTORNEY: confirm this survives the US state privacy law definitions of “sell” and “share”, which are broader than the ordinary meaning of the words.]

_Source: mobile/package.json:5-38; docs/platform-split/09-app-review-dossier.md:392-401_

## When the law requires us to hand something over

[ATTORNEY: this section does not exist yet and it needs to. Nothing in either document says that we may disclose information to comply with the law, to answer a subpoena or court order, or to protect someone’s safety or our own rights — which means any such disclosure today falls outside every purpose this policy states. Decide the wording, and decide the harder half with it: whether we tell a user when their information is handed over, and whether we say so here. There is no process behind either answer today. No request of this kind has been received, and there is no runbook for one.]

_Source: no legal-process, subpoena or law-enforcement handling anywhere in the repo_

## If the business changes hands

[ATTORNEY: also missing, and standard. If CreatorDocks is bought, merged, refinanced or wound up, personal information is one of the assets that moves — a creator’s uploaded face, a brand’s unreleased campaign brief. Decide what to promise: notice, a choice, or a commitment that the buyer stays bound by this policy. This is not describable from the code, which is exactly why it has been left for you rather than guessed.]

## Where your information is processed

[ATTORNEY: left blank on purpose. We cannot state a processing region for any of the thirteen companies listed above from the code, and no transfer mechanism has been confirmed for any of them. This section needs: which countries your information is processed in, whether standard contractual clauses or another mechanism is in place with each provider, and whether the answer differs for users in the EU, the UK or elsewhere. Do not publish a transfers section that names a region nobody has verified. The customer DPA draft’s subprocessor annex has six rows: five name a provider and say United States, and the sixth is an unfilled database-host row with no provider and no region. That document and this one must end up saying the same thing — and note that the annex is also missing eight of the companies this policy names, which is the bigger divergence of the two.]

_Source: docs/dpa-draft.md:79-88_

## How long we keep it

We do not currently operate a retention schedule. There is no scheduled job anywhere in this system that deletes or expires anything. In practice: we keep your account record for as long as you have an account, and the account row itself stays after you close it. We keep campaign, application, submission and payout records indefinitely, because they are the financial and contractual record of a completed transaction, and we keep them after an account closes. There is one exception, and it is the only record you can erase yourself: while an application is still pending, you can withdraw it from the app, and that deletes the row outright — the pitch and the rate go with it. Once a brand has accepted or rejected it, withdrawing is refused and the record stays. Uploaded photos and videos are kept indefinitely, including after an account is closed. Waitlist entries are kept indefinitely, including for people who never became users. Push notification records are removed when you close your account, when the notification service tells us the address is dead, and usually — but not always — when you sign out; see “Push notifications” below for why that last one is not a promise. Rate-limiting records last about a minute. We are working on a retention schedule and we will update this policy when one exists.

[ATTORNEY: whether “we are working on it” is an acceptable statement in a published policy, or whether a policy has to commit to periods. Also whether indefinite retention of uploaded media is defensible under any legal basis, given that a deletion mechanism is technically available from our storage provider and simply has not been built.]

[ATTORNEY: the customer DPA draft promises something this paragraph says we cannot do. Its section 4(8) commits us to delete or return all of a customer’s personal data at the customer’s election when the services end, and to delete existing copies. There is no mechanism for that: no campaign or submission deletion route exists anywhere in the product, no code has ever deleted a stored file, waitlist rows have no deletion path at all, and the DPA’s own security annex lists “formal data-retention schedule and automated deletion on request” as a gap. A customer electing deletion today cannot be served. Reconcile the clause with the product, or build the mechanism, before that agreement goes to anyone.]

[PLACEHOLDER: how long each of the thirteen providers keeps what we send them. Thirteen open questions; none can be answered from the code.]

[PLACEHOLDER: how long the database host keeps point-in-time history. The migration runbook takes a database branch before every migration, so values from before a deletion can survive in that history for some window. Nobody has confirmed the window.]

_Source: no vercel.json cron config; no app/api/cron directory; exactly four delete call sites in the whole codebase (app/api/v1/applications/[id]/route.ts:47, app/api/v1/devices/[token]/route.ts:16, app/api/_lib/account-deletion.ts:53, lib/push.ts:60); the withdraw path is app/api/v1/applications/[id]/route.ts:30-49 — creator role, ownership-checked, refuses anything but PENDING with a 409; grep UTApi|deleteFiles → 0 hits; grep waitlistSubmission.delete → 0 hits; docs/runbooks/migrate.md:102-112; docs/dpa-draft.md:38,71,106_

## Your rights, and which ones we can actually serve today **(needs list rendering)**

[ATTORNEY: which of these rights apply to which users depends on where they live and how this business is characterised. The list below is what the system can and cannot do, not a statement of who is entitled to what.] We would rather tell you what we can do than promise something we cannot perform.

- Seeing what we hold. Creators can see their profile, applications, submissions and payouts in the app, screen by screen. Brands can see their name and email in settings, and their campaigns and applications in the dashboard. There is no single view of everything we hold, and no way to see it all at once. If you joined the waitlist, you saw your entry once — the form shows you everything it stored at the moment you submitted it, and again when you complete your profile — but you cannot look it up again afterwards. Coming back and typing your address in tells you only that the address is already on the list. That is deliberate: it stops anyone using the form to find out whether a given email address is on it.
- Correcting it. Creators can change their name and bio in the app. Nobody can change their email address or profile photo in the product; both come from your sign-in account and are overwritten each time we re-link it. Brands can change one thing in settings — their account type, switching between brand and creator — and only while they have never launched a campaign or sent an application. Nothing else on that page is editable. Waitlist entries cannot be corrected once the profile is complete.
- Deleting it. Creators can delete their account in the app, with one gap worth naming: because we only create an account record the first time you get past the invite gate, someone who signed up but never got that far has a sign-in with no record behind it, and for them the delete control is out of reach — the app never shows the Profile tab, and the delete request would be refused anyway. If that is you, email us. Brands have no delete control and have to ask us. Waitlist entries cannot be deleted at all — no route, no admin tool, no manual database path that anyone has built. See the two sections below.
- Getting a copy to take elsewhere. There is no self-serve export for any user. We cannot serve a portability request from inside the product today. The one export that exists is an admin-only spreadsheet of the entire waitlist table; it is a tool for us, not a route for you, and it is described under “Who else can see your information” above.
- Withdrawing something you sent. If you are a creator and your application is still pending, you can withdraw it in the app and the record is deleted outright. Once a brand has accepted or rejected it, that stops being possible.
- Telling us to stop emailing you. There is no unsubscribe link in any email we send, no notification preference in the app, and no way to opt out of a message type. Turning notifications off in your iPhone settings, or signing out, is the only control that exists. We cannot serve an objection to messaging today.
- Asking us to pause or restrict use of your information. There is no suspend or freeze state in this system for a user or for a waitlist entry. We cannot serve this today.
- Complaining to a regulator. [PLACEHOLDER: whether to name a lead supervisory authority, and which one. Depends on the entity and representative questions above.]

[ATTORNEY: none of the US state privacy scaffolding is here, and it is all missing rather than deliberately omitted. There is no notice at collection, no table of the categories of personal information collected and disclosed and to whom, no named consumer rights (know, delete, correct, opt out, non-discrimination), and no authorised-agent route. Also missing, and specific to this product: the referral programme gives a benefit in exchange for personal information, which is the shape a Notice of Financial Incentive exists for. Decide which state regimes apply, then decide how much of that scaffolding this page carries and how much lives on a separate one.]

_Source: app/api/v1/me/route.ts:7-15,24-41,99-100; lib/mobile-api-guard.ts:163-164; app/api/v1/onboarding/route.ts:69-82 (account records are created lazily, behind the invite gate); app/(dashboard)/brand/settings/page.tsx:14,48-56 (`canChangeRole`, `ChangeRoleControl`); app/api/v1/applications/[id]/route.ts:30-49; app/internal/waitlist/export/route.ts:12-60; app/api/waitlist/route.ts:123-129,131-147,278-283,316,333-339,371-378; prisma/schema.prisma:62-73; lib/email.ts (no unsubscribe in any template)_

## How to make a request

Email [PLACEHOLDER: whether privacy requests go to support@creatordocks.com or to a separate address such as privacy@creatordocks.com]. We will respond within [PLACEHOLDER: response commitment for privacy requests. Thirty days is the common one, but it is a commitment, so it is Jackson’s to make]. [PLACEHOLDER: how we verify that a requester is who they say they are, before we hand over or delete anything. This one is load-bearing. There is no verification procedure today, and “email us and we will send you your data” is itself a disclosure risk without one — the waitlist form is already deliberately built to refuse to confirm whether an address is on the list, for exactly this reason.] Today there is one support inbox, no ticketing system and no runbook behind it: a request for everything we hold is answered by a person reading the database.

_Source: app/support/page.tsx:13; app/api/waitlist/route.ts:105-128; docs/dpa-draft.md:107_

## Deleting your account, exactly as it works

In the iOS app, open Profile, tap Delete account, and confirm twice. It happens immediately. It is not a request and no one reviews it. Three things then happen. First, if a payout to you is still on its way, we refuse and change nothing — see the next section. Second, we delete your sign-in at Clerk. [UNVERIFIED: the app’s own dialog tells you this ends every session on every device. That is our sign-in provider’s behaviour, not ours, and nothing in our code can prove it. Confirm it with Clerk — including how long an already-issued session token stays valid — before this policy or that dialog states it as fact.] If that step fails we stop and write nothing at all; your account is exactly as it was. Third, in one database operation we delete every push notification record for you and overwrite the identifying fields on your account: your name, profile photo and bio are cleared, your Stripe pointer is cleared, your payout-setup flag is reset, your email address is replaced with an undeliverable placeholder, and your sign-in reference is replaced with a placeholder. If you delete your account from Clerk’s side instead, the same clean-up runs — but that path does not check for a payout in flight.

One group cannot use this at all. We create your account record the first time you get past the invite gate, so if you signed up and stopped before then, there is a sign-in with nothing behind it: the app never shows you the Profile tab, and the delete request would be refused even if something could send it. If you are in that position, email us and a person removes the sign-in by hand. [PLACEHOLDER: this is a real gap, not a wording problem — Apple’s rules require in-app deletion for anyone who created an account. Decide whether the fix ships before this policy does; the repo tracks it as an App Store blocker.]

_Source: mobile/src/app/(app)/profile/index.tsx:90-118; app/api/v1/me/route.ts:98-141 (:99-100 returns 404 with no account record; :112-113 the Clerk call; :83 the in-code comment claiming session revocation); lib/mobile-api-guard.ts:163-164; app/api/v1/onboarding/route.ts:73-82; app/api/webhooks/clerk/route.ts:60-62,74-96; app/api/_lib/account-deletion.ts:30-56; docs/platform-split/pii-inventory.md:177,451_

## When we will not let you delete your account

If a payout to you is being processed, we refuse the deletion and nothing is changed anywhere. (The check also covers a “pending” payout state, but nothing in the product ever puts a payout in that state, so in practice this is a block on payouts that are processing.) You can delete your account once the money lands, usually within a few business days. Two things you should know about this. We do not record that you asked, so if you do not come back and try again, nothing happens. And the app currently replaces our explanation with a generic “couldn’t delete your account, please try again”, so you may not be told this is the reason. [PLACEHOLDER: this app-side message is a small fix and it matters more than this paragraph does. A person who cannot find out why deletion failed will reasonably conclude it is broken.]

_Source: app/api/v1/me/route.ts:56,62-63,102-109; lib/payout.ts:74,84 and app/api/webhooks/stripe/route.ts:69,78,139,147 (every writer sets PAID, PROCESSING or FAILED; PENDING is the schema default and is never written); mobile/src/app/(app)/profile/index.tsx:115_

## What deleting your account does not reach **(needs list rendering)**

Deleting your account is not full erasure, and we would rather say so than imply otherwise.

- Your account record itself stays, including your internal account number, your role, and the dates you joined and were last updated. Everything below stays attached to that number, which means these records are still linked to one person even though the name has gone. [ATTORNEY: this is pseudonymisation, not anonymisation, and data protection obligations continue to apply to it. The word “anonymized” currently appears in the app’s own deletion dialog and overstates what happens; confirm the characterisation, then make the policy, the dialog and the customer DPA all say the same thing.]
- Every application you sent stays: your pitch, your proposed rate, the outcome. The exception is an application still pending at the moment you withdrew it — withdrawing deletes that one outright, and it is the only record in the system you can erase yourself.
- Every submission stays: the file, your caption, your notes, and the brand’s written review of your work.
- Every payout record stays: the amount, our fee, the status, and Stripe’s reference for the charge — which is also, as the bullet below explains, the last route back to your Stripe account from our side. These are kept deliberately, as the financial record of a completed transaction.
- If you were a brand, every campaign you posted stays.
- Every photo and video you uploaded stays. Nothing in this system deletes an uploaded file, ever, under any circumstance. The submission record keeps a working link to each one. [PLACEHOLDER: check whether a stored file URL is reachable without signing in. Nothing in the code configures a private bucket, a signed URL or an access rule. Until someone actually fetches one in a private browser window and records the result, this policy should say the file is retained, and should not claim it is protected.]
- Your Stripe payout account is not closed. We clear our pointer to it, and nothing deauthorises or closes the account itself. If you want it closed, you have to do that with Stripe.
- If you signed in with Apple, Google or TikTok, deleting your CreatorDocks account does not revoke that connection. You revoke it yourself: for Apple, in Settings → your name → Sign in with Apple → CreatorDocks; for the others, in your own Google or TikTok settings.
- A push notification already handed to the notification service can still arrive on your phone after your account is gone. The delivery address held by the notification service itself is not revoked either — we delete our copy, not theirs.

_Source: app/api/_lib/account-deletion.ts:24-40,53; grep UTApi|deleteFiles|utapi over app, lib, packages, mobile/src, prisma → 0 hits; mobile/src/app/(app)/profile/index.tsx:93,110-113; mobile/src/components/apple-sign-in-button.tsx:39-48_

## If you are a brand

There is no delete control anywhere in the brand dashboard. To close a brand account you have to email us, and a person removes the sign-in identity by hand, which triggers the same clean-up described above. [PLACEHOLDER: confirm whether a web-only brand account has any self-serve deletion path at all. The deletion endpoint lives on the mobile API surface, and no web equivalent was found. Whatever the answer, it has to match the terms of use, which state the same thing without the caveat — the two documents cannot go out disagreeing about whether this is known. Note also that the mechanism a brand is being pointed at is an undocumented manual operation: there is no runbook for it.]

Brands can, however, change one thing themselves. While a brand account has never launched a campaign and never sent an application, the settings page offers a control to switch the account between brand and creator. After the first campaign or application, the control disappears.

_Source: app/api/v1/me/route.ts:98; app/(dashboard)/brand/settings/page.tsx:14,48-56; app/(dashboard)/ChangeRoleControl.tsx:17-20; app/api/webhooks/clerk/route.ts:74-96_

## If you joined the waitlist

We keep your entry indefinitely and there is no way to delete it. Not through the website, not through an admin tool, not through any route that exists. You cannot look your entry up again after you submit it, and you cannot correct it once your profile is complete. We also record a status against your name — new, contacted, approved or invited — which is an internal judgement about you, made by a person, kept forever, and never shown to you. There is no “do not contact” state; the list has no way to record that you asked us to stop. We send you a confirmation email, an email when you have referred three people, and an invite email when your spot opens, and none of those emails contains an unsubscribe link. This is the widest gap between what we collect and what you can do about it, and it is stated here rather than hidden. [ATTORNEY: this is the sharpest legal-basis question in the document — messages to people who have no account, gave no consent, and have no way to stop them. It is also a product gap. Decide whether the fix ships before this policy does.]

_Source: prisma/schema.prisma:41-60,68-73; app/api/waitlist/route.ts:123-129,245,288,316; app/api/waitlist/[id]/route.ts:48-62; lib/email.ts:128-152,186; grep unsubscribe over lib/email.ts → 0 hits_

## The CreatorDocks iOS app

Here is everywhere the app connects. Our own API. Clerk, for signing in. Apple, if you use Sign in with Apple — that runs as a native Apple flow to Apple’s own servers. UploadThing, for uploading your photos and videos. Clerk’s image server, for the brand logos you see on the campaign feed, which means Clerk sees your device’s IP address while you browse campaigns. Expo, if you allow notifications, to issue the delivery address your notifications are sent to. And an in-app browser window, which opens two kinds of page: Stripe’s hosted payout-setup page, and our own privacy, terms and support pages on the website. [PLACEHOLDER: Clerk’s software development kit may also report usage telemetry from inside the app. It is not switched off. Confirm what it sends, then add it to this list or disable it — do not publish a closed list of destinations that a network capture can extend.]

The app asks for two permissions: access to your photo library, so you can upload content, and permission to send you notifications. It asks for nothing else. Camera and microphone access are switched off in the app’s own configuration, and the app cannot use either, no matter what it is asked to do. Your session token is stored in the iOS Keychain. The search box on the Discover screen filters on your phone; what you type never leaves the device — though the category chip beside it is sent to our server, because it changes which campaigns come back. Brands never pay inside the app; there is no purchase path of any kind in it.

_Source: mobile/src/lib/api-client.ts:133,171-178; mobile/src/components/apple-sign-in-button.tsx:48; mobile/src/components/campaign-tile.tsx:195; mobile/src/lib/push.ts:55,95-101; mobile/src/app/(app)/earnings/index.tsx:96 and app/api/v1/stripe/onboard/route.ts:38 (Stripe’s page in an in-app browser); mobile/src/app/(app)/profile/index.tsx:66 with mobile/src/constants/links.ts:8-13; mobile/app.json:47,53-55,58; mobile/src/app/(app)/discover/index.tsx:114-125; mobile/src/lib/queries/use-campaigns.ts:31,35; next.config.ts:15 and grep CLERK_TELEMETRY_DISABLED → 0 hits_

## Push notifications

If you allow notifications, your phone gives us a delivery address for them and we store it with your account. We send seven kinds of notification. Six of them mention a campaign or say something generic. One of them states the amount you have been paid, in the form “[amount] is on its way to your account” — and because iPhones show notification text on the lock screen unless you tell them otherwise, that figure can be read without unlocking the phone. That is your iPhone’s default, not a setting we choose; we do not mark these notifications as private. The only way to turn notifications off is in your iPhone settings, or by signing out. There is no notification preference in the app.

Deleting your account removes the delivery address, in the same operation that clears your profile. Signing out usually removes it too, but that one is best-effort rather than guaranteed: the app can only withdraw an address it registered during that same run, so if you have relaunched the app since, signing out leaves the address in place, and the attempt fails silently either way. It is then removed the next time a notification to it bounces. If this matters to you, turn notifications off in your iPhone settings — that is the control that always works.

None of this is running yet. Until the app’s build configuration carries a push project ID, the app never asks for a notification token and no delivery address is collected at all. [PLACEHOLDER: sequence this section against the same switch the effective date raises. If the policy publishes before that configuration lands, this section describes a collection nobody can trigger — which is not wrong, but it should be a decision.]

_Source: mobile/src/lib/push.ts:27,75-88,104-113,116-133 (module-scope `registeredToken`; the early return at :118; the `__DEV__`-only catch at :129-132); lib/push.ts:41,49-61,124-129 (the payout body is `${formatCents(params.netAmount)} is on its way to your account.`; `sound: 'default'` is the only presentation setting; server-side pruning on `DeviceNotRegistered`); app/api/_lib/account-deletion.ts:53_

## Photos and videos you upload

Your files are stored by UploadThing and delivered from their network. Your phone uploads to them directly, so they see your IP address as well as the file. We do not strip metadata from your files — there is no code anywhere in our system that removes it. [UNVERIFIED: what that means in practice. If a photo still carries GPS coordinates, a capture time or a device model when it leaves your phone, all of that travels with the file to storage and on to the brand who receives your submission. Whether it still carries them is not something we can answer from our own code: the file passes through Apple’s photo picker and our upload provider’s library first, and iOS pickers often drop location on the way out. This has to be settled by test — upload a geotagged photo and read the metadata back off the stored file — not by argument. Until then this policy says only that we do not remove metadata ourselves, and it must not tell you either that your coordinates reach a third party or that they do not.] Nothing in this system deletes an uploaded file, including after you close your account. If your content shows other people, they have not agreed to anything here — we do not ask them, and nothing in the flow prompts you to. [ATTORNEY: whether the policy, the terms, or both should place an obligation on the creator to have permission from anyone appearing in uploaded content.]

_Source: app/api/v1/uploads/route.ts:35-44; mobile/src/components/content-upload-field.tsx:54-58; no metadata-stripping code anywhere in the repo_

## What the iOS app does not collect **(needs list rendering)**

This is unusual enough to say out loud, and it is what our App Store privacy labels rest on.

- No analytics tool of any kind is installed in the app. It sends us no usage data, no screen views, no interaction events.
- No crash reporting or diagnostics tool is installed. Nothing about a crash leaves your phone.
- No advertising identifier, no tracking framework, no attribution tool. There is no code path in the app that could produce one.
- No location access and no contacts access. Neither module is installed, and the app never asks your phone for either.
- No payment code. Your bank and identity details are entered on Stripe’s own page in a browser window, and the app is told one thing back: whether you finished.

[PLACEHOLDER: the location line above and the metadata paragraph two sections up are in tension, and Apple will read both. “No location access” is true of the app: it never asks your phone for your position. It is a different question whether coordinates already embedded in a photo you upload count as location data being collected — and that question decides whether the App Store privacy label for Location can stay “No”. The label’s current justification is that no location module is installed, which answers the first question and not the second. Settle the metadata test first, then make the label answer a stated judgement rather than a search for a missing module. The honest shortcut, if the test comes back badly, is to strip the metadata on our side and delete the ambiguity.]

[PLACEHOLDER: before publishing, confirm whether the image library caches downloaded images to disk on the device. Nothing sets a cache policy and nothing clears one; sign-out and account deletion clear only in-memory data. Until someone checks, this policy must not claim that nothing else is stored on your phone.]

_Source: mobile/package.json:5-38; mobile/app.json:54-55; packages/shared/src/stripe-connect.ts:11; mobile/src/app/(app)/profile/index.tsx:77-88; docs/platform-split/09-app-review-dossier.md:386,441-445_

## Cookies and analytics

On the website, we use cookies to keep you signed in. We measure page views with Vercel’s web analytics, which does not use cookies and does not build a profile of you across other websites. That analytics runs on every page of the site, including this one. Two extra events fire when you use the waitlist form: one when you submit your email address, carrying only whether you arrived with a referral code, and one when you complete your profile, carrying your main platform, your niche and your follower range. The Cloudflare bot-check script is narrower — the waitlist form loads it itself, so it runs on the waitlist page and nowhere else. There is no cookie banner and no consent control anywhere on the site. The iOS app has no analytics at all. [PLACEHOLDER: confirm that web analytics is actually switched on for the production project — the code is in place but it is also a project-level setting.] [PLACEHOLDER: confirm what, if anything, the sign-in provider sets in a logged-out visitor’s browser on a public page like this one, and whether its software development kit reports telemetry from the site. Neither is switched off, and the site’s security policy is written to allow the telemetry address. Do not publish a statement in either direction until someone has looked.]

_Source: app/layout.tsx:3,48,55 (site-wide); app/waitlist/WaitlistForm.tsx:125-135 (the Turnstile script is appended from inside the form component), 215-217, 240-244; next.config.ts:15_

## Decisions about you

No decision about you is made automatically. Every decision that matters is made by a person: a brand decides whether to accept your application, a brand decides whether to approve your work, and a payment is released because a person approved it. There is no model, no scoring system and no automated judgement anywhere in this product, and nothing here decides anything about you without a person doing it.

We should be precise about one thing, because “profiling” is a word people read literally. Some figures we calculate do describe named people. Our internal waitlist page ranks the top five referrers by name and counts the list by niche, platform and follower range. Brand dashboards carry the share of submissions a brand rejected and the share it sent back for changes, which on a small campaign is a figure about one creator. And our internal user list shows a count of campaigns and applications next to every name and email address. None of that feeds an automated decision — a person still decides — but it is derived information about identifiable people and it is fair to say so.

_Source: lib/payout.ts:6-59; app/internal/waitlist/AdminWaitlistDashboard.tsx:129-134,136-152; lib/brand-metrics.ts:219,250-251; app/internal/users/page.tsx:13-19; docs/platform-split/pii-inventory.md:182-195_

## How we protect it

Traffic to the site and the API is served over HTTPS. Card numbers never touch our servers. Signed-in requests are checked against the role the action needs, on most of the routes that write something — but not all of them, and we would rather say so than round it up: the public waitlist form takes no sign-in and performs no role check at all, and the route that deletes your own account checks that it is you without checking your role. Incoming messages from Stripe and Clerk are signature-verified. Requests are rate-limited. But no online system can promise absolute security, and there are things we do not have yet: there is no central audit log of administrative actions, no incident-response runbook, and no independent security certification.

Two more things belong in an honest version of this section. Development, preview and production all use the same database, so the same live records are reachable from a developer’s machine and from any test deployment. And outside production, our database layer writes the queries it runs — including the values in them — into that environment’s logs, which means real names and email addresses can end up in a log that is not a production log. Neither of those is a hypothetical; both are how the system is set up today.

[ATTORNEY: how much of that gap list belongs in a public privacy policy as opposed to a customer data processing agreement. The DPA draft already lists these gaps and instructs that they must not be represented as complete; whatever is decided, the two documents must agree. Two specific mismatches to settle in the same pass. First, that agreement’s security annex states that role-based authorization is enforced on every write-side endpoint independently — the paragraph above explains why that is too strong, and a brand’s security reviewer will read both documents together. Second, the shared-database and non-production logging facts above mean the environments are not segregated; nothing in either document may imply that they are.]

[ATTORNEY: there is no breach-notification statement to users anywhere in this policy, while the customer DPA commits to telling a brand customer within a set number of hours. A commitment to customers that the users’ own policy does not mirror is a gap in both directions. Decide what users are told, when, and by what means — bearing in mind that there is no alerting, no incident-response runbook and only console logging behind whichever clock is chosen.]

_Source: next.config.ts:5-33 (the security headers actually set: content security policy, referrer policy, no-sniff, frame options, permissions policy — there is no strict-transport-security header and no HTTP-to-HTTPS redirect in the code; HTTPS is enforced by our host, not by anything in this repository); app/api/waitlist/route.ts:211-292 with proxy.ts:19 (public, no auth, no role check, writes a row); app/api/v1/me/route.ts:98 (no role option); lib/prisma.ts:13; docs/runbooks/migrate.md:3-9; docs/PROJECT-STATE.md:122; docs/dpa-draft.md:36,94,101-107,116_

## Children

[PLACEHOLDER: the minimum age to use CreatorDocks. There is no age check anywhere in this product today — no date-of-birth field, no age gate on sign-up, nothing stopping a minor from joining the waitlist or creating an account. Setting an age here is not just a sentence in a policy; it needs a matching check in the product, and it has to line up with the App Store age rating. Candidates worth weighing: 13 with parental consent, 16, or 18 given that creators receive payments and complete financial identity checks.] [ATTORNEY: whether the absence of any age screen creates exposure under US children’s privacy law, and what the equivalent analysis is in Europe. Do not put an age statement in this policy that the product does not enforce.]

_Source: grep for age of|under 13|under 18|coppa|date of birth across app, lib, packages, mobile/src → 0 non-test hits; docs/platform-split/09-app-review-dossier.md:579-594_

## Changes to this policy

[ATTORNEY: what this clause should promise. There is no version number, no change history and no record anywhere that any user ever saw any version of this policy. A promise to notify users of changes needs a mechanism behind it, and none exists today. Decide the notice method, the notice period, and whether earlier versions are archived — then say only what can actually be done. The same gap is already load-bearing elsewhere: the customer data processing agreement promises a brand thirty days’ notice before a new subprocessor is added, and there is no subprocessor page to subscribe to and no mailing mechanism behind either promise. One decision should cover both.]

_Source: app/privacy/page.tsx (no effective date, no version); docs/dpa-draft.md:46; no docs/legal history before this draft_

## Contact

Questions about this policy, or a request about your information, can be sent to [PLACEHOLDER: the privacy contact address]. [PLACEHOLDER: postal address of the legal entity.] [PLACEHOLDER: EU or UK representative, if one is required and appointed.]

_Source: app/support/page.tsx:13_
