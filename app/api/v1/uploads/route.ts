import { createRouteHandler, createUploadthing, type FileRouter } from 'uploadthing/next'
import type { NextRequest } from 'next/server'
import { isTesterEmailAllowed } from '@/lib/admin-config'
import { getCurrentAppUser } from '@/lib/current-app-user'
import { rateLimitBucket } from '@/lib/mobile-api-guard'
import { checkRateLimit, getRequestIp } from '@/lib/request-security'

const f = createUploadthing()

/**
 * Auth check for the mobile content uploader. Extracted to a named function
 * (rather than inlined in `.middleware()`) so it can be unit tested directly —
 * `createRouteHandler`'s Effect runtime is not something a unit test should
 * have to stand up.
 */
export async function resolveMobileUploadContext({ req }: { req: NextRequest }) {
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) throw new Error('Unauthorized')

  const { user } = await getCurrentAppUser()
  if (!user || user.role !== 'CREATOR' || !isTesterEmailAllowed(user.email)) {
    throw new Error(
      'Only allowlisted creator accounts can upload content while CreatorDocks is in waitlist mode',
    )
  }

  return { userId: user.id }
}

// Mobile content uploader. Bearer-authed and cookie-rejected, matching the
// /api/v1 policy: these routes skip the origin-check CSRF defense that
// cookie-auth web routes rely on, so an explicit token is required. Mirrors
// the web `contentUploader` (app/api/uploadthing) auth + limits, but resolves
// the user from the mobile bearer session.
export const mobileFileRouter = {
  mobileContentUploader: f({
    image: { maxFileSize: '16MB', maxFileCount: 5 },
    video: { maxFileSize: '256MB', maxFileCount: 1 },
  })
    .middleware(resolveMobileUploadContext)
    .onUploadComplete(async ({ metadata, file }) => {
      return { uploadedBy: metadata.userId, url: file.ufsUrl, key: file.key }
    }),
} satisfies FileRouter

export type MobileFileRouter = typeof mobileFileRouter

const { GET, POST: uploadthingPost } = createRouteHandler({ router: mobileFileRouter })

export { GET }

/**
 * A creator's client calls this once per file batch to request presigned
 * upload URLs (up to 5 images, or 1 video, per the router config above) —
 * not once per file. 15 requests/minute is generous headroom for retries and
 * re-submissions within a session (one request every 4s on average) while
 * still bounding an authenticated account from minting unlimited presigned
 * URLs, which was the gap: `.middleware()` enforces WHO can upload but nothing
 * previously enforced HOW OFTEN.
 */
const UPLOAD_RATE_LIMIT = { limit: 15, windowMs: 60_000 }

/**
 * UploadThing's ingest servers POST a completion/error callback back to this
 * same route (see proxy.ts, which deliberately makes /api/v1/uploads public
 * so that callback can land). Those requests carry an `uploadthing-hook`
 * header and NO Clerk session — there is no user to key a rate limit on, and
 * gating this path would silently break every upload (the client's presigned
 * PUT succeeds, but the file is never marked complete). So it is excluded
 * before anything else runs, and falls straight through to the real handler.
 *
 * A genuine client request has no `uploadthing-hook` header. For those we
 * resolve the app user the same way `.middleware()` above does, and rate
 * limit on `<userId>:<ip>` — the same key shape `lib/mobile-api-guard.ts`
 * uses for every other authenticated /api/v1 route — via `rateLimitBucket`
 * so this route gets its own budget rather than sharing one with the rest of
 * v1. An unauthenticated or malformed request is left to the real handler,
 * which already rejects it in `.middleware()`; only a request that resolves
 * to a real app user is rate limited here.
 */
export async function POST(req: NextRequest): Promise<Response> {
  if (req.headers.get('uploadthing-hook')) {
    return uploadthingPost(req)
  }

  const authHeader = req.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const { user } = await getCurrentAppUser()
    if (user) {
      const rl = await checkRateLimit(
        `v1:${rateLimitBucket(req)}:${user.id}:${getRequestIp(req)}`,
        UPLOAD_RATE_LIMIT,
      )
      if (!rl.ok) {
        return Response.json(
          { success: false, error: 'Too many requests. Please try again shortly.' },
          { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } },
        )
      }
    }
  }

  return uploadthingPost(req)
}
