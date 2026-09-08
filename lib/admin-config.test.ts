import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  getMarketplaceAccess,
  isAdminEmailAllowed,
  isAllowedAdminUser,
  isMarketplaceOpen,
  isTesterEmailAllowed,
} from './admin-config'

const originalEnv = { ...process.env }

/** Production, so the "empty allowlist opens local dev" escape hatch is off. */
function setEnv(vars: Record<string, string | undefined>) {
  process.env = { ...originalEnv, NODE_ENV: 'production', VERCEL_ENV: 'production', ...vars }
}

describe('MARKETPLACE_ACCESS', () => {
  beforeEach(() => setEnv({}))
  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it('defaults to invite-only when unset', () => {
    setEnv({ MARKETPLACE_ACCESS: undefined })

    expect(getMarketplaceAccess()).toBe('invite')
    expect(isMarketplaceOpen()).toBe(false)
  })

  // The whole point of the default: a typo must never be the thing that opens
  // the marketplace. Mirrors CREATOR_WEB_MODE's fail-closed contract.
  it.each(['', '  ', 'Open ', 'opne', 'true', 'yes', 'invite'])(
    'resolves %o to invite rather than open',
    value => {
      setEnv({ MARKETPLACE_ACCESS: value })

      expect(isMarketplaceOpen()).toBe(value.trim().toLowerCase() === 'open')
    },
  )

  it('opens on exactly "open", case- and whitespace-insensitively', () => {
    for (const value of ['open', 'OPEN', ' Open ']) {
      setEnv({ MARKETPLACE_ACCESS: value })
      expect(isMarketplaceOpen()).toBe(true)
    }
  })
})

describe('isTesterEmailAllowed', () => {
  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it('enforces the allowlist while invite-only', () => {
    setEnv({ TESTER_ALLOWED_EMAILS: 'tester@example.com' })

    expect(isTesterEmailAllowed('tester@example.com')).toBe(true)
    expect(isTesterEmailAllowed('TESTER@example.com')).toBe(true)
    expect(isTesterEmailAllowed('stranger@example.com')).toBe(false)
    expect(isTesterEmailAllowed(null)).toBe(false)
  })

  it('admits any signed-in email once open, including one not on any list', () => {
    setEnv({ MARKETPLACE_ACCESS: 'open', TESTER_ALLOWED_EMAILS: 'tester@example.com' })

    expect(isTesterEmailAllowed('stranger@example.com')).toBe(true)
    expect(isTesterEmailAllowed('tester@example.com')).toBe(true)
  })

  it('stays closed in production when no allowlist is configured and access is invite-only', () => {
    setEnv({ TESTER_ALLOWED_EMAILS: undefined, ADMIN_ALLOWED_EMAILS: undefined })

    expect(isTesterEmailAllowed('anyone@example.com')).toBe(false)
  })
})

// The flag governs marketplace access only. Admin is a separate, stricter gate
// and opening self-serve must not widen it by even one account.
describe('admin access is unaffected by MARKETPLACE_ACCESS', () => {
  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it('does not admit a non-admin email to the admin surface when open', () => {
    setEnv({ MARKETPLACE_ACCESS: 'open', ADMIN_ALLOWED_EMAILS: 'boss@example.com' })

    expect(isAdminEmailAllowed('stranger@example.com')).toBe(false)
    expect(isAllowedAdminUser({ email: 'stranger@example.com', role: 'ADMIN' })).toBe(false)
    expect(isAllowedAdminUser({ email: 'boss@example.com', role: 'BRAND' })).toBe(false)
    expect(isAllowedAdminUser({ email: 'boss@example.com', role: 'ADMIN' })).toBe(true)
  })

  it('keeps the admin surface closed in production with no allowlist, even when open', () => {
    setEnv({ MARKETPLACE_ACCESS: 'open', ADMIN_ALLOWED_EMAILS: undefined })

    expect(isAdminEmailAllowed('anyone@example.com')).toBe(false)
  })
})
