# CreatorDocks

A creator ↔ local-brand marketplace built with Next.js 16 (App Router), Clerk, Prisma + Postgres, Stripe Connect, and UploadThing. The product is currently in **waitlist launch mode**: the public site is a creator waitlist, and the marketplace (brand + creator dashboards) is limited to email-allowlisted testers.

## Getting started

```bash
npm install
npx prisma migrate dev   # needs DATABASE_URL
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Roles and access

There is a single sign-in page (`/sign-in`, Clerk). After login everyone lands on `/post-login`, which routes by account state:

| Account | Lands on |
| --- | --- |
| Admin (`role=ADMIN` + email in `ADMIN_ALLOWED_EMAILS`) | `/internal/waitlist` |
| Tester without a role yet | `/onboarding` (pick Brand or Creator) |
| Tester with `role=BRAND` | `/brand` |
| Tester with `role=CREATOR` | `/creator` |
| Everyone else | `/waitlist` |

- **Testers** are emails listed in `TESTER_ALLOWED_EMAILS` (or `ADMIN_ALLOWED_EMAILS`, which implies tester access). Only testers can use the marketplace dashboards and APIs while in waitlist mode.
- **Admins** use the same sign-in page. The internal waitlist ops dashboard lives at `/internal/waitlist` and returns a 404 for anyone who is not an allowlisted admin, in every environment.
- With no allowlists configured, tester/admin access is open **only** when `NODE_ENV=development` (local dev). Preview and production deployments stay locked down.

### Creating an admin

1. Add the email to `ADMIN_ALLOWED_EMAILS`.
2. Sign in once and pick either role on `/onboarding` so the user row exists.
3. Run `npm run promote:admin -- you@example.com` (refuses emails not in the allowlist).
4. Sign in again — you'll be routed to `/internal/waitlist`.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection string (Prisma). |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` | Clerk auth. |
| `CLERK_WEBHOOK_SECRET` | Verifies Clerk webhooks (svix). |
| `ADMIN_ALLOWED_EMAILS` | Comma-separated admin emails. Gate for `/internal` and the promote script. |
| `TESTER_ALLOWED_EMAILS` | Comma-separated tester emails allowed into the marketplace (admin emails are testers automatically). |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | Stripe Connect payments and webhooks. |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe.js on the client. |
| `UPLOADTHING_TOKEN` | Creator content uploads. |
| `TURNSTILE_SECRET_KEY` / `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Cloudflare Turnstile bot check on the waitlist form. |
| `NEXT_PUBLIC_URL` | Canonical site URL (falls back to `VERCEL_URL`). |

## Scripts

- `npm run dev` / `npm run build` / `npm start`
- `npm run lint`
- `npm run promote:admin -- <email>` — promote an existing user to ADMIN (validated against `ADMIN_ALLOWED_EMAILS`).
