import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

const isPublicRoute = createRouteMatcher([
  '/',
  '/waitlist(.*)',
  // Creator-facing marketing. Must be public: it is where sunset-mode creator
  // routes redirect to, and every public "For creators" link points at it — if
  // it were protected, creators would bounce to a sign-in they don't need.
  '/get-the-app(.*)',
  '/privacy(.*)',
  '/terms(.*)',
  '/support(.*)',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/sso-callback(.*)',
  '/icon',
  '/opengraph-image',
  '/api/waitlist',
  '/api/webhooks/(.*)',
  // The whole /api/v1 namespace is "public" to Clerk's middleware on purpose.
  // These routes are NOT unauthenticated: every one is wrapped in
  // lib/mobile-api-guard.ts, which requires an explicit `Authorization: Bearer`
  // header and rejects a cookie-only request outright (the namespace skips the
  // origin-check CSRF defense, so an ambient cookie must never be enough).
  // clerkMiddleware still verifies the Bearer token and populates auth(); what
  // `isPublicRoute` skips is only auth.protect().
  //
  // Why it matters: auth.protect() answers an unauthenticated API request with
  // a 307 to /sign-in (dev) or an HTML 404 rewrite (prod) — never the JSON 401
  // envelope the iOS app is built to handle. So an expired or revoked session
  // surfaced in the app as an unrecoverable "couldn't load" instead of a
  // re-authentication prompt. The two exceptions are equally deliberate:
  // /api/v1/meta is the pre-auth launch check, and /api/v1/uploads
  // authenticates inside its own UploadThing middleware.
  '/api/v1(.*)',
  // UploadThing's ingest servers POST the completion callback back to these
  // routes with no Clerk session at all (they carry their own signed header),
  // so auth.protect() was 404-ing every callback and onUploadComplete never
  // ran in a deployed environment. Client-initiated uploads are still
  // authenticated by each route's own .middleware().
  '/api/uploadthing(.*)',
])

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) await auth.protect()

  // Layouts can't read the request path in the App Router, and the creator
  // sunset redirect needs it. Vercel sets x-matched-path in production but
  // nothing sets it locally, so publish the pathname explicitly here — this
  // makes the redirect deterministic in every environment rather than relying
  // on a header that only exists on one host.
  const requestHeaders = new Headers(req.headers)
  requestHeaders.set('x-pathname', req.nextUrl.pathname)

  return NextResponse.next({ request: { headers: requestHeaders } })
})

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
