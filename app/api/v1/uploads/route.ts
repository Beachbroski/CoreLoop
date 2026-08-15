import { createRouteHandler, createUploadthing, type FileRouter } from 'uploadthing/next'
import { isTesterEmailAllowed } from '@/lib/admin-config'
import { getCurrentAppUser } from '@/lib/current-app-user'

const f = createUploadthing()

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
    .middleware(async ({ req }) => {
      const authHeader = req.headers.get('authorization')
      if (!authHeader?.startsWith('Bearer ')) throw new Error('Unauthorized')

      const { user } = await getCurrentAppUser()
      if (!user || user.role !== 'CREATOR' || !isTesterEmailAllowed(user.email)) {
        throw new Error(
          'Only allowlisted creator accounts can upload content while CreatorDocks is in waitlist mode',
        )
      }

      return { userId: user.id }
    })
    .onUploadComplete(async ({ metadata, file }) => {
      return { uploadedBy: metadata.userId, url: file.ufsUrl, key: file.key }
    }),
} satisfies FileRouter

export type MobileFileRouter = typeof mobileFileRouter

export const { GET, POST } = createRouteHandler({ router: mobileFileRouter })
