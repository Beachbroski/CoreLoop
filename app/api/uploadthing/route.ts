import { createUploadthing, type FileRouter } from 'uploadthing/next'
import { createRouteHandler } from 'uploadthing/next'
import { auth } from '@clerk/nextjs/server'

const f = createUploadthing()

export const ourFileRouter = {
  contentUploader: f({
    image: { maxFileSize: '16MB', maxFileCount: 5 },
    video: { maxFileSize: '256MB', maxFileCount: 1 },
  })
    .middleware(async () => {
      const { userId } = await auth()
      if (!userId) throw new Error('Unauthorized')
      return { userId }
    })
    .onUploadComplete(async ({ metadata, file }) => {
      return { uploadedBy: metadata.userId, url: file.ufsUrl }
    }),
} satisfies FileRouter

export type OurFileRouter = typeof ourFileRouter

export const { GET, POST } = createRouteHandler({ router: ourFileRouter })
