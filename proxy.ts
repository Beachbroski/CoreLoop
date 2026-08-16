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
  '/api/v1/meta',
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
