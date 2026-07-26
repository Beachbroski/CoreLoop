import { describe, expect, it } from 'vitest'
import { metaResponseSchema } from './meta'

describe('metaResponseSchema', () => {
  it('accepts a valid meta payload', () => {
    const result = metaResponseSchema.safeParse({
      apiVersion: 'v1',
      minSupportedAppVersion: '1.0.0',
      latestAppVersion: '1.2.0',
      maintenanceMode: false,
    })
    expect(result.success).toBe(true)
  })

  it('rejects an apiVersion other than v1', () => {
    const result = metaResponseSchema.safeParse({
      apiVersion: 'v2',
      minSupportedAppVersion: '1.0.0',
      latestAppVersion: '1.2.0',
      maintenanceMode: false,
    })
    expect(result.success).toBe(false)
  })
})
