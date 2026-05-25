# CoreLoop Vercel + Domain Launch

This app is already a good fit for Vercel because it is a full Next.js application with:

- server-rendered routes
- API endpoints
- Clerk auth
- Stripe + Stripe Connect
- PostgreSQL / Prisma
- UploadThing

## 1. Create the GitHub repo

The project currently has **no git remote configured**, so start here.

1. Create a new GitHub repository.
2. Push `/Users/jsteele/Desktop/CoreLoop/marketplace` to that repo.
3. Keep `main` as the initial production branch unless you want previews gated behind a separate branch.

## 2. Buy the domain

Default recommendation: **Porkbun**.

Suggested steps:

1. Search for your preferred `.com`.
2. Buy the domain.
3. Keep domain privacy enabled.
4. Leave DNS management in Porkbun unless you decide to move DNS into Vercel later.

## 3. Create the Vercel project

1. Sign in to Vercel.
2. Import the GitHub repo.
3. Let Vercel detect the framework as **Next.js**.
4. Deploy once to the temporary `*.vercel.app` URL first.

## 4. Add production environment variables

Add these variables in Vercel before the real launch:

- `DATABASE_URL`
- `CLERK_SECRET_KEY`
- `CLERK_WEBHOOK_SECRET`
- `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL`
- `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_CLERK_SIGN_IN_URL`
- `NEXT_PUBLIC_CLERK_SIGN_UP_URL`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_URL`
- `RESEND_API_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `UPLOADTHING_APP_ID`
- `UPLOADTHING_SECRET`

Notes:

- Set `NEXT_PUBLIC_URL` to the final production domain after the domain is connected.
- Keep Clerk and Stripe values production-specific, not copied from test mode if you are going live.

## 5. Connect the domain in Vercel

1. In Vercel, open the project settings.
2. Add the purchased domain.
3. Add both:
   - apex/root domain, for example `coreloop.com`
   - `www`, for example `www.coreloop.com`
4. Use the DNS records Vercel gives you.

Default canonical setup:

- make the **root domain** canonical
- redirect `www` to the root domain

## 6. Update app-integrated services

### Clerk

Update:

- production sign-in URL
- production sign-up URL
- allowed redirect URLs
- webhook endpoint

Recommended webhook endpoint:

- `https://yourdomain.com/api/webhooks/clerk`

### Stripe

Update:

- publishable key / secret key if switching to live mode
- webhook endpoint
- Connect onboarding flow validation

Recommended webhook endpoint:

- `https://yourdomain.com/api/webhooks/stripe`

### UploadThing and Resend

Confirm production keys are valid and any domain-level settings are correct if those services require them later.

## 7. Final production app config

After the real domain is working:

1. Set `NEXT_PUBLIC_URL=https://yourdomain.com`
2. Redeploy
3. Confirm auth redirects and Stripe onboarding return URLs use the production domain

## 8. Launch checklist

Run through this on the real domain:

- homepage loads correctly
- sign-up works
- sign-in works
- onboarding redirects correctly
- creator can connect Stripe
- brand can create a campaign
- creator can apply to a campaign
- creator can submit content
- brand can approve content
- payout flow completes correctly
- mobile Safari and mobile Chrome both look correct

## 9. Immediate post-launch checks

Watch for:

- Clerk redirect misconfiguration
- Stripe webhook signature failures
- broken `NEXT_PUBLIC_URL` links
- drawer/modal layout issues on phones
- form overflow in creator and brand flows

## 10. Nice-to-have follow-up

After launch, consider adding:

- a custom Open Graph image
- analytics
- error monitoring
- a lightweight uptime check for webhook endpoints
