# Data Processing Agreement — First-Pass Draft

> **Status: DRAFT.** This is a starting point written from the actual subprocessors and data flows in the CreatorDocks codebase, not a finished legal instrument. It has **not** been reviewed by an attorney and should not be sent to a customer or signed as-is. Bracketed items `[LIKE THIS]` need a real value filled in before this is usable. See the "Open items before this is signable" section at the end.

---

## Data Processing Agreement

This Data Processing Agreement ("**DPA**") is entered into between **[CREATORDOCKS LEGAL ENTITY NAME]** ("**Processor**," "**we**," "**us**") and the customer identified in the applicable order form or agreement ("**Controller**," "**Customer**," "**you**"), and forms part of the [Master Services Agreement / Terms of Service] between the parties (the "**Agreement**"). Capitalized terms not defined here have the meaning given in the Agreement.

### 1. Definitions

- **"Data Protection Laws"** means all laws and regulations applicable to the processing of Personal Data under this DPA, including, where applicable, the EU General Data Protection Regulation 2016/679 ("**GDPR**"), the UK GDPR, and the California Consumer Privacy Act as amended by the California Privacy Rights Act ("**CCPA**").
- **"Personal Data"**, **"Processing"**, **"Controller"**, **"Processor"**, **"Data Subject"**, and **"Sub-processor"** have the meanings given in the GDPR, applied correspondingly under other Data Protection Laws.
- **"Customer Personal Data"** means Personal Data processed by Processor on behalf of Controller in connection with the Agreement, as described in Annex 1.
- **"Security Incident"** means a breach of security leading to the accidental or unlawful destruction, loss, alteration, unauthorized disclosure of, or access to, Customer Personal Data.
- **"Standard Contractual Clauses"** or **"SCCs"** means the standard contractual clauses for the transfer of personal data to third countries pursuant to the GDPR, as approved by the European Commission (Decision 2021/914), as may be updated.

### 2. Subject matter and duration

Processor will process Customer Personal Data as necessary to provide the CreatorDocks marketplace platform under the Agreement, for the duration of the Agreement, unless otherwise agreed in writing. Details of the processing are set out in **Annex 1**.

### 3. Roles of the parties

Controller is the controller of Customer Personal Data. Processor processes Customer Personal Data solely as a processor, on behalf of and under the documented instructions of Controller, as set out in this DPA and the Agreement, except where otherwise required by applicable law.

### 4. Processor obligations

Processor shall:

1. process Customer Personal Data only on documented instructions from Controller, including with regard to international transfers, unless required to do otherwise by applicable law (in which case Processor will inform Controller of that legal requirement before processing, unless prohibited from doing so);
2. ensure persons authorized to process Customer Personal Data are subject to confidentiality obligations;
3. implement appropriate technical and organizational measures to protect Customer Personal Data, as described in **Annex 3**;
4. engage Sub-processors only as permitted under Section 5;
5. taking into account the nature of the processing, assist Controller by appropriate technical and organizational measures, insofar as reasonably possible, in fulfilling Controller's obligations to respond to Data Subject requests to exercise their rights under Data Protection Laws;
6. notify Controller without undue delay, and in any event within **[72 hours]** of becoming aware, of any Security Incident affecting Customer Personal Data, and provide reasonably requested information to assist Controller in meeting any of its own breach-notification obligations;
7. make available to Controller information reasonably necessary to demonstrate compliance with this DPA, and allow for and contribute to audits, including inspections, conducted by Controller or an auditor mandated by Controller, subject to reasonable advance notice, confidentiality, and no more than **[once per 12-month period]** absent a Security Incident or legal requirement;
8. at Controller's election, delete or return all Customer Personal Data after the end of the provision of services, and delete existing copies, except where applicable law requires retention.

### 5. Sub-processors

Controller provides general authorization for Processor to engage the Sub-processors listed in **Annex 2** to process Customer Personal Data. Processor will:

- impose data protection terms on each Sub-processor that provide at least the same level of protection as this DPA;
- remain liable to Controller for the performance of each Sub-processor's obligations;
- give Controller notice of any intended addition or replacement of a Sub-processor at least **[30 days]** in advance, during which Controller may object on reasonable data-protection grounds; if the parties cannot resolve the objection, Controller may terminate the affected service.

### 6. International transfers

Where Processor or a Sub-processor processes Customer Personal Data outside the country in which it originated in a way that requires a transfer mechanism under Data Protection Laws, the parties agree that the Standard Contractual Clauses (or the UK International Data Transfer Addendum, where applicable) are incorporated by reference and apply to that transfer, unless an alternative valid transfer mechanism is in place.

### 7. Liability

Each party's liability arising out of or related to this DPA is subject to the limitations and exclusions of liability set out in the Agreement. **[Confirm with counsel whether a separate liability cap for data-protection claims is needed.]**

### 8. Term and termination

This DPA takes effect on the effective date of the Agreement and terminates automatically upon termination or expiration of the Agreement.

### 9. Order of precedence

In the event of a conflict between this DPA and the Agreement regarding the processing of Personal Data, this DPA prevails.

---

## Annex 1 — Details of processing

| | |
|---|---|
| **Subject matter** | Provision of the CreatorDocks brand↔creator marketplace platform |
| **Duration** | For the term of the Agreement, plus any post-termination retention period agreed by the parties |
| **Nature and purpose of processing** | Account creation and authentication; campaign posting and discovery; application and content-submission workflow between brands and creators; payment authorization, capture, and payout processing via Stripe Connect; transactional email notifications; customer support |
| **Categories of data subjects** | Individuals using the platform as a brand-side user, individuals using the platform as a creator, and prospective users who join the public waitlist |
| **Categories of personal data** | Name, email address, profile avatar URL, self-provided bio; role (brand/creator/admin); Stripe Connect account identifiers and onboarding status (**not** raw payment card data, which is collected and stored directly by Stripe, never by Processor); campaign and application content submitted by users (titles, briefs, pitches, proposed rates, uploaded creative assets and their URLs); payout amounts and status; basic web analytics (page views, referrers) via Vercel Analytics |
| **Special categories of data** | None knowingly collected or processed |

## Annex 2 — Sub-processors

| Sub-processor | Purpose | Location of processing | Transfer mechanism |
|---|---|---|---|
| Stripe, Inc. | Payment processing, Stripe Connect payouts to creators, card data storage | United States (and other regions per Stripe's own sub-processor list) | Stripe's SCCs / DPA |
| Clerk, Inc. | User authentication and session management | United States | [Confirm — Clerk's DPA/SCCs] |
| Resend, Inc. | Transactional email delivery (account, application, payout notifications) | United States | [Confirm — Resend's DPA/SCCs] |
| UploadThing (Ping Labs, Inc.) | File upload storage and CDN delivery for creator-submitted content | United States | [Confirm — UploadThing's DPA/SCCs] |
| Vercel Inc. | Application hosting, edge network, and web analytics | United States (global edge network) | Vercel's DPA/SCCs |
| **[DATABASE HOST — CONFIRM PROVIDER]** | Primary PostgreSQL database (all application data) | **[CONFIRM REGION]** | **[CONFIRM]** |

*This list reflects the third-party services actually integrated in the codebase as of this draft (verified against `package.json` dependencies and environment variable usage). Confirm each entry's own DPA/SCC status directly with the vendor before this document is finalized — vendor sub-processor terms change over time and should be re-verified periodically, not just once at signing.*

## Annex 3 — Technical and organizational security measures

Controls currently in place, as verified against the codebase:

- **Access control**: authentication via Clerk with session-based access; role-based authorization (brand/creator/admin) enforced at both the application-routing layer and on every write-side API endpoint independently
- **Transport security**: HTTPS enforced platform-wide; restrictive security headers (`X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, a scoped `Permissions-Policy`, and a Content-Security-Policy)
- **Payment data isolation**: raw payment card data is never handled or stored by Processor's own systems — collected and processed directly by Stripe
- **Webhook integrity**: inbound Stripe and Clerk webhooks are signature-verified before processing
- **Origin/CSRF checks**: state-changing API requests validate request origin
- **Rate limiting**: abuse-prevention rate limits on state-changing endpoints

Controls identified as gaps during an internal readiness review (tracked for remediation, not yet in place — do not represent these as complete to a counterparty):

- Centralized audit logging of administrative actions
- A formal incident-response runbook and documented breach-notification process matching the timeline in Section 4(6)
- SOC 2 or equivalent third-party security certification (**not currently held** — do not claim otherwise in any customer-facing representation)
- Formal data-retention schedule and automated deletion on request
- A dedicated security/privacy point of contact with a published escalation path

---

## Open items before this is signable

1. **Fill in the legal entity name**, governing-law/venue references, and confirm whether this DPA is meant to attach to a Terms of Service, a separate Master Services Agreement, or stand alone.
2. **Confirm the database host** in Annex 2 — the codebase only specifies a generic PostgreSQL connection string; the actual hosting provider (and its own DPA/SCC status) needs to be named accurately.
3. **Verify each sub-processor's own current DPA/SCC terms** directly against their published legal pages — these change periodically and the bracketed placeholders above should not be treated as confirmed.
4. **Decide the breach-notification window** (a placeholder 72-hour figure is used above, aligned with GDPR's own 72-hour controller-to-regulator clock, but confirm this is realistic given the "console-only logging, no alerting" gap flagged in the readiness audit — committing to 72 hours before basic error alerting exists is a real operational risk).
5. **Get an actual attorney to review this before it is sent to any customer or signed.** This draft follows common DPA structure and is grounded in the platform's real data flows and sub-processors, but it is not a substitute for legal review — some clauses (liability, audit frequency, notice periods) are placeholders that should be negotiated deliberately, not defaulted to what's here.
