**DRAFT — NOT REVIEWED BY A LAWYER. NOT IN FORCE. DO NOT PUBLISH.**
Written 2026-09-08 against commit `6a2b3eb` ("chore: override effect to 3.20 and record the UploadThing rollout", 2026-09-08). The working tree also carried uncommitted edits to five tracked files — CI config, two docs files (`docs/PROJECT-STATE.md`, `docs/vercel-domain-launch.md`), the mobile Discover screen and its test — plus six untracked paths: this `docs/legal/` folder, `docs/web-redesign-2026-09/mockups/`, `mobile/src/lib/pull-refresh.ts` and its test, `prisma/set-role.mjs`, and a stray `app/(dashboard)/creator/payouts/page 2.tsx`. None of them changes a flow described here. The stray dashboard file is a duplicate of the payouts page; because it is not named `page.tsx` it does not create a route. Verified with `git status --porcelain`. This text replaces nothing until an attorney has reviewed it and Jackson has filled every placeholder.

**Nobody who wrote this is a lawyer.** Every section below describes what the code actually does. Every place a legal position would have to be taken, the position has been left out and marked, not invented.

---

### How to read this draft

- Everything under a `##` heading is one section of the finished page. The prose under it is the section body.
- `[PLACEHOLDER: …]` marks a value only Jackson can supply. Nothing was guessed.
- `[ATTORNEY: …]` marks a legal decision. No warranty, liability, indemnity, governing-law or arbitration position has been drafted.
- `[UNVERIFIED: …]` marks a factual claim that cannot be settled from this repository — vendor behaviour, or something only an empirical test can answer. It is neither asserted nor denied, and each one names the check that would resolve it. Resolve them; do not delete them.
- Lines beginning `_Source:_` are drafting apparatus, not published text. **Delete them when the text is applied to the page.**
- Sections marked **(needs list rendering)** use bullets, which the current page component cannot render. See `README.md` in this folder.

---

## Effective date

These terms take effect on [PLACEHOLDER: effective date] and replace the version published before that date. [PLACEHOLDER: these terms describe how the product behaves today. There is an open decision about the money model — keep the card hold and handle its expiry, or charge the brand at acceptance and transfer at approval. Those are two different products and they need two different sets of terms. This draft describes the first, because that is what the code does. If the decision goes the other way, the fees and payment sections have to be rewritten before anyone publishes them.]

_Source: docs/BLOCKED-ON-JACKSON.md:88; docs/production-readiness-2026-09-06.md:268_

## Who these terms are between

These terms are an agreement between you and [PLACEHOLDER: registered legal entity name, entity type, country of incorporation, and registered postal address. Nothing in the product names a company today, and terms of use need a named counterparty]. They apply whether you use CreatorDocks as a brand, as a creator, or as someone on the waitlist. [ATTORNEY: what form of agreement is needed for these terms to bind, and whether it has been obtained. Today neither the iOS sign-up screen nor the web sign-up card shows these terms or asks anyone to agree to them, and nothing in the database records that any user ever accepted any version. The web card is the one worth checking carefully, because it looks at first glance as though it does: the sign-up component is passed a link to this page and to the privacy policy — but under a key the sign-in provider does not recognise, so it is ignored and no link is rendered. That is a one-word code fix and it is tracked as a blocker. The iOS sign-up screen has no legal link at all. This bears directly on whether the liability, arbitration and indemnity clauses below are enforceable at all, so it is the first question to settle, not the last.]

_Source: mobile/src/app/(auth)/sign-up.tsx:127-186; docs/platform-split/09-app-review-dossier.md:666; lib/clerk-appearance.ts:22-29 (`privacyPageUrl` and `termsPageUrl` sit under `options:`; the provider’s appearance type has no `options` key — they belong under `layout:`, confirmed against `node_modules/@clerk/shared/dist/types/index.d.ts:5605,5679,5689` for the installed @clerk/nextjs 7.6.1); app/(auth)/sign-up/[[...sign-up]]/page.tsx:47-48; prisma/schema.prisma:9-27 (no consent or accepted-terms field on the user record)_

## What CreatorDocks is

CreatorDocks is a venue. Brands post campaign briefs. Creators read them, apply, and name the price they want. If a brand accepts, we take a hold on the brand’s card, the creator delivers the work, the brand approves it, and we release the payment. That is the whole service. The agreement to make content for money is between the brand and the creator. We are not a party to it. We do not employ or engage creators, we do not commission the content, and we are not buying it and reselling it.

_Source: app/api/campaigns/route.ts:86-115; prisma/schema.prisma:116-117; app/api/stripe/create-intent/route.ts:102-116; lib/payout.ts:55-107_

## What CreatorDocks does not do **(needs list rendering)**

We would rather set expectations honestly than describe a service we do not run.

- We do not check campaign briefs before they go live. A brand posts a brief and it is immediately visible.
- We do not review, moderate or approve submitted content. The only person who reviews a creator’s work is the brand that commissioned it.
- We do not vet brands or creators beyond deciding who gets an invite off the waitlist.
- We do not guarantee that any creator will apply to your campaign, that any brand will accept your application, that content will be approved, or that anyone will be paid.
- We do not decide who is right when a brand and a creator disagree. We have no mediation process, no review board and no appeal.
- We do not monitor whether published content complies with advertising rules, platform rules, or the brief.

_Source: app/api/campaigns/route.ts:111; prisma/schema.prisma:102-108; app/api/submissions/[id]/route.ts:63-65; no reporting, moderation, or dispute endpoint anywhere in the repo_

## Who can use CreatorDocks

You must be at least [PLACEHOLDER: minimum age. There is no age check anywhere in this product — no date-of-birth field, no gate on sign-up or on the waitlist. Whatever number goes here needs a matching check in the product, and it has to line up with the App Store age rating. Weigh 18 seriously: creators receive payments and complete financial identity checks with Stripe.] to use CreatorDocks. If you are using it on behalf of a company, you must have the authority to bind that company. Access to the marketplace is currently by invitation, and we decide who is invited. In practice that invitation is an email address on a list we keep, and the list is checked by our server every time you act: creating an account, reaching the marketplace, and uploading anything all fail if your address is not on it. So an account can exist and still be unable to do anything until we add the address, and we can remove an address at any time. [ATTORNEY: whether the age statement needs jurisdiction-specific handling, and whether the absence of any enforcement mechanism today creates exposure. Do not publish an age this product does not enforce.]

_Source: grep for age of|under 13|under 18|date of birth across app, lib, packages, mobile/src → 0 non-test hits; prisma/schema.prisma:68-73; lib/admin-config.ts:60-80; app/api/v1/onboarding/route.ts:69-71; app/api/v1/uploads/route.ts:21; app/api/uploadthing/route.ts:23_

## Your account

You are responsible for your account: keeping your details accurate, keeping your sign-in secure, and everything that happens under it. Sign-in is handled by Clerk. In the iOS app you can sign in with an email and password, with Sign in with Apple, with Google or with TikTok; on the web, with an email and password, Google or TikTok. One thing worth knowing: if you sign in with an identity we do not recognise but the email address matches an existing account, we attach that sign-in to the existing account and refresh the name and photo from the provider. That makes your email address the thing that identifies you to us, which matters if you use Sign in with Apple and choose Hide My Email — the relay address Apple issues becomes your account’s address, and turning the relay off later leaves us with an address that no longer reaches you. There is no way to change your email address in the product. Do not share an account, and use a different email address for a different account.

_Source: mobile/src/app/(auth)/sign-in.tsx:36; mobile/src/components/oauth-buttons.tsx:19-22,121; mobile/src/components/apple-sign-in-button.tsx:34-48 (iOS only by construction; the web sign-in has no Apple option); mobile/app.json:12,32; lib/current-app-user.ts:15-39_

## How a campaign works

A brand writes a brief: what the campaign is, what should be delivered, who it is aimed at, what the deadline is, what usage rights the brand wants, how many creators are needed, and a budget. The brief goes live immediately and any signed-in user can read all of it. Creators apply with a pitch and the rate they want to be paid. A creator can withdraw an application while it is still pending, and doing so deletes it — the pitch and the rate go with it, and it disappears from the brand’s list. Once a brand has accepted or rejected it, withdrawing is no longer possible. The brand reads the applications and decides. The budget is a hard ceiling, not a guide: once the accepted rates on a campaign add up to the budget, no more applications can be accepted. Once the brand has accepted as many creators as the brief asks for, the campaign stops taking applications.

_Source: app/api/campaigns/route.ts:8-21,111; app/api/v1/campaigns/[id]/route.ts:7-9; app/api/v1/applications/[id]/route.ts:30-49; app/api/applications/[id]/route.ts:105-142_

## Accepting an application

A brand cannot accept a creator without paying for it first. When a brand clicks accept, we create a payment for the creator’s full proposed rate and ask the brand to put a card on it. The card is authorised, not charged. If that authorisation is not in place, the acceptance is refused. A creator also cannot be accepted at all until they have finished Stripe’s payout setup, because there would be nowhere to send the money. If a brand rejects an application, we release the hold.

_Source: app/(dashboard)/brand/campaigns/[id]/ApplicationActions.tsx:106-128; app/api/stripe/create-intent/route.ts:102-116; app/api/applications/[id]/route.ts:79-101_

## Delivering and reviewing the work

Once accepted, the creator delivers by submitting the content — a link to it, plus an optional caption and notes. The brand then does one of three things: approve it, ask for changes with a note, or reject it with a note. There is no chat, no inbox and no messaging feature here, but three free-text fields do carry words between the two of you: the caption and the notes you send with a submission, both read by the brand, and the brand’s review note, read by you. The review note is the only one that travels from the brand to the creator. Treat all three as the whole of the written record: they are kept indefinitely, and the privacy policy explains that your caption and notes stay readable by the brand even after you close your account. There is no limit on how many rounds of changes a brand can ask for, and no deadline on the loop. Approval is final: an approved submission cannot be moved back to any other state, by anyone.

_Source: app/api/submissions/route.ts:74-83; app/api/submissions/[id]/route.ts:15-16,73-119; packages/shared/src/submission.ts:10-11 (caption and notes, up to 2,000 characters each); prisma/schema.prisma:142-149; app/(dashboard)/brand/campaigns/[id]/applications/page.tsx:131-135 (both rendered to the brand); lib/payout.ts:23-29_

## What happens to the money at each step

Nothing is charged when a brief is posted, and nothing is charged when an application is rejected. When a brand accepts a creator, the brand’s card is authorised for the creator’s full rate — held, not taken. When the brand approves the work, and only then, the card is charged and the payment is released to the creator. If the brand asks for changes, nothing is charged and the hold stays where it is. If the brand rejects the submission, nothing is charged, but the hold is not released either — it stays on the brand’s card until it expires on its own. That is not a refund, and no refund is created, because no charge was ever made.

_Source: lib/payout.ts:55-91; app/api/submissions/[id]/route.ts:101-119 (no Stripe call on the rejection path)_

## Our fee

CreatorDocks charges a flat 15% platform fee. There is no subscription, no listing fee, no cost to post a brief, and no charge to a creator for anything. The fee comes out of the creator’s rate — it is not added on top of the brand’s bill. In numbers: a creator asks for $400, a brand accepts, the brand’s card is charged $400, CreatorDocks keeps $60, and the creator receives $340. That is the same for every campaign and every creator. [PLACEHOLDER: decide whether these terms state a flat 15%, or state 15% as a current rate that can change with notice. The code has one hardcoded rate and no mechanism for any other, so “subject to change” would be a promise about the future rather than a description of today. Either is defensible, but it is a decision — and whatever is chosen has to match the marketing site, which promises a flat 15% in two places.]

_Source: lib/utils.ts:8-14; app/api/stripe/create-intent/route.ts:103,106; app/api/webhooks/stripe/route.ts:105-117; app/page.tsx:17,61_

## How brands pay

Payments run on Stripe. Brands pay on the web only — there is no payment path of any kind inside the iOS app. Card details are entered into a Stripe form and go to Stripe directly; we never see or store a card number. Payments are in US dollars. Before we charge a card we re-check every detail of the authorisation — the amount, the currency, the fee and the destination — and if anything has changed, we refuse to charge it. Using the payment features also means agreeing to Stripe’s own terms. [PLACEHOLDER: confirm that creators are shown Stripe’s connected account agreement during the payout setup flow. Our code hands off to a Stripe-hosted page and cannot see what that page displays. Confirm it in a live run before stating it.]

_Source: app/(dashboard)/brand/campaigns/[id]/ApplicationActions.tsx:39-43,158-164; lib/stripe-payments.ts:23-45; app/api/stripe/onboard/route.ts:62-67; mobile/src/lib/queries/use-stripe-onboard.ts:13_

## Card holds expire

A card authorisation does not last forever. It expires after about [PLACEHOLDER: confirm the exact window against Stripe’s current documentation before publishing a number. The figure used internally is around seven days, it varies by card and issuer, and it is not stated anywhere in the code], and there is no limit on how long a revision cycle can run. So a hold can lapse before a brand approves the work. If that happens, the brand will be asked to authorise the payment again, and until a payment is actually captured, nothing has been paid. We do not currently warn either party that a hold is about to expire, and approving after a hold has lapsed will fail. [ATTORNEY: what a brand’s obligation is once it has accepted an application, the creator has delivered conforming work, and the hold has lapsed. The product has no mechanism to make a brand re-authorise. This is a real gap between how the product behaves and what a creator would reasonably expect, and it should be resolved rather than left silent.]

_Source: docs/PROJECT-STATE.md:77; docs/production-readiness-2026-09-06.md:98; lib/stripe-payments.ts:43-45; app/api/submissions/[id]/route.ts:122-125; app/api/webhooks/stripe/route.ts:43-212 (no expiry case)_

## Getting paid

Creators are paid through a Stripe payout account they set up once. You cannot be accepted to a campaign until it is set up and Stripe reports it ready. When the brand approves your work, the payment is captured and your share is credited to that Stripe account. We tell you by email and by push notification, and both state your amount after the fee. When the money actually reaches your bank is set by Stripe and your bank, not by us, and we do not promise a date. Creators are never charged anything on CreatorDocks.

_Source: app/api/stripe/onboard/route.ts:48-67; app/api/webhooks/stripe/route.ts:60-117,214-222; lib/payout.ts:74-86; lib/email.ts:109-125; lib/push.ts:124-129_

## Refunds, disputes and chargebacks

There is no refund feature in this product: nothing on the platform can issue a refund, and no button anywhere creates one. That is a statement about the product, not a promise that a payment can never be refunded — a refund can still be made by hand in Stripe, outside CreatorDocks, and the platform is wired to be told when one happens. A brand’s card is charged only when that brand approves the work, and once a payment is captured it is final on the platform. If a brand disputes a charge with its card issuer after the creator has already been paid, we are told by Stripe and a person looks at it by hand; nothing about that reverses automatically, and nothing in the platform’s own records changes. [ATTORNEY: who bears a chargeback loss. Today CreatorDocks absorbs it in practice — the payment structure credits the creator directly, the creator has already been paid, and there is no reversal code. The options are a clause making the creator liable to repay, a clause where the platform absorbs it, or set-off against future payouts. The last two need code that does not exist. Do not guess this one.] [ATTORNEY: whether these terms should carry a refund policy at all. A refund policy the product cannot execute is worse than an honest statement that payments are captured only on the brand’s own approval and are final once captured.]

_Source: app/api/webhooks/stripe/route.ts:155-210 (dispute opened, dispute closed and `charge.refunded` each send an admin email and change no state); no refunds.create call anywhere in the repo_

## If a campaign is cancelled

A brand can cancel a campaign. When that happens we try to release every hold on it that can still be released. Holds we cannot release lapse on their own. Money already captured and paid to a creator stays paid. Cancelling a campaign does not currently notify the creators on it, and it does not close out an application that has already been accepted. [PLACEHOLDER: whether a creator with an accepted, unfinished campaign is owed anything when the brand cancels. The product decides nothing here today, and this is exactly the situation a creator will write in about.]

_Source: app/api/campaigns/[id]/route.ts:153-172; lib/stripe-payments.ts:50-66; docs/platform-split/parity-checklist.md:435_

## Disagreements between a brand and a creator

If you disagree about the work, that is between the two of you. We do not decide who is right. There is no mediation, no arbitration by us, no appeal and no review board, and the platform’s involvement ends at the approve button. You can email us at [PLACEHOLDER: support contact address] and a person will read it, but we are not promising an outcome and we cannot make a brand approve work or make a creator deliver it. [PLACEHOLDER: whether Jackson intends to offer any dispute handling at all, even “email support and a human looks at it”. If yes, describe it here honestly. If not, this section stays as it is. Silence would read as an unstated promise.]

_Source: app/support/page.tsx:13,28-34; no dispute, mediation or adjudication endpoint anywhere in the repo_

## Creators are independent

Creators are independent contractors. Nothing here makes a creator an employee, agent or partner of CreatorDocks, or an employee of a brand. Creators choose which briefs to apply to, set their own price, and decide how the work gets done. Nobody at CreatorDocks assigns work or sets hours. [ATTORNEY: contractor classification language, and whether it needs jurisdiction-specific carve-outs. The facts it rests on — creators name their own rate and choose their own work — are real; whether that survives every state’s test is a legal call.]

_Source: prisma/schema.prisma:117; app/api/applications/route.ts:65_

## Taxes

You are responsible for your own taxes. CreatorDocks does not withhold anything from a payout. We do not collect your tax details — Stripe does, during payout setup, on its own page, and any tax reporting on your payouts runs through Stripe. [PLACEHOLDER: confirm in the Stripe dashboard whether CreatorDocks or Stripe is the filer for tax forms on these accounts, and which forms are issued. This must be confirmed before anything is published — a wrong tax statement is a filing problem, not just a drafting one.]

_Source: app/api/stripe/onboard/route.ts:48-67; prisma/schema.prisma:9-27 (no tax field on the user record)_

## Disclosing sponsored content

If you are a creator and you post content you were paid for, you have to disclose that you were paid. Clearly, and where people will actually see it. This is your own legal obligation and it applies no matter what the brief says. It is also a condition of using CreatorDocks: publishing paid content without a disclosure is a breach of these terms. Each social platform has its own paid-partnership label as well, and you have to use it. Brands must not ask a creator to leave out a disclosure, hide one, or make one hard to notice — a brief that asks for that is a breach of these terms. We do not check published posts for any of this, and nothing in the product reminds you. [ATTORNEY: how prescriptive to be. Naming the FTC’s Endorsement Guides gives creators something concrete but implies a US-only framing and edges toward advising creators on their own legal obligations. Decide whether to name the Guides, cite advertising-disclosure law generically, or both, and whether a non-US equivalent needs naming.] [ATTORNEY: whether to state plainly that we do not monitor for compliance. We do not — there is no code that checks a published post for anything. The honest statement is useful to a reader; whether it weakens a defence is a legal call.]

_Source: grep for ftc|disclos|#ad|sponsored|paid partnership across app, lib, packages, mobile/src → no relevant hit; app/(dashboard)/brand/campaigns/new/NewCampaignForm.tsx:6; prisma/schema.prisma:85_

## Who owns the content

You own what you make. Submitting content to a brand does not transfer ownership of it to CreatorDocks or to the brand. What the brand gets is a licence to use it, and that licence is whatever the campaign brief says. You are responsible for actually holding the rights you are granting — including rights in music, footage, artwork or anything else in your content that you did not make, and permission from anyone who appears in it.

_Source: prisma/schema.prisma:142-144; app/api/submissions/route.ts:12-17_

## Usage rights are set by each campaign

Every campaign brief has a usage-rights field, and that field is the deal. It is one short line — up to 240 characters — written by the brand. Brands: write it clearly, because it is the only statement of what you may do with the content, and it is what the creator relies on. Creators: read it before you apply, because applying and being accepted is how you agree to it. CreatorDocks does not interpret these terms, does not enforce them, and does not decide what they mean if you disagree later. [ATTORNEY: what the default is when the field is blank or says “Need to discuss”. Both are reachable today — the field is optional on the campaign form, and “Need to discuss” is one of the four preset options. The choices are (a) no licence beyond what the two parties separately agree, which is safest for creators and means a brand can publish a brief that leaves it no usage rights at all; (b) a narrow default such as organic use on the campaign’s stated platforms; or (c) make the field required in the product and remove the blank case, which is a code change. Genuinely undecided; do not guess.] [ATTORNEY: whether any licence survives a submission the brand rejected, or a payment that was never captured. Today a rejected submission stays in the database, stays visible on the brand’s dashboard, and no money changed hands. Neither the code nor the current terms say whether the brand may use it.]

_Source: prisma/schema.prisma:86; app/api/campaigns/route.ts:15,104; app/(dashboard)/brand/campaigns/new/NewCampaignForm.tsx:7,241-246_

## What CreatorDocks may do with your content

We need a narrow permission of our own, just to run the service: to store your content, show it to the brand you sent it to, display it back to you, and move it between the two. That is all it is for. It does not let us publish your content, market with it, or license it to anyone else.

_Source: app/api/v1/uploads/route.ts:35-44; app/(dashboard)/brand/campaigns/[id]/page.tsx:198_

## What brands must do **(needs list rendering)**

- Write briefs that are accurate, lawful, and clear about what you want and what you will do with the content.
- State the usage rights you need, in the usage-rights field, before creators apply.
- Have the right to the brand names, logos, products and claims in your brief.
- Pay by keeping a valid card on the campaigns you have accepted, and re-authorise if a hold lapses.
- Review submitted work in reasonable time. There is no clock on this in the product, which is exactly why it is an obligation here.
- Never ask a creator to omit, hide or downplay a paid-partnership disclosure.
- Never use a rejected creator’s content. You did not pay for it.
- Remember that accepting an application commits budget: the campaign’s budget is a ceiling on what you can accept, and you cannot exceed it.

[ATTORNEY: nothing in this list, or anywhere else in these terms, obliges a brand to delete or stop holding what it receives about a creator — the pitch, the rate, the submission media, the caption, the notes. Two of these bullets need that backing to mean anything. “Never use a rejected creator’s content” is unenforceable as drafted: a rejected submission stays on the brand’s dashboard with a working link to the file, indefinitely, and nothing in the product can take it away. And once a creator asks us to erase their data, we have no way to reach the copy the brand already has. Decide whether a data-handling and deletion obligation on brands belongs here. It is the same question as the controller characterisation flagged in the privacy policy, and it should be answered once.]

_Source: app/api/campaigns/route.ts:8-21; app/api/applications/[id]/route.ts:113-120; app/api/submissions/[id]/route.ts:101-119; app/(dashboard)/brand/campaigns/[id]/applications/page.tsx:131-135; app/api/applications/[id]/route.ts:51-68 (the route that additionally returns the creator’s email and bio — see the privacy draft’s blocker)_

## What creators must do **(needs list rendering)**

- Be accurate about who you are, what you make and what your reach is.
- Only apply to a brief you have read, including its usage rights and its deadline.
- Deliver what the brief asks for, by the deadline in it.
- Hold the rights to everything in what you submit, including anything you did not make yourself and anyone who appears in it.
- Disclose paid content, every time.
- Set up your payout account with Stripe honestly and keep it current.
- Do not take the deal off the platform after being accepted through it.

_Source: packages/shared/src/application.ts:8-9; packages/shared/src/submission.ts:10-11; app/api/stripe/onboard/route.ts:48-67_

## Acceptable use **(needs list rendering)**

You may not use CreatorDocks for any of the following. Any of them is a breach of these terms and grounds for us to end your access.

- Fraud, impersonating another person or business, or misrepresenting who you are.
- Unlawful campaigns, unlawful content, or anything that infringes someone else’s rights.
- Spam, scraping, or abusing the payment system.
- Working around our payment and trust systems, including taking an accepted deal off the platform to avoid the fee.
- Objectionable content. That includes content that is hateful, harassing, abusive, violent, sexually explicit, or degrading, and any content that sexualises a minor.
- Misleading claims about health, money or products.
- Uploading content that shows other people who have not agreed to appear in it.

We have no tolerance for objectionable content or for abusive users.

[PLACEHOLDER: this section as drafted promises less than the obvious wording would, and deliberately so — the product cannot currently do what the obvious wording says. An earlier draft read “we will remove content or close accounts”, which the privacy policy contradicts on the same day: nothing in this system deletes an uploaded file under any circumstance, there is no suspended or frozen state for a user, and there is no removal, takedown or moderation code anywhere. The whole system has three deletion routes and all three are self-service — your own account, your own pending application, your own device. The only way to end an account today is deleting the sign-in by hand, which anonymises the account record and leaves the offending submission, its caption, its notes and a working link to the file live on the brand’s dashboard. Decide the order: build a removal path and a suspension state, then write the clause that matches — or publish a clause that says exactly what we can do. A zero-tolerance sentence is the first thing App Review tests against for an app carrying user content, and the second thing they test is whether it is true.]

[ATTORNEY: how far to go here. The App Store review notes flag the absence of an objectionable-content clause and a zero-tolerance statement as an open risk for a user-generated-content app, and recommend adding exactly this. Confirm the wording, and confirm it does not promise machinery the product does not have. The same question governs the two sections below — “Reporting a problem” and “Suspension and termination by us” — which have been rewritten in the same pass and for the same reason, and which will need rewriting again if the machinery gets built.]

_Source: app/terms/page.tsx:27 (the clause this replaces); docs/platform-split/09-app-review-dossier.md:664; grep `export const DELETE` over app/api → three routes only (app/api/v1/me/route.ts:98, app/api/v1/applications/[id]/route.ts:30, app/api/v1/devices/[token]/route.ts:6); grep submission.delete|deleteSubmission|takedown|moderat over app, lib, packages → 0 files; grep UTApi|deleteFiles → 0 hits; prisma/schema.prisma:9-27 (no suspended state on a user); privacy-policy-draft.md “What deleting your account does not reach” and “Your rights”_

## Reporting a problem

If you see content or behaviour that breaks these rules, email [PLACEHOLDER: support contact address] and tell us what you saw and where. That is the only way to report something today. There is no report button and no block button in the app or on the website. A person reads what you send and decides what to do about it; we decide what to act on and we are not promising a response time. Be aware of what acting on it can mean at the moment: there is no control anywhere in this product that removes a piece of content or suspends an account, so the only step available today is removing someone’s sign-in by hand, which leaves what they uploaded in place. [PLACEHOLDER: whether an in-app report control ships before or after these terms go live. If it ships first, this section can describe it. If not, it must not. This is a sequencing decision between the App Store submission and this document, and it should be settled deliberately rather than by whoever deploys last.]

_Source: grep for report|block|abuse|flag across app/support/page.tsx, app/terms/page.tsx and mobile/src → no user-facing reporting control anywhere; docs/platform-split/09-app-review-dossier.md:591,715_

## Suspension and termination by us

We may end your access to CreatorDocks to protect the marketplace, to comply with the law, or in response to abuse, fraud or a breach of these terms. Said plainly, because the mechanism matters: there is no suspension or limitation feature in this product, so what we can actually do is remove your sign-in by hand. Doing that clears your name, photo and bio from your account record and ends your access; it does not remove anything you posted or uploaded. If we do it, money that is already committed does not automatically unwind: a hold that has been placed stays placed until it is captured or expires, and a payment already captured still settles through Stripe. Accepted applications and completed payouts survive the closing of an account. [PLACEHOLDER: whether notice is given before an account is closed, and whether there is any way to appeal. Nothing in the product decides this today — there is no suspension field on a user record and no admin suspension control, and deleting the sign-in in the provider’s dashboard is the whole mechanism. There is no runbook for it either. Confirm how it is actually carried out, and by whom, before describing it.] [ATTORNEY: termination for convenience versus for cause; notice requirements; and what survives termination — the fee on work already approved, licences already granted, indemnities and any liability cap. Also whether consumer-protection rules in any target market constrain summary termination.]

_Source: app/terms/page.tsx:32 (the clause this replaces); prisma/schema.prisma:9-27 (no suspension field); no admin suspension endpoint in the repo_

## Closing your own account

Creators can close their account in the iOS app, in Profile, and it happens immediately. You cannot close it while a payout to you is still on its way — wait for the money to land, then close it. There is one exception on the creator side: if you signed up but never got past the invitation gate, no account record was ever created for you, so there is nothing in the app to close and you have to email us. [PLACEHOLDER: brands have no self-serve control and have to email us — confirm that before publishing. The privacy policy raises the same question as an open one, and the two documents must not go out at two different levels of confidence. Whichever is right, the mechanism a brand is being pointed at is a manual operation with no runbook behind it.] Closing an account does not erase the record of what happened on the platform: applications, submissions, review notes, payouts and campaigns are kept, because they are the financial and contractual record of a completed transaction, and uploaded files are kept too. The one thing you can erase yourself is an application that is still pending, by withdrawing it. The privacy policy sets out exactly what is deleted and what is kept, and it is worth reading before you close an account.

_Source: mobile/src/app/(app)/profile/index.tsx:90-118; app/api/v1/me/route.ts:98-141 (:99-100 returns 404 when no account record exists); lib/mobile-api-guard.ts:163-164; app/api/v1/onboarding/route.ts:69-82; app/api/v1/applications/[id]/route.ts:30-49; app/api/_lib/account-deletion.ts:30-56; privacy-policy-draft.md “If you are a brand”_

## Warranties, liability and indemnity

[ATTORNEY: three separate decisions, all left blank on purpose. (1) The warranty disclaimer: how far “as is” goes, and which implied warranties can lawfully be disclaimed in each target market. The product genuinely makes no guarantee — no vetting, no pre-publication review, no content moderation — so the disclaimer is describing something true, but its reach is a legal question. (2) The liability cap: whether there is one, what number or formula, and what is carved out. The obvious anchor is fees paid, which is 15% of transaction value — a small fraction of what a user could lose on a failed campaign, which is exactly why the choice needs a decision rather than a default. (3) Indemnity: who indemnifies whom and for what. The platform’s exposure sits in content it never reviews and licences it never sees. Mutual or one-way is the call. Note that all three depend on the assent question at the top of this document: an unenforced clause in terms nobody agreed to protects nobody.]

## Governing law and disputes with us

[ATTORNEY: also left blank. Which law governs; where a dispute with CreatorDocks is heard; whether to require arbitration at all and, if so, the provider, the seat, a small-claims carve-out, an opt-out window and mass-arbitration protection; and whether forum selection survives a consumer-contract challenge. All of it depends on the legal entity, which does not exist in the repo yet. An arbitration clause is only as strong as the agreement that carried it, and today nobody is shown these terms at sign-up.]

## Boilerplate

[ATTORNEY: severability, assignment, entire agreement, force majeure, notices, and which sections survive termination. None of these exist in the current terms. Standard, but jurisdiction-shaped.]

## Changes to these terms

[ATTORNEY: what this clause should promise. There is no version number on the terms page, no change history, and no record anywhere that any user ever accepted any version. Decide the notice method, the notice period, and whether continued use counts as acceptance — then say only what the product can actually do. A clause promising notice with no mechanism behind it is a promise that will be broken the first time it matters.]

_Source: app/terms/page.tsx:3-44 (a static array, no version, no date)_

## Contact

Questions about these terms can be sent to [PLACEHOLDER: contact address for terms questions — today the only address in the product is a general support inbox, which is not a legal notice address]. [PLACEHOLDER: postal address for legal notices.]

_Source: app/terms/page.tsx:42; app/support/page.tsx:13_
