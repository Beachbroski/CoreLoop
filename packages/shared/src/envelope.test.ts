import { describe, expect, it } from 'vitest'
import { apiResponseSchema } from './envelope'
import { z } from 'zod'

describe('apiResponseSchema', () => {
  const schema = apiResponseSchema(z.object({ id: z.string() }))

  it('accepts a valid success envelope', () => {
    const result = schema.safeParse({ success: true, data: { id: 'abc' } })
    expect(result.success).toBe(true)
  })

  it('accepts a valid error envelope', () => {
    const result = schema.safeParse({ success: false, error: 'Not found' })
    expect(result.success).toBe(true)
  })

  it('rejects success:true without matching data', () => {
    const result = schema.safeParse({ success: true, data: { id: 42 } })
    expect(result.success).toBe(false)
  })

  it('rejects an envelope missing both data and error', () => {
    const result = schema.safeParse({ success: true })
    expect(result.success).toBe(false)
  })

  it('accepts pagination meta', () => {
    const result = schema.safeParse({
      success: true,
      data: { id: 'abc' },
      meta: { total: 100, page: 1, limit: 20 },
    })
    expect(result.success).toBe(true)
  })
})
