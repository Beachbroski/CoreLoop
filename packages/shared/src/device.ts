import { z } from 'zod'

// POST /api/v1/devices
export const registerDeviceRequestSchema = z.object({
  expoPushToken: z.string().min(1).max(200),
  platform: z.enum(['ios', 'android']),
})
export type RegisterDeviceRequest = z.infer<typeof registerDeviceRequestSchema>
