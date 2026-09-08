import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

const {
  verifyMock,
  getHeadersMock,
  findFirstMock,
  findUniqueMock,
  updateMock,
  deviceDeleteManyMock,
  payoutDeleteManyMock,
  transactionMock,
} = vi.hoisted(() => ({
  verifyMock: vi.fn(),
  getHeadersMock: vi.fn(),
  findFirstMock: vi.fn(),
  findUniqueMock: vi.fn(),
  updateMock: vi.fn(),
  deviceDeleteManyMock: vi.fn(),
  payoutDeleteManyMock: vi.fn(),
  transactionMock: vi.fn(),
}))

vi.mock('svix', () => ({
  Webhook: class {
    verify(body: string, headers: Record<string, string>) {
      return verifyMock(body, headers)
    }
  },
}))

vi.mock('next/headers', () => ({ headers: getHeadersMock }))

vi.mock('@/lib/prisma', () => ({
  default: {
    user: { findFirst: findFirstMock, findUnique: findUniqueMock, update: updateMock },
    device: { deleteMany: deviceDeleteManyMock },
    payout: { deleteMany: payoutDeleteManyMock },
    $transaction: transactionMock,
  },
}))

const { POST } = await import('./route')

const originalEnv = { ...process.env }

const SIGNED_HEADERS = {
  'svix-id': 'msg_1',
  'svix-timestamp': '1757200000',
  'svix-signature': 'v1,signature',
}

function webhookRequest(payload: unknown): Request {
  return new Request('https://example.com/api/webhooks/clerk', {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: { 'content-type': 'application/json' },
  })
}

const userDeletedEvent = {
  type: 'user.deleted',
  data: { object: 'user', id: 'clerk_real_id', deleted: true },
}

describe('POST /api/webhooks/clerk', () => {
  beforeEach(() => {
    process.env = { ...originalEnv, CLERK_WEBHOOK_SECRET: 'whsec_test' }
    verifyMock.mockReset()
    getHeadersMock.mockReset()
    findFirstMock.mockReset()
    findUniqueMock.mockReset()
    updateMock.mockReset()
    deviceDeleteManyMock.mockReset()
    payoutDeleteManyMock.mockReset()
    transactionMock.mockReset()

    getHeadersMock.mockResolvedValue(new Headers(SIGNED_HEADERS))
    updateMock.mockResolvedValue({})
    deviceDeleteManyMock.mockResolvedValue({ count: 1 })
    transactionMock.mockImplementation(async (ops: unknown) => Promise.all(ops as Promise<unknown>[]))
  })

  afterAll(() => {
    process.env = { ...originalEnv }
  })

  it('rejects a request with missing svix headers before reading the body', async () => {
    getHeadersMock.mockResolvedValue(new Headers())

    const res = await POST(webhookRequest(userDeletedEvent))

    expect(res.status).toBe(400)
    expect(verifyMock).not.toHaveBeenCalled()
    expect(transactionMock).not.toHaveBeenCalled()
  })

  it('rejects an unverifiable signature and writes nothing', async () => {
    verifyMock.mockImplementation(() => {
      throw new Error('bad signature')
    })

    const res = await POST(webhookRequest(userDeletedEvent))

    expect(res.status).toBe(400)
    expect(await res.text()).toBe('Invalid signature')
    expect(transactionMock).not.toHaveBeenCalled()
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('anonymizes the matching row and drops its devices on user.deleted', async () => {
    verifyMock.mockReturnValue(userDeletedEvent)
    findUniqueMock.mockResolvedValue({ id: 'user_1' })

    const res = await POST(webhookRequest(userDeletedEvent))

    expect(res.status).toBe(200)
    expect(findUniqueMock).toHaveBeenCalledWith({
      where: { clerkId: 'clerk_real_id' },
      select: { id: true },
    })
    expect(updateMock).toHaveBeenCalledWith({
      where: { id: 'user_1' },
      data: {
        name: null,
        avatarUrl: null,
        bio: null,
        email: 'deleted-user_1@deleted.creatordocks.invalid',
        clerkId: 'deleted-user_1',
        stripeAccountId: null,
        stripeOnboarded: false,
      },
    })
    expect(deviceDeleteManyMock).toHaveBeenCalledWith({ where: { userId: 'user_1' } })
    expect(transactionMock).toHaveBeenCalledOnce()
    expect(payoutDeleteManyMock).not.toHaveBeenCalled()
  })

  it('acknowledges a user.deleted for a row that is already anonymized', async () => {
    verifyMock.mockReturnValue(userDeletedEvent)
    findUniqueMock.mockResolvedValue(null)

    const res = await POST(webhookRequest(userDeletedEvent))

    expect(res.status).toBe(200)
    expect(transactionMock).not.toHaveBeenCalled()
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('acknowledges a user.deleted payload with no id without writing', async () => {
    verifyMock.mockReturnValue({ type: 'user.deleted', data: { object: 'user', deleted: true } })

    const res = await POST(webhookRequest({}))

    expect(res.status).toBe(200)
    expect(findUniqueMock).not.toHaveBeenCalled()
    expect(transactionMock).not.toHaveBeenCalled()
  })

  it('returns 500 when the anonymization fails so Clerk redelivers', async () => {
    verifyMock.mockReturnValue(userDeletedEvent)
    findUniqueMock.mockResolvedValue({ id: 'user_1' })
    transactionMock.mockRejectedValue(new Error('db down'))

    const res = await POST(webhookRequest(userDeletedEvent))

    expect(res.status).toBe(500)
  })

  it('still syncs an existing row on user.created', async () => {
    verifyMock.mockReturnValue({
      type: 'user.created',
      data: {
        id: 'clerk_new',
        email_addresses: [{ email_address: 'jane@example.com' }],
        first_name: 'Jane',
        last_name: 'Creator',
        image_url: 'https://img.example.com/jane.png',
      },
    })
    findFirstMock.mockResolvedValue({ id: 'user_1' })

    const res = await POST(webhookRequest({}))

    expect(res.status).toBe(200)
    expect(updateMock).toHaveBeenCalledWith({
      where: { id: 'user_1' },
      data: {
        clerkId: 'clerk_new',
        email: 'jane@example.com',
        name: 'Jane Creator',
        avatarUrl: 'https://img.example.com/jane.png',
      },
    })
  })
})
