import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import {
  ADMIN_SECRET_HEADER,
  getInternalAdminRewritePath,
  isInternalAdminPath,
  isProductionDeployment,
} from '@/lib/admin-config'

const isPublicRoute = createRouteMatcher([
  '/',
  '/waitlist(.*)',
  '/privacy(.*)',
  '/terms(.*)',
  '/support(.*)',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/sso-callback(.*)',
  '/api/waitlist',
  '/api/webhooks/(.*)',
])

export default clerkMiddleware(async (auth, req) => {
  const adminRewritePath = getInternalAdminRewritePath(req.nextUrl.pathname)
  if (adminRewritePath) {
    await auth.protect()

    const rewriteUrl = req.nextUrl.clone()
    rewriteUrl.pathname = adminRewritePath

    const requestHeaders = new Headers(req.headers)
    requestHeaders.set(ADMIN_SECRET_HEADER, '1')

    return NextResponse.rewrite(rewriteUrl, {
      request: {
        headers: requestHeaders,
      },
    })
  }

  if (isProductionDeployment() && isInternalAdminPath(req.nextUrl.pathname)) {
    return NextResponse.rewrite(new URL('/404', req.url))
  }

  if (!isPublicRoute(req)) await auth.protect()
})

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
