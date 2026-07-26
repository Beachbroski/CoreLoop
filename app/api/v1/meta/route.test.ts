import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/mobile-api-guard', () => ({
  withPublicMobileApi: (_opts: unknown, handler: (req: Request) => Promise<Response>) => handler,
}))

const { GET } = await import('./route')

const originalEnv = { ...process.env }

describe('GET /api/v1/meta', () => {
  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it('returns defaults when no env overrides are set', async () => {
    delete process.env.MOBILE_MIN_SUPPORTED_VERSION
    delete process.env.MOBILE_LATEST_VERSION
    delete process.env.MOBILE_MAINTENANCE_MODE

    const res = await GET(new Request('https://example.com/api/v1/meta'))
    const body = await res.json()

    expect(body).toEqual({
      success: true,
      data: {
        apiVersion: 'v1',
        minSupportedAppVersion: '1.0.0',
        latestAppVersion: '1.0.0',
        maintenanceMode: false,
      },
    })
  })

  it('reflects maintenance mode and version env overrides', async () => {
    process.env.MOBILE_MIN_SUPPORTED_VERSION = '1.2.0'
    process.env.MOBILE_LATEST_VERSION = '1.5.0'
    process.env.MOBILE_MAINTENANCE_MODE = 'true'

    const res = await GET(new Request('https://example.com/api/v1/meta'))
    const body = await res.json()

    expect(body.data).toEqual({
      apiVersion: 'v1',
      minSupportedAppVersion: '1.2.0',
      latestAppVersion: '1.5.0',
      maintenanceMode: true,
    })
  })
})
