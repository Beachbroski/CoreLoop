import { beforeEach, describe, expect, it, vi } from 'vitest'

const { findUniqueMock, updateMock, retrieveMock } = vi.hoisted(() => ({
  findUniqueMock: vi.fn(),
  updateMock: vi.fn(),
  retrieveMock: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  default: { user: { findUnique: findUniqueMock, update: updateMock } },
}))

vi.mock('@/lib/stripe', () => ({ stripe: { accounts: { retrieve: retrieveMock } } }))

vi.mock('@/lib/mobile-api-guard', () => ({
  withMobileApi: (_opts: unknown, handler: (ctx: unknown) => Promise<Response>) => handler,
}))

const { GET } = await import('./route')

const creator = { id: 'user_1', email: 'creator@example.com', name: null, role: 'CREATOR' as const }

/** A Stripe account in the one shape that means "can be paid". */
const readyAccount = {
  details_submitted: true,
  payouts_enabled: true,
  capabilities: { transfers: 'active' },
}

function ctx() {
  return { req: new Request('https://example.com/api/v1/stripe/status'), user: creator }
}

async function get() {
  const res = await GET(ctx() as never)
  return (await res.json()).data
}

/**
 * This route deliberately does NOT just mirror `stripeOnboarded`. The column's
 * other writer is the `account.updated` webhook, which the app cannot wait on:
 * it polls the moment onboarding returns (a race the webhook often loses), and
 * locally no webhook is delivered at all. So the account is retrieved live, and
 * the column is corrected from it.
 */
describe('GET /api/v1/stripe/status', () => {
  beforeEach(() => {
    findUniqueMock.mockReset()
    updateMock.mockReset()
    retrieveMock.mockReset()
  })

  it('reports not onboarded, without calling Stripe, when there is no Connect account', async () => {
    findUniqueMock.mockResolvedValue({ stripeOnboarded: false, stripeAccountId: null })

    expect(await get()).toEqual({ onboarded: false })
    expect(retrieveMock).not.toHaveBeenCalled()
  })

  it('promotes a creator the webhook has not caught up on yet', async () => {
    findUniqueMock.mockResolvedValue({ stripeOnboarded: false, stripeAccountId: 'acct_1' })
    retrieveMock.mockResolvedValue(readyAccount)

    expect(await get()).toEqual({ onboarded: true })
    expect(retrieveMock).toHaveBeenCalledWith('acct_1')
    expect(updateMock).toHaveBeenCalledWith({
      where: { id: 'user_1' },
      data: { stripeOnboarded: true },
    })
  })

  it('demotes a creator Stripe has since disabled', async () => {
    findUniqueMock.mockResolvedValue({ stripeOnboarded: true, stripeAccountId: 'acct_1' })
    retrieveMock.mockResolvedValue({ ...readyAccount, payouts_enabled: false })

    expect(await get()).toEqual({ onboarded: false })
    expect(updateMock).toHaveBeenCalledWith({
      where: { id: 'user_1' },
      data: { stripeOnboarded: false },
    })
  })

  it('does not write when Stripe agrees with the stored value', async () => {
    findUniqueMock.mockResolvedValue({ stripeOnboarded: true, stripeAccountId: 'acct_1' })
    retrieveMock.mockResolvedValue(readyAccount)

    expect(await get()).toEqual({ onboarded: true })
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('falls back to the stored value when Stripe is unreachable', async () => {
    // The Earnings tab is the only place a creator sees their money; a Stripe
    // outage must not take the whole screen down with it.
    findUniqueMock.mockResolvedValue({ stripeOnboarded: true, stripeAccountId: 'acct_1' })
    retrieveMock.mockRejectedValue(new Error('stripe is down'))

    expect(await get()).toEqual({ onboarded: true })
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('404s when the user row is missing', async () => {
    findUniqueMock.mockResolvedValue(null)

    const res = await GET(ctx() as never)
    expect(res.status).toBe(404)
  })
})
