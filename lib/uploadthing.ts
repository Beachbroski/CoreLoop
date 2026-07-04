import { generateUploadButton } from '@uploadthing/react'
import type { OurFileRouter } from '@/app/api/uploadthing/route'

export const UploadButton = generateUploadButton<OurFileRouter>()
