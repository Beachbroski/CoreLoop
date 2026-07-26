import { z } from 'zod'

// GET /api/v1/meta (public, unauthenticated). The app checks this on launch
// to decide whether to show a force-update or maintenance screen — see
// docs/platform-split/02-mobile-api.md.
export const metaResponseSchema = z.object({
  apiVersion: z.literal('v1'),
  minSupportedAppVersion: z.string(),
  latestAppVersion: z.string(),
  maintenanceMode: z.boolean(),
})
export type MetaResponse = z.infer<typeof metaResponseSchema>
