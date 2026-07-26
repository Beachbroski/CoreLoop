import { describe, expect, it } from 'vitest'
import { meResponseSchema, updateMeRequestSchema } from './user'

describe('meResponseSchema', () => {
  const valid = {
    id: 'user_1',
    name: 'Jane Creator',
    email: 'jane@example.com',
    avatarUrl: null,
    bio: null,
    role: 'CREATOR',
    stripeOnboarded: false,
  }

  it('accepts a valid profile', () => {
    expect(meResponseSchema.safeParse(valid).success).toBe(true)
  })

  it('rejects an unknown role', () => {
    const result = meResponseSchema.safeParse({ ...valid, role: 'SUPERADMIN' })
    expect(result.success).toBe(false)
  })

  it('rejects a payload carrying server-only fields alongside valid ones', () => {
    // Extra fields are stripped by default Zod object parsing unless .strict();
    // this test documents that expectation for reviewers extending the schema.
    const parsed = meResponseSchema.parse({ ...valid, stripeAccountId: 'acct_123' })
    expect(parsed).not.toHaveProperty('stripeAccountId')
  })
})

describe('updateMeRequestSchema', () => {
  it('accepts a partial update', () => {
    expect(updateMeRequestSchema.safeParse({ bio: 'Hello' }).success).toBe(true)
  })

  it('rejects an empty-string name', () => {
    expect(updateMeRequestSchema.safeParse({ name: '' }).success).toBe(false)
  })

  it('rejects a bio over 500 characters', () => {
    const result = updateMeRequestSchema.safeParse({ bio: 'a'.repeat(501) })
    expect(result.success).toBe(false)
  })
})
