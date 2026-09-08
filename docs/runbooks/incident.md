# Incident runbook

## The honest starting point

**There is no error tracking and no alerting in this codebase today
(2026-09-07).** No Sentry, no equivalent, in web or mobile — confirmed absent
from both `package.json` and `mobile/package.json`
(`docs/production-readiness-2026-09-06.md` H5: "no `sentry` in either
`package.json`"). There is no uptime monitor, no health-check endpoint being
polled by anything external, and no structured per-request logging on
`/api/v1`. Nothing pages anyone. If something breaks in production right now,
**the only way anyone finds out is a user reporting it, or someone happening
to look.** Adopting real observability is tracked as H5 in the audit — treat
this document as "how to cope until then," not a description of a monitored
system.

The one exception — the one thing that *does* alert automatically today — is
Stripe disputes and refunds (§3 below).

## 1. How you'd actually find out something is broken, today

In rough order of how you're likely to learn about a problem:

1. **A user tells you.** No feedback widget exists in the web app; the
   `support@creatordocks.com` mailto on `/support` is the only channel, and per
   the audit (PROC-13) it has no stated owner or response-time target. Treat
   any inbound report as the primary signal you have.
2. **You notice while doing something else** — a manual smoke test after a
   deploy (see `deploy.md` §3), checking Stripe's dashboard, opening the app.
3. **Vercel Runtime Logs**, checked manually:
   ```bash
   vercel logs coreloop --prod           # tail recent production logs
   # or: Vercel dashboard → project → Logs
   ```
   **Retention is 1 hour on the Hobby plan** (`docs/production-readiness-2026-09-06.md`
   H6 — the team's plan is an auditor inference, not CLI-confirmed; verify in
   the dashboard's billing page if it matters for a specific incident). That
   means: if you're investigating something that happened more than an hour
   ago, the raw logs are already gone. There is no log drain configured to
   ship them anywhere durable. **If you suspect an incident, pull logs
   immediately — don't wait until you've finished writing up what you think
   happened.**
4. **Stripe's own dashboard** for anything payment-shaped — it has its own
   independent event log and webhook delivery history, unaffected by Vercel's
   retention window.
5. **Clerk's dashboard** for anything auth-shaped, similarly independent.

There is no dashboard, widget, or single URL that aggregates the above. Check
each surface in turn.

## 2. What to do once you know something's broken

1. **Pull Vercel logs first, before anything else, given the 1-hour window**
   (`vercel logs coreloop --prod`, or the dashboard). Grep for the affected
   route or a stack trace. Save what you find somewhere durable (a text file,
   a message to yourself) — it will not still be there in an hour.
2. **Classify severity** (§4) and act accordingly.
3. **Check whether it's a code problem or an env/config problem.** An env
   problem (empty Stripe key, missing `CREATOR_WEB_MODE`, etc.) needs the
   fix-and-redeploy path in `rollback.md` §2, not a code rollback. A bad-code
   problem is `rollback.md` §1 (instant rollback) first, root-cause after.
4. **If it's a database-shape problem** (Prisma errors mentioning a missing
   column, a constraint violation that shouldn't be possible), check
   `prisma migrate status` immediately — see `migrate.md`. Given the single
   shared database, a schema problem here is also a **production data**
   problem, not just a code problem.
5. **If it's a mobile-only problem**, see `rollback.md` §4 for what's actually
   available (maintenance mode, version gate, expedited review) — do not
   assume OTA exists.
6. **Communicate.** There's no status page or incident channel set up. At
   minimum, tell Jackson directly what broke, what you did, and what's still
   open — see the guess-list convention in `CLAUDE.md`: an honest "I don't know
   what caused this yet" beats a confident wrong guess.
7. **Write down what happened** somewhere that outlives the 1-hour log
   window — this document doesn't have a designated incident log yet; until
   one exists, a dated note in `docs/` or a message to Jackson is better than
   nothing.

## 3. The one alert path that DOES exist: Stripe disputes & refunds

`app/api/webhooks/stripe/route.ts` handles `charge.dispute.created`,
`charge.dispute.closed`, and `charge.refunded`. Each of these calls
`alertAdmins(...)`, which emails **every address in `ADMIN_ALLOWED_EMAILS`**
(via `sendPaymentAlertEmail` in `lib/email.ts`) with the campaign, creator,
amount, and a reason/status line. The email is explicit that there is no
automated resolution — "This requires manual follow-up in the Stripe
dashboard."

What this means operationally:

- If you are in `ADMIN_ALLOWED_EMAILS` in Vercel Production, you will get an
  email the moment a dispute opens/closes or a charge is refunded. This is
  real today, not aspirational — but only if `RESEND_API_KEY` is a working key
  (see `deploy.md` §1.1 — as of 2026-09-06 it's a 14-character placeholder,
  meaning **these alert emails currently silently fail to send**; `lib/email.ts`
  logs a warning and skips sending rather than throwing when Resend isn't
  configured). **Confirm Resend is actually live before relying on this path**
  — an alert that fails silently is worse than no alert, because you'll assume
  coverage you don't have.
- The email tells you to go resolve it manually in the Stripe dashboard —
  there is no in-app dispute-resolution flow (M5 in the audit: "`Payout` rows
  stay PAID, no transfer reversal").
- Payout failures (`payment_intent.payment_failed` handled elsewhere in the
  same webhook) trigger a push to the affected creator
  (`sendPayoutFailedPush`), not an admin alert — that's a different signal
  from disputes/refunds.

## 4. Severity ladder

No formal on-call exists, so this is about triage priority and how fast you
personally should drop other work, not paging.

| Severity | Definition | Examples | Response |
|---|---|---|---|
| **SEV1 — down / money at risk** | The site is unreachable, sign-in is broken for everyone, or a payment/payout path is corrupting money (double charge, wrong amount, payout to the wrong account). | Homepage 5xx for all traffic; Stripe webhook signature failures blocking all payment confirmations; a bad migration breaking every DB read. | Drop everything. Pull logs immediately (1-hour window). Roll back per `rollback.md` §1/§2 without waiting for root cause. Tell Jackson immediately. |
| **SEV2 — a whole feature is broken** | One major flow is down but the rest of the product works, or a security-relevant bug exists but isn't actively being exploited. | `/api/v1/applications` 500ing for every creator; `CREATOR_WEB_MODE` flipped to `sunset` by accident on a live deploy; the mobile force-update gate stuck showing every user "please update" with no working version to update to. | Same day. Roll back the specific bad piece (code, env, or migration) rather than waiting to fully understand it first if the fix is well-understood (e.g. a known env var). |
| **SEV3 — degraded / edge case** | Some users or some paths affected, workaround exists. | A single brand's webhook events failing to alert due to a bad email; the rate-limit key bug (B7) letting one route's traffic exhaust another's quota; a UI bug that doesn't block the core loop. | Within a few days. Fix in the normal deploy cycle (`deploy.md`), no emergency rollback needed. |
| **SEV4 — cosmetic / low-impact** | Doesn't block any user flow. | A copy/label bug (e.g. the gross-vs-net payout label mismatch, H2), a missing favicon, a low-severity item from the audit's §5 "Low" list. | Normal backlog. |

When in doubt, treat it as one severity higher than your first instinct — there
is no monitoring safety net catching what you might be wrong about, and the
1-hour log window means a delayed response can mean losing the evidence
entirely.
