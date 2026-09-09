# docs/legal — read this before touching anything in this folder

**Nothing in this folder is publishable. Do not copy any of it into `app/privacy/page.tsx` or `app/terms/page.tsx` yet.**

Written 2026-09-08 against commit `6a2b3eb`, by people who are not lawyers. Both drafts were then put through a fact-check and a cross-document contradiction check against the same working tree, and corrected on 2026-09-08. See "Corrections applied" and "Rejected corrections" below.

## What is here

| File | What it is |
|---|---|
| `privacy-policy-draft.md` | A replacement privacy policy. 33 sections. Draft only. |
| `terms-of-use-draft.md` | A replacement terms of use. 34 sections. Draft only. |

Both are grounded in what the code actually does, section by section, with the source lines cited under each section so a reviewer can check them rather than take them on trust.

A third marker now appears in both drafts alongside `[PLACEHOLDER: …]` and `[ATTORNEY: …]`: **`[UNVERIFIED: …]`**, for a factual claim that cannot be settled from this repository — vendor behaviour, or something only an empirical test can answer. Each one names the check that resolves it. There are three, all in the privacy draft: photo metadata surviving the upload path (twice — the section body and the App Store label question), and whether deleting a Clerk identity really ends every session on every device. The legend is carried in both drafts so the convention is documented wherever a reader lands. They must be resolved before publication, not deleted, and the same grep discipline in "Steps" below applies to them.

## Why these must not go live as they are

The pages currently in production are stale and contain statements the code contradicts — the privacy page claims "basic usage data" the iOS app does not collect, never mentions the push token that the App Store labels declare, and describes an "internal marketplace environment"; the terms page says platform fees "may vary" when the fee is a hardcoded flat 15% that the marketing site advertises as flat. Those are real problems and these drafts fix them.

But shipping these drafts unreviewed would be worse than leaving the stale pages up, for three reasons.

1. **They contain unfilled placeholders.** A published privacy policy that says "[PLACEHOLDER: registered legal entity name]" or "you must be at least [PLACEHOLDER: minimum age]" is not a document; it is a public admission that nobody checked. There are 30 of them in the privacy draft and 19 in the terms draft, plus 3 `[UNVERIFIED: …]` markers in the privacy draft.
2. **They contain unreviewed legal text.** These describe the product accurately, which is the part a drafter can do. They do not take positions on liability, indemnity, warranties, governing law, arbitration, legal bases, or international transfers, because taking those positions is not a drafting job. A terms of use with an empty liability section binds nobody and protects nothing.
3. **Two of them describe things that must be fixed in code first.** See "Blockers" below. Publishing a policy that discloses a live defect, instead of fixing the defect, is the wrong order.

The stale pages are wrong. These drafts are incomplete. The fix is to finish these, not to ship them early.

---

## Owner checklist — every value Jackson must supply

Nothing below was guessed. Each is marked `[PLACEHOLDER: …]` in the drafts at the exact spot it belongs.

### Identity and contact — blocks both documents

1. **Registered legal entity name, entity type, country of incorporation, and registered postal address.** Nothing in the repo names a company. Both documents need a named, addressable counterparty on the first screen.
2. **Postal address for legal notices**, in the terms.
3. **Privacy contact address** — whether rights requests go to `support@creatordocks.com` or to a dedicated address such as `privacy@creatordocks.com`. A dedicated address also makes the request stream auditable.
4. **Contact address for terms questions.** Today the only address in the product is a general support inbox, which is not a notice address.
5. **EU or UK representative**, if one is required and appointed.
6. **Whether to name a lead supervisory authority for complaints**, and which one.

### Dates and sequencing

7. **Effective date for the privacy policy.**
8. **Effective date for the terms.** Keep the two independent — they will not always change together.
9. **Whether the policy publishes before the marketplace deploys, or with it.** Today the production site serves the creator waitlist only; the marketplace and the iOS app described in both drafts are built but not pushed. One deploy makes all of it live.

### Commitments only the owner can make

10. **Minimum age.** Appears in both documents. There is no age check anywhere in the product, so whatever number is chosen also needs a check built, and it has to line up with the App Store age rating.
11. **Response commitment for privacy requests.** Thirty days is the common one. It is a commitment, so it is Jackson's to make.
12. **How a requester's identity gets verified** before anything is disclosed or deleted. Load-bearing: with no verification procedure, "email us to get your data" is itself a disclosure risk.
13. **Whether the fee is stated as a flat 15%, or as a current rate subject to change on notice.** The code has one hardcoded rate and no mechanism for another, so "subject to change" would be a promise about the future rather than a description of today. Whatever is chosen must match the marketing site, which promises a flat 15% in two places.
14. **Whether any dispute handling is offered at all**, even "email support and a human looks at it". Silence reads as an unstated promise.
15. **Whether notice is given before an account is suspended or closed, and whether there is an appeal.**
16. **Whether a creator with an accepted, unfinished campaign is owed anything when the brand cancels it.** The product decides nothing here today.
17. **Whether an in-app "report" control ships before or after the terms go live.** The correct wording differs. Settle it deliberately rather than by whoever deploys last.
18. **The open money-model decision** — keep the card hold and handle its expiry, or charge at acceptance and transfer at approval. These are two different products and they need two different sets of terms. The draft describes today's behaviour.

### Facts to confirm before publishing (answers exist, nobody has looked)

19. **Which providers are actually provisioned in production**, re-checked with `vercel env ls production`. An earlier version of this line said the Cloudflare bot check and the Upstash rate limiter were "inert" with no credentials. Both halves were wrong, in opposite directions, and the drafts have been corrected: **an unconfigured Turnstile fails closed on a production deployment**, so `POST /api/waitlist` answers 503 "Verification is not configured" and every public waitlist submission is rejected (`lib/turnstile.ts:25-27`; `app/api/waitlist/route.ts:189-195`). That is a live outage, not a dormant flow. **An unconfigured Upstash does not disable rate limiting** — `rateLimit` falls back to an in-memory sliding window (`lib/rate-limit.ts:78-81`), so requests are still limited, per instance. What stops is the egress: nothing is sent to Upstash at all, which makes the policy's Upstash bullet a description of a flow that is not currently happening.
20. **The card authorisation expiry window.** The figure used internally is about seven days; it varies by card and it is not asserted anywhere in the code. Confirm against Stripe's documentation before printing a number.
21. **Whether CreatorDocks or Stripe is the filer for creator tax forms**, and which forms are issued. A wrong tax statement is a filing problem, not a drafting one.
22. **Whether creators are shown Stripe's connected account agreement** during payout setup.
23. **What the Stripe dashboard exposes back about a connected account.** One check settles four App Store privacy labels at once (phone, address, payment info, credit info).
24. **Whether a stored uploaded file is reachable without signing in.** Nothing in the code configures a private bucket, a signed URL or an access rule. Until someone fetches one in a private window, the policy says the file is retained and must not claim it is protected.
25. **Whether Vercel Web Analytics is switched on** for the production project.
26. **What the sign-in provider sets in a logged-out visitor's browser** on a public page. Do not publish a statement in either direction until someone looks.
27. **Whether the image library caches downloaded images to disk** on the phone. Until this is checked, the policy must not claim nothing else is stored on your device.
28. **Whether a web-only brand account has any self-serve deletion path.** The deletion endpoint lives on the mobile API surface; no web equivalent was found. This one appears in **both** drafts and they used to disagree in tone — the terms asserted it flatly, the privacy policy raised it as an open question. Both now carry the same caveat, but the underlying fact still has to be settled, and so does the mechanism a brand is being pointed at: a manual deletion of the sign-in identity, with no runbook behind it.
29. **Retention periods at each of the thirteen providers**, and the database host's point-in-time history window.
30. **What Sign in with Apple hands us for a Hide My Email sign-up**, and whether an email-change path ships before the policy does. Apple's relay address becomes `User.email` — the key for email-based row adoption (`lib/current-app-user.ts:22-25`) and the destination of every payout email. A creator who later disables the relay silently stops receiving them, and nothing in the product can change an email address.
31. **Whether Clerk's SDK telemetry actually fires**, from the website and from the app, and what it carries. `CLERK_TELEMETRY_DISABLED` is set nowhere in the repo and the CSP was written to permit `clerk-telemetry.com` (`next.config.ts:15`). Then either disclose it in the Clerk bullet or switch it off.
32. **Whether push collection is live at all when the policy publishes.** `registerForPushNotifications` short-circuits with `{status:'unconfigured'}` until `eas init` writes `extra.eas.projectId` into `mobile/app.json`, which it has not (`mobile/src/lib/push.ts:75-88`). Nothing is collected today. Sequence the push section against that switch, the same way item 9 sequences the whole policy.
33. **Whether photo-embedded GPS survives the upload path**, tested rather than argued: upload a geotagged photo and read the EXIF off the stored file. This decides the App Store **Location** label, which currently answers "No" on the strength of a grep for a missing module — the exact reasoning the dossier itself rejects for the Phone and Address rows. The drafts now carry it as `[UNVERIFIED]` in two places. The honest alternative is to strip metadata server-side and delete the question.
34. **Whether an in-app deletion path ships for accounts with no `User` row.** Rows are created lazily behind the invite gate, so anyone who signed up and stopped before it has a Clerk identity and nothing behind it: no Profile tab, and `DELETE /api/v1/me` 401s and then 404s. They cannot delete anything in the app at any number of taps. This is App Store blocker A8, and until it is fixed the policy and the review submission disagree on the same fact.
35. **Whether a removal and suspension mechanism ships before the terms do.** The acceptable-use, reporting and termination sections all used to promise machinery the product does not have. They have been rewritten to describe what is actually possible; if the machinery is built first, they should be rewritten again. See "Rewritten to match the product" below.
36. **Confirm the database provider and region before printing "Neon".** The application only knows it is talking to PostgreSQL (`prisma/schema.prisma:5-7`, `@prisma/adapter-pg`); the name comes from env files and runbooks, not code.

---

## Attorney checklist — every decision that was left open

These were not drafted. Each is marked `[ATTORNEY: …]` in place, with the product facts that bear on it.

### Privacy policy — 20 open items

1. **Controller characterisation**, and whether an EU/UK representative or a DPO is required. **Settle this one first.** `docs/dpa-draft.md` §3 already asserts the opposite arrangement to the policy — the brand customer as controller, CreatorDocks as processor — and its Annex 1 extends that to creators *and* to public waitlist prospects, who have no relationship with any brand and joined CreatorDocks' own funnel. The two documents cannot both be signed. This decides who owes a creator an answer to an access or erasure request, and whether a brand can be told to delete a creator's pitch after it lands in their dashboard.
2. **A legal basis for every purpose.** Four are genuinely contested: payments sit across contract and a record-keeping obligation over the same data; the waitlist emails go to people with no account and no unsubscribe; analytics and the bot-check script load with no consent mechanism anywhere in the product; and whether documented legitimate-interests assessments need to exist.
3. **Stripe's role split** — likely processor for the charge instruction, independent controller for its own identity and anti-money-laundering checks.
4. **Whether a written data processing agreement exists with each of the thirteen providers.** The repo's own open-actions list still has "accept each vendor's DPA in its dashboard" outstanding, so assume none is executed.
5. **Whether "we do not sell your data" survives the US state-law definitions of "sell" and "share"**, which are broader than the ordinary meaning.
6. **International transfers.** Left entirely blank: no processing region is verifiable from the code for any provider, and no transfer mechanism is confirmed for any of them. The customer DPA draft says United States for six providers and leaves the database host blank; that document and the policy must end up agreeing.
7. **Whether "we are working on a retention schedule" is acceptable in a published policy**, or whether a policy must commit to periods. And whether indefinite retention of uploaded media is defensible under any basis, given that a deletion mechanism exists at the vendor and simply has not been built.
8. **Which rights apply to which users**, given where they live and how the business is characterised.
9. **The pseudonymisation characterisation of account deletion.** The internal account number survives and every record stays joined to it. The app's own dialog currently says "anonymized" and overstates what happens. Confirm, then make the policy, the dialog and the DPA all say the same thing.
10. **The waitlist emails.** People with no account, no consent, no unsubscribe and no deletion path. The sharpest basis question in the document.
11. **Whether an obligation belongs on creators** to have permission from anyone appearing in uploaded content.
12. **How much of the security gap list belongs in a public policy** as opposed to a customer DPA. The DPA already lists no central audit log, no incident-response runbook and no security certification, and instructs that they must not be represented as complete.
13. **Children.** Whether the absence of any age screen creates exposure under US children's privacy law, and the equivalent European analysis.
14. **The changes clause.** There is no version number, no change history, and no record that any user saw any version. The same missing mechanism is already load-bearing elsewhere: `docs/dpa-draft.md:46` promises a customer 30 days' notice before a new sub-processor is added, and there is no sub-processor page to subscribe to and no mailing mechanism behind either promise. One decision covers both.
15. **Disclosure to comply with law or legal process.** A new section, deliberately left blank. Nothing in either document says the platform may disclose data to comply with law, answer a subpoena, or protect rights — so any such disclosure today sits outside every stated purpose. Decide the wording and decide whether users are notified. Neither has a process behind it.
16. **Business transfer.** Also new and also blank. Merger, acquisition, financing, asset sale. Standard in every marketplace policy, and the surprise is real: a creator who uploaded their face, a brand that uploaded an unreleased brief.
17. **Breach notification to users.** `docs/dpa-draft.md:36` commits to telling a brand customer within a set window while the privacy policy tells users nothing at all — and both documents concede there is no incident-response runbook, no alerting and console-only logging behind that clock. A commitment to customers the users' policy does not mirror is a gap in both directions.
18. **US state privacy scaffolding.** All of it is missing rather than deliberately omitted: no notice at collection, no categories-collected-and-disclosed table, no named consumer rights (know / delete / correct / opt out / non-discrimination), no authorised-agent route. Product-specific addition: the referral programme gives a benefit in exchange for personal information, which is the shape a **Notice of Financial Incentive** exists for.
19. **§4(8) of the customer DPA against the product.** It commits us to delete or return all customer personal data at the customer's election and delete existing copies. There is no mechanism — no campaign or submission delete route, zero file-deletion call sites, no waitlist deletion path — and the DPA's own Annex 3 lists "formal data-retention schedule and automated deletion on request" as a gap. §4(8) contradicts Annex 3 internally as well as contradicting the policy.
20. **Whether brands owe creators anything about the data they receive.** Once a brand holds a pitch, rate, submission, caption and notes, we cannot make them delete any of it, and the terms impose no obligation. The related unenforceable clause is flagged in the terms list below.

### Terms of use — 18 open items

1. **Assent.** What form of agreement is needed for these terms to bind, and whether it exists. Today neither sign-up screen shows the terms or asks anyone to agree. This is the first question, not the last: every clause below is only as strong as the agreement that carried it.
2. **Age**, and whether it needs jurisdiction-specific handling.
3. **A brand's obligation when a hold lapses** after acceptance and delivery. The product has no mechanism to make a brand re-authorise.
4. **Chargeback allocation.** Today the platform absorbs it in practice — the creator has already been credited and no reversal code exists. Creator liable to repay, platform absorbs, or set-off against future payouts; the last two need code.
5. **Whether to carry a refund policy at all.** There is no refund mechanism in the product.
6. **Contractor classification**, and whether it needs carve-outs.
7. **How prescriptive to be about disclosure** — naming the FTC Endorsement Guides, citing advertising-disclosure law generically, or both, and whether a non-US equivalent is needed.
8. **Whether to state that we do not monitor for compliance.** We do not. The honest statement helps a reader; whether it weakens a defence is a legal call.
9. **The default licence when a brief's usage-rights field is blank or says "Need to discuss".** Both are reachable today. Three options, all with consequences, none guessable.
10. **Whether a licence survives a rejected submission or an uncaptured payment.** Today the content stays in the database and stays visible to the brand, and no money changed hands.
11. **How far the objectionable-content and zero-tolerance clause should go.** Recommended by the App Store review notes as an open risk; confirm the wording does not promise machinery the product lacks. It did promise exactly that, and has been rewritten — see "Rewritten to match the product" below. The clause is the first thing App Review tests for a UGC app; whether it is *true* is the second.
12. **Termination** — for convenience versus for cause, notice, and what survives.
13. **The warranty disclaimer.**
14. **The liability cap.** The obvious anchor is fees paid, which is 15% of transaction value — a small fraction of what a user could lose on a failed campaign.
15. **Indemnity.**
16. **Governing law, venue, arbitration and class-action waiver**; plus severability, assignment, entire agreement, force majeure, notices and survival, none of which exist today.
17. **Whether a data-handling and deletion obligation belongs on brands.** Two bullets in "What brands must do" need it to mean anything. "Never use a rejected creator's content" is unenforceable as drafted — the rejected submission stays on the brand's dashboard with a working media link, indefinitely, and nothing in the product can take it away. Same question as privacy item 20; answer it once.
18. **Refunds happening off-platform.** "There is no refund feature in this product" is true of the code and was reading as a promise that refunds never happen. Refunds are plainly made by hand in the Stripe dashboard, and the product is wired to be told about them (`charge.refunded` fires the same admin alert as a dispute). The section now separates the two; confirm the framing is the one you want alongside item 5.

---

## Corrections applied 2026-09-08

Both drafts were fact-checked and cross-checked against each other, the customer DPA and the App Store dossier, on the same working tree they were written against. Every finding below was re-verified against the code before the text was changed. This list exists so a reviewer can see what moved and why, rather than diffing two long documents.

### Facts that were wrong or overstated

| What it said | What is true | Where |
|---|---|---|
| Sign-in is "email and password, Google or TikTok" | **Sign in with Apple is shipped and is the first button on the iOS sign-in screen.** `mobile/src/components/apple-sign-in-button.tsx`; rendered at `oauth-buttons.tsx:121`; `mobile/app.json:12,32`. Apple was an undisclosed identity provider, an undisclosed connection surviving deletion, and absent from the recipient list. Added in both drafts, in five places in the privacy draft alone. The recipient count stays at thirteen: Apple was already named for notification delivery. | both |
| "The app talks to exactly four places" | At least four more: Apple's identity servers, Expo (which mints the push token), Stripe's hosted onboarding page in an in-app browser, and the marketing site's legal/support pages in an in-app browser. Replaced with an open list, plus a placeholder for Clerk SDK telemetry. | privacy |
| "Both the analytics and the Cloudflare bot-check script load on every page" | True for Vercel Analytics (`app/layout.tsx:55`, site-wide). **False for Turnstile** — the waitlist form injects it from its own `useEffect` (`WaitlistForm.tsx:125-135`), so it loads on `/waitlist` and nowhere else. It also contradicted three other lines of the same draft. Corrected in the section body and in the legal-bases note, which asked counsel to reason from "loads unconditionally". | privacy |
| "Brands cannot edit anything in settings" | A brand with no campaigns and no applications can change their account role (`brand/settings/page.tsx:14,48-56`). Wrong as a rectification statement, and the ability was undisclosed. | privacy |
| "We keep campaign, application, submission and payout records permanently" | A creator can hard-delete their own **pending** application (`app/api/v1/applications/[id]/route.ts:30-49` — a real `prisma.application.delete`). It is the only user-reachable deletion path in the product and the draft's own source line already listed the call site. Disclosed in retention, rights, deletion-scope, and both campaign sections of the terms. | both |
| "There is no export in this product for anyone" | Contradicted the same document eleven lines earlier. A full CSV of every waitlist row sits behind the admin allowlist (`app/internal/waitlist/export/route.ts`). Corrected to "no self-serve export". | privacy |
| Cloudflare and Upstash "are currently inert" | Both backwards. See owner-checklist item 19. | privacy |
| "Roles are checked on every write" | The public waitlist form is an unauthenticated write with no role check (`app/api/waitlist/route.ts:211-292`), and `DELETE /api/v1/me` passes no role option. Narrowed, with the two exceptions named. The same overstatement is in `docs/dpa-draft.md:94` and is now flagged for reconciliation. | privacy |
| GPS metadata "travel with the file to our storage provider and on to the brand" | Asserted from an absence of stripping code, which cannot answer what `expo-image-picker` and `@uploadthing/expo` do. Now `[UNVERIFIED]` in two places, with the test named. | privacy |
| "$425.00 is on its way to your account" | Invented figure inside quotation marks. The template is `${formatCents(params.netAmount)} …` (`lib/push.ts:124-129`); there is no 425 in the codebase. Also: lock-screen display is an iOS default, not something the code sets. | privacy |
| "Stripe's transfer reference" | The column is `stripeTransferId` but both writers store the payment intent's `latest_charge` — a **charge** ID (`lib/payout.ts:71-72,81-82`). It is a statement about what identifier we keep about you after deletion. | privacy |
| Dispute alert contents | Three errors: the alert falls back to the creator's **email address** when no name is set; `detail` is a reason code and status, not "Stripe's description"; and the same path fires on `charge.refunded`, which the dispute-only framing omitted. | privacy |
| "You cannot see your waitlist entry at all" | The endpoint returns the complete row to the person who creates it, and again when they complete their profile. What is refused is a *second* look. Corrected to "cannot look it up again after you submit it", keeping the enumeration-defence explanation. | privacy |
| "The customer DPA lists the United States for six providers" | Five providers plus a blank database-host row. The sentence is an instruction to reconcile two documents, so the count matters. | privacy |
| `docs/BLOCKED-ON-JACKSON.md:54` | Wrong row — line 54 is "Uploaded media on deletion"; the vendor-DPA item is line **80**. Inherited verbatim from `docs/platform-split/pii-inventory.md:203,561`, so it will keep propagating until fixed at the source. | privacy |
| "Everything runs over HTTPS", cited to `next.config.ts:11-26` | True in fact, unsupported by the citation and unsupportable from this repo: those lines are the CSP and header block, and there is no HSTS header and no HTTP→HTTPS redirect anywhere. Reworded and re-cited. Same shape fixed for "Neon", which is knowable only from env files and runbooks. | privacy |
| "That review note is the only message channel between a brand and a creator" | The creator's submission `notes` (≤2,000 chars) and `caption` both run the other way and are rendered to the brand — and the privacy draft calls the notes "private notes to the brand" on the same day. Corrected to name all three fields and identify the review note as the only *brand-to-creator* channel. | terms |
| "Signing out removes the delivery address" | Best-effort and conditional: the unregister is a no-op unless the same app process registered the token (module-scope `registeredToken`, `mobile/src/lib/push.ts:27,118`), and it swallows its own failures. Only account deletion is transactionally guaranteed. | privacy |
| "Creators can delete their account in the app" | Not for anyone with a Clerk identity and no `User` row — rows are created lazily behind the invite gate, the tab bar never renders, and the endpoint 401s then 404s. App Store blocker A8. | privacy |
| "Nobody is scored, ranked or profiled here" | The no-automated-decisions half is true and kept. The other half is not: `topReferrers` is a named top-five leaderboard, the waitlist page builds niche/platform/follower breakdowns, brand metrics compute rejection and revision rates over the creators who submitted, and the internal user list shows per-user counts beside every name and email. Split into the true claim plus a disclosure of the derived figures. | privacy |
| Working-tree description in the header of both drafts | Two tracked docs files, not three; a modified test file and six untracked paths were unaccounted for, including one under `app/(dashboard)/`. Rewritten from `git status --porcelain`. (The commit hash and message were correct.) | both |
| Brand account closure stated flatly in one document and as an open question in the other | Both now carry the same caveat. Owner-checklist item 28. | both |

### Disclosures added

Apple as an identity provider and the Hide My Email consequence · withdrawing a pending application · the brand role-change control · the email allowlist evaluated server-side on every call (the terms said only "by invitation from our waitlist") · Clerk SDK telemetry, hedged pending a live check · the Discover niche chip travelling to the server while the search box stays local · `Device.platform` accepting whatever the device reports, not literally "ios" · `Device.lastSeenAt` as a behavioural trace nothing reads · which payout statuses actually occur (`PENDING` is the schema default and no writer ever sets it, so the deletion block is a `PROCESSING`-only block) · business transfer · law-enforcement and legal-process disclosure · breach notification to users · recipient addresses and subject lines written to logs when the email provider is unconfigured · one database shared across local, preview and production with query logging (including bound values) outside production · waitlist `status` as a recorded judgement with no "do not contact" state · untracked bulk copies of the waitlist leaving the system · identifiers travelling in URLs (`?viewAs=`, the push token path segment) and landing in access logs · brand-visible rejection and revision rates about named creators · US state-privacy scaffolding · the sub-processor-change mechanism that does not exist · the brand as an independent holder of what it receives · push collection being dormant until `eas init` runs.

### Rewritten to match the product

The terms said "we will remove content or close accounts", "we may remove content or suspend an account", and "we may limit, suspend or close an account". The privacy draft told the same reader, on the same day, that nothing in this system deletes an uploaded file ever, and that there is no suspend or freeze state. The product side is confirmed: the whole `app/api` surface has exactly three DELETE handlers, all self-service (own account, own pending application, own device token); there is no submission or campaign delete, no admin removal, no moderation or takedown code, no file-deletion call site, and no suspended state on `User`. The only way to end an account today is deleting the Clerk identity by hand, which anonymises the `User` row and leaves the offending submission, its caption, its notes and a working media link live on the brand's dashboard.

Those three sections now describe what can actually be done, and carry a placeholder saying which order to fix it in. **This is the correction most likely to be reversed by a well-meaning edit** — the obvious wording is the one App Review wants to see. Build the machinery first, then write the sentence.

## Rejected corrections

Both of these were raised by the checks, both were checked against the code, and neither holds. The drafts were left as they were. Recorded here so nobody re-litigates them.

1. **"The web sign-up card does show the terms, because `authClerkAppearance` sets `termsPageUrl` and `privacyPageUrl`."** Rejected. Those keys are set under `options:` (`lib/clerk-appearance.ts:22`), and Clerk's `Appearance` type has no `options` key — `privacyPageUrl`, `termsPageUrl` and `helpPageUrl` live under `layout` (verified against the installed @clerk/nextjs 7.6.1: `node_modules/@clerk/shared/dist/types/index.d.ts:5605` for `layout?: Layout`, `:5679,5689` for the two URLs). The object is passed through to `<SignUp>` (`app/(auth)/sign-up/[[...sign-up]]/page.tsx:47-48`) and the unrecognised key is ignored, so no legal link renders. This is already blocker 4 below, and the terms draft's assent note now explains the trap so the next reader does not fall into it. The iOS half of the claim and the no-consent-record half were correct and unchanged.
2. **"Referral codes are derived from the referrer's name or email address and should be disclosed as such."** Rejected — the code this describes is gone. `makeBaseReferralCode` no longer exists; `randomReferralCode` draws ten characters from a Crockford base32 alphabet using `crypto.getRandomValues` (`app/api/waitlist/route.ts:46-57`), and the comment above it records that the old name/email-derived form was removed precisely because it leaked the referrer's name and made codes guessable. A referral code carries no personal data today, so there is nothing to disclose.

One claim was **accepted in part**: "email addresses reach server logs, and it is live in production because `RESEND_API_KEY` is a placeholder". The logging path is real (`lib/email.ts:47-50` writes the recipient address and subject when the key is unset), but a 14-character placeholder is truthy, so `resend` is constructed and the warn branch is skipped — on production the send is attempted and fails, logging only the error. The disclosure was added in the accurate form: the path is live wherever the key is *absent*, which is any environment that has not set it.

---

## Blockers — fix in code before either document is published

1. **One brand-facing route returns a creator's entire account record**, email address and bio included, when a brand saves an application without changing its status (`app/api/applications/[id]/route.ts:51-68`). Every brand-facing screen query is correctly narrow, so this is one route defect, not a design position. Fix it, or the privacy policy must state that brands can receive creator email addresses. It is live either way.
2. **Any signed-in user can read any active campaign's full text**, including the brand-authored target-audience and creator-requirements fields, because the route passes no role option (`app/api/v1/campaigns/[id]/route.ts:7-9`). The draft discloses this. Decide whether to gate it instead.
3. **The app throws away the reason a deletion was refused.** A creator blocked by an in-flight payout sees a generic "couldn't delete your account" (`mobile/src/app/(app)/profile/index.tsx:115`) instead of the server's actual explanation. A cheap client fix, and it matters more than the paragraph in the policy that describes it.
4. **No sign-up screen shows either document.** The in-app links live only on the Profile tab, behind the invite gate, and the web sign-up card's terms and privacy links are configured under the wrong key (`lib/clerk-appearance.ts:22` — `options:` should be `layout:` for Clerk 7.x), so they are silently ignored. A terms document nobody has been shown is materially weaker than one presented at sign-up.
5. **The two in-app deletion dialogs point at the privacy policy "for details"** that the current policy does not contain (`mobile/src/app/(app)/profile/index.tsx:93,102`). The draft carries that detail. Until the draft ships, both strings are false references.

---

## How to apply a draft to the page, once it is approved

Both `app/privacy/page.tsx` and `app/terms/page.tsx` are the same shape: a module-level `const sections` array of `{ title, body }` string pairs, mapped into one `.dashboard-panel` card each. The render body is byte-for-byte identical in the two files.

```tsx
{sections.map(section => (
  <section key={section.title} className="dashboard-panel">
    <h2>{section.title}</h2>
    <p className="page-copy" style={{ margin: 0 }}>{section.body}</p>
  </section>
))}
```

### Steps

1. **Get the attorney's approved text.** Not this draft — the version that comes back from review.
2. **Replace every `[PLACEHOLDER: …]`, `[ATTORNEY: …]` and `[UNVERIFIED: …]` with real text.** Then grep the file for `PLACEHOLDER`, `ATTORNEY` and `UNVERIFIED` and confirm zero hits. Do this before anything else; it is the check that stops a marker reaching production. An `UNVERIFIED` marker is resolved by doing the check it names, not by picking the likelier answer.
3. **Delete every `_Source:_` line.** They are drafting apparatus, not published text. Grep for `_Source:` and confirm zero hits.
4. **Delete the status block and the "How to read this draft" block** at the top of the file.
5. **Map each `##` heading to one array entry.** The heading text becomes `title`; the prose under it becomes `body`. One heading, one entry, in order.
6. **Check the titles are unique.** The map uses `key={section.title}`, so two sections with the same name produce a React duplicate-key warning. Both drafts are written with unique headings; keep it that way if you merge or split sections.
7. **Use curly apostrophes (`’`, U+2019).** Section strings are single-quoted TypeScript strings and the codebase uses the curly form rather than escaping. Both drafts are already written with curly apostrophes, so a straight copy-paste works.
8. **Update the shell props.** `eyebrow`, `title` and `description` are passed to `PublicPageShell` and are not part of the sections array. The current privacy description says "the public waitlist and internal creator marketplace workflows" and never mentions the iOS app; replace it. Do not add an `<h1>` inside the children — the shell already renders one.
9. **Put `Effective date` first** in the array. It renders as the first card and survives a copy-paste, which a bare paragraph above the map would not.
10. **Run the build and look at both pages.** 33 and 34 sections render as 33 and 34 stacked cards.

### The one code change the drafts need

Ten sections of the privacy draft and four of the terms draft are lists, and the component cannot render one — `body` is a single string dropped into a single `<p>`. A privacy policy that has to name thirteen providers in one unbroken paragraph is not readable, which defeats the point of writing it in plain English.

The minimal, non-breaking change is to widen the type and render an array as a list:

```tsx
const sections: { title: string; body: string | string[] }[] = [ … ]

// in the map:
{Array.isArray(section.body)
  ? <ul className="page-copy" style={{ margin: 0 }}>{section.body.map(item => <li key={item}>{item}</li>)}</ul>
  : <p className="page-copy" style={{ margin: 0 }}>{section.body}</p>}
```

Apply the same change to both pages. Each list section becomes `body: ['…', '…']`, one array entry per bullet, with the lead sentence as its own paragraph section or as the first array item. Sections marked **(needs list rendering)** in the drafts are the ones that need it.

Two other things the component cannot do, both worth knowing before the text is finalised: **there are no links inside a body** (the contact address is plain text on both pages today; only the support page renders a real `mailto:` link), and **there is no bold or nested heading**. If the approved text needs any of those, that is a further component change, not a copy-paste.

### While you are in there

Neither page exports its own `metadata`, so `/privacy` and `/terms` both inherit the marketing title and the "15% platform fee, no retainer" description from the root layout. Unrelated to the legal text, small to fix, and odd on a policy page.

---

## Other documents that must not contradict these

- **`docs/dpa-draft.md`** — the unreviewed customer data processing agreement. Its Annex 1 (categories of data), Annex 2 (sub-processors) and Annex 3 (security measures and the gap list) must say the same things as the privacy policy. Four specific divergences, all now flagged in the drafts and in the attorney checklist above. **§3 (roles)** asserts the brand customer is controller and CreatorDocks processor — including over public waitlist prospects — which is the opposite of what the privacy policy says on its first screen; the two cannot both be signed. **§4(8)** promises deletion or return of all customer data on the customer's election, which the product cannot perform and which its own Annex 3 lists as a gap. **Annex 2** has six rows — five named providers plus an unfilled database-host row — where the policy names thirteen companies; Expo, Upstash, Cloudflare, Svix, Neon, Apple, Google and TikTok are all absent, and the annex's footnote claims a verification against dependencies and env vars that cannot have happened (`@upstash/ratelimit`, `@upstash/redis` and `expo-server-sdk` are direct dependencies; `TURNSTILE_SECRET_KEY` is a declared env var). **Annex 3** says role-based authorization is enforced "on every write-side API endpoint independently", which the privacy draft has now narrowed for good reason, and its security posture must not imply environment segregation that does not exist.
- **`docs/platform-split/09-app-review-dossier.md` §4** — the App Store privacy nutrition labels. Apple compares the labels against the policy, and a mismatch is a known rejection pattern. Most of it matches: usage data and diagnostics are declared as not collected and the policy says the app has no analytics or crash reporting; the device identifier is declared and the policy describes the push token; user content, contact info, user ID and other financial info are declared and the policy names each of them. **Two rows now need work because of these drafts.** The **Location = No** row rests on a grep for a missing module while the policy describes photo-embedded GPS potentially leaving the device — see owner-checklist item 33; a reviewer opening Profile → Privacy policy would find the app's own policy arguing against its label. And **§4c's supporting sentence** for Tracking = No says "the only third parties receiving user data are Clerk, UploadThing and Stripe", cited to `app/privacy/page.tsx:15-18` — the page these drafts replace. The Tracking = No *conclusion* survives (none of the thirteen is an ad network or data broker), but the reasoning under it has to be restated against the new policy rather than left pointing at a page that will read differently. Same class of defect as risk B9, which the dossier already rates High.
- **`mobile/ios/CreatorDocks/PrivacyInfo.xcprivacy:32-33`** declares an empty collected-data-types array while the app collects seven declared types. A code fix, not a policy fix, but a reviewer comparing the manifest, the labels and the policy will see three documents disagreeing.
- **The marketing site.** `app/page.tsx:17,61` promises a flat 15% fee taken out of the accepted rate; the terms draft matches it. `app/get-the-app/page.tsx:214,221` says the work is "funded before you start shooting" and "the deal is not a promise" — that describes a card authorisation, not escrowed funds, and whether the phrasing is supportable is worth putting in front of counsel alongside the terms.
- **The two in-app deletion dialogs** (`mobile/src/app/(app)/profile/index.tsx:93,102`), which cite the privacy policy for detail and use the word "anonymized" that the policy draft flags as an overstatement.

## Where the underlying research lives

The drafts were built from three research passes over the working tree — a privacy fact-finding pass, a commercial terms pass, and an audit of the current pages and their link surfaces. Every factual claim in the drafts is cited to `path:line` under its section. Anything that could not be verified from the code was marked rather than asserted, and none of it was filled in with a plausible guess.
