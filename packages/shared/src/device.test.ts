import { describe, expect, it } from 'vitest'
import { registerDeviceRequestSchema } from './device'

describe('registerDeviceRequestSchema', () => {
  it('accepts a valid device registration', () => {
    const result = registerDeviceRequestSchema.safeParse({
      expoPushToken: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]',
      platform: 'ios',
    })
    expect(result.success).toBe(true)
  })

  it('rejects an unknown platform', () => {
    const result = registerDeviceRequestSchema.safeParse({
      expoPushToken: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]',
      platform: 'web',
    })
    expect(result.success).toBe(false)
  })

  it('rejects an empty token', () => {
    const result = registerDeviceRequestSchema.safeParse({ expoPushToken: '', platform: 'ios' })
    expect(result.success).toBe(false)
  })
})
