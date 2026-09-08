import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  findUniqueMock,
  updateMock,
  deviceDeleteManyMock,
  payoutCountMock,
  payoutDeleteManyMock,
  applicationDeleteManyMock,
  submissionDeleteManyMock,
  transactionMock,
  deleteUserMock,
} = vi.hoisted(() => ({
  findUniqueMock: vi.fn(),
  updateMock: vi.fn(),
  deviceDeleteManyMock: vi.fn(),
  payoutCountMock: vi.fn(),
  payoutDeleteManyMock: vi.fn(),
  applicationDeleteManyMock: vi.fn(),
  submissionDeleteManyMock: vi.fn(),
  transactionMock: vi.fn(),
  deleteUserMock: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  default: {
    user: { findUnique: findUniqueMock, update: updateMock },
    device: { deleteMany: deviceDeleteManyMock },
    payout: { count: payoutCountMock, deleteMany: payoutDeleteManyMock },
    application: { deleteMany: applicationDeleteManyMock },
    submission: { deleteMany: submissionDeleteManyMock },
    $transaction: transactionMock,
  },
}))

vi.mock('@clerk/nextjs/server', () => ({
  clerkClient: async () => ({ users: { deleteUser: deleteUserMock } }),
}))

// The guard itself is covered by lib/mobile-api-guard.test.ts. Here we bypass
// it with a passthrough so these tests exercise only this route's own logic.
vi.mock('@/lib/mobile-api-guard', () => ({
  withMobileApi: (_opts: unknown, handler: (ctx: unknown) => Promise<Response>) => handler,
}))

const { GET, PATCH, DELETE } = await import('./route')

const dbUser = {
  id: 'user_1',
  name: 'Jane Creator',
  email: 'jane@example.com',
  avatarUrl: null,
  bio: null,
  role: 'CREATOR' as const,
  stripeOnboarded: false,
}

function patchRequest(body: unknown): Request {
  return new Request('https://example.com/api/v1/me', {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

describe('GET /api/v1/me', () => {
  beforeEach(() => {
    findUniqueMock.mockReset()
    updateMock.mockReset()
  })

  it('returns the caller\'s own profile, shaped by meResponseSchema', async () => {
    findUniqueMock.mockResolvedValue(dbUser)

    const res = await GET({ req: new Request('https://example.com/api/v1/me'), user: dbUser } as never)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ success: true, data: dbUser })
    expect(findUniqueMock).toHaveBeenCalledWith({ where: { id: 'user_1' }, select: expect.any(Object) })
  })

  it('returns 404 if the profile no longer exists', async () => {
    findUniqueMock.mockResolvedValue(null)

    const res = await GET({ req: new Request('https://example.com/api/v1/me'), user: dbUser } as never)

    expect(res.status).toBe(404)
  })
})

describe('PATCH /api/v1/me', () => {
  beforeEach(() => {
    findUniqueMock.mockReset()
    updateMock.mockReset()
  })

  it('updates name and bio and returns the shaped profile', async () => {
    updateMock.mockResolvedValue({ ...dbUser, name: 'New Name', bio: 'New bio' })

    const res = await PATCH({ req: patchRequest({ name: 'New Name', bio: 'New bio' }), user: dbUser } as never)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.name).toBe('New Name')
    expect(updateMock).toHaveBeenCalledWith({
      where: { id: 'user_1' },
      data: { name: 'New Name', bio: 'New bio' },
      select: expect.any(Object),
    })
  })

  it('rejects an invalid body with 400 and does not touch the database', async () => {
    const res = await PATCH({ req: patchRequest({ name: '' }), user: dbUser } as never)

    expect(res.status).toBe(400)
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('rejects a bio over the length limit', async () => {
    const res = await PATCH({ req: patchRequest({ bio: 'a'.repeat(501) }), user: dbUser } as never)

    expect(res.status).toBe(400)
    expect(updateMock).not.toHaveBeenCalled()
  })
})

const anonymizedFields = {
  name: null,
  avatarUrl: null,
  bio: null,
  email: 'deleted-user_1@deleted.creatordocks.invalid',
  clerkId: 'deleted-user_1',
  stripeAccountId: null,
  stripeOnboarded: false,
}

describe('DELETE /api/v1/me', () => {
  beforeEach(() => {
    findUniqueMock.mockReset()
    updateMock.mockReset()
    deviceDeleteManyMock.mockReset()
    payoutCountMock.mockReset()
    payoutDeleteManyMock.mockReset()
    applicationDeleteManyMock.mockReset()
    submissionDeleteManyMock.mockReset()
    transactionMock.mockReset()
    deleteUserMock.mockReset()

    findUniqueMock.mockResolvedValue({ clerkId: 'clerk_real_id' })
    payoutCountMock.mockResolvedValue(0)
    updateMock.mockResolvedValue({})
    deviceDeleteManyMock.mockResolvedValue({ count: 2 })
    deleteUserMock.mockResolvedValue({})
    transactionMock.mockImplementation(async (ops: unknown) => Promise.all(ops as Promise<unknown>[]))
  })

  it('deletes the Clerk identity before touching the database', async () => {
    const res = await DELETE({ user: dbUser } as never)

    expect(res.status).toBe(200)
    expect(deleteUserMock).toHaveBeenCalledWith('clerk_real_id')
    expect(deleteUserMock.mock.invocationCallOrder[0]).toBeLessThan(
      transactionMock.mock.invocationCallOrder[0],
    )
  })

  it('anonymizes the row and clears the Stripe pointers', async () => {
    await DELETE({ user: dbUser } as never)

    expect(updateMock).toHaveBeenCalledWith({ where: { id: 'user_1' }, data: anonymizedFields })
  })

  it('removes every device row in the same transaction as the anonymization', async () => {
    await DELETE({ user: dbUser } as never)

    expect(deviceDeleteManyMock).toHaveBeenCalledWith({ where: { userId: 'user_1' } })
    expect(transactionMock).toHaveBeenCalledOnce()
    expect(transactionMock.mock.calls[0][0]).toHaveLength(2)
  })

  it('keeps the financial and campaign audit trail', async () => {
    await DELETE({ user: dbUser } as never)

    expect(payoutDeleteManyMock).not.toHaveBeenCalled()
    expect(applicationDeleteManyMock).not.toHaveBeenCalled()
    expect(submissionDeleteManyMock).not.toHaveBeenCalled()
  })

  it('returns 502 and leaves the row untouched when Clerk deletion fails', async () => {
    deleteUserMock.mockRejectedValue(new Error('Clerk API down'))

    const res = await DELETE({ user: dbUser } as never)
    const body = await res.json()

    expect(res.status).toBe(502)
    expect(body.success).toBe(false)
    expect(body.error).toMatch(/again/i)
    expect(transactionMock).not.toHaveBeenCalled()
    expect(updateMock).not.toHaveBeenCalled()
    expect(deviceDeleteManyMock).not.toHaveBeenCalled()
  })

  it('treats an already-deleted Clerk identity as success and finishes the DB half', async () => {
    deleteUserMock.mockRejectedValue(Object.assign(new Error('not found'), { status: 404 }))

    const res = await DELETE({ user: dbUser } as never)

    expect(res.status).toBe(200)
    expect(updateMock).toHaveBeenCalledOnce()
  })

  it('returns 409 with an actionable, non-leaky message while a payout is in flight', async () => {
    payoutCountMock.mockResolvedValue(1)

    const res = await DELETE({ user: dbUser } as never)
    const body = await res.json()

    expect(res.status).toBe(409)
    expect(body.success).toBe(false)
    expect(body.error).toMatch(/payout/i)
    expect(payoutCountMock).toHaveBeenCalledWith({
      where: { creatorId: 'user_1', status: { in: ['PENDING', 'PROCESSING'] } },
    })
    expect(deleteUserMock).not.toHaveBeenCalled()
    expect(transactionMock).not.toHaveBeenCalled()
  })

  it('reports a failure when the database half fails after the identity is gone', async () => {
    transactionMock.mockRejectedValue(new Error('db down'))

    const res = await DELETE({ user: dbUser } as never)
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body.success).toBe(false)
  })

  it('returns 404 if the profile no longer exists', async () => {
    findUniqueMock.mockResolvedValue(null)

    const res = await DELETE({ user: dbUser } as never)

    expect(res.status).toBe(404)
    expect(deleteUserMock).not.toHaveBeenCalled()
    expect(transactionMock).not.toHaveBeenCalled()
  })
})
