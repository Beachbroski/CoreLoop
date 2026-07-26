import { withPublicMobileApi } from '@/lib/mobile-api-guard'
import type { MetaResponse } from '@creatordocks/shared'

export const GET = withPublicMobileApi({ limit: 60, windowMs: 60_000 }, async () => {
  const data: MetaResponse = {
    apiVersion: 'v1',
    minSupportedAppVersion: process.env.MOBILE_MIN_SUPPORTED_VERSION ?? '1.0.0',
    latestAppVersion: process.env.MOBILE_LATEST_VERSION ?? '1.0.0',
    maintenanceMode: process.env.MOBILE_MAINTENANCE_MODE === 'true',
  }

  return Response.json({ success: true, data })
})
