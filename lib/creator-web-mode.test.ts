import { afterEach, describe, expect, it } from 'vitest'
import {
  CREATOR_WRITE_BLOCKED_ERROR,
  GET_THE_APP_PATH,
  creatorWriteBlockedResponse,
  getCreatorWebMode,
  isCreatorPathSunsetExempt,
  isCreatorWriteAllowed,
  parseCreatorWebMode,
  readRequestPathname,
  resolveCreatorSunsetRedirect,
} from './creator-web-mode'

const originalMode = process.env.CREATOR_WEB_MODE

function setMode(value: string | undefined) {
  if (value === undefined) {
    delete process.env.CREATOR_WEB_MODE
    return
  }

  process.env.CREATOR_WEB_MODE = value
}

afterEach(() => {
  setMode(originalMode)
})

describe('parseCreatorWebMode', () => {
  it('accepts every documented mode', () => {
    expect(parseCreatorWebMode('full')).toBe('full')
    expect(parseCreatorWebMode('readonly')).toBe('readonly')
    expect(parseCreatorWebMode('sunset')).toBe('sunset')
  })

  it('tolerates casing and surrounding whitespace from env files', () => {
    expect(parseCreatorWebMode('  FULL ')).toBe('full')
    expect(parseCreatorWebMode('ReadOnly')).toBe('readonly')
  })

  it('defaults to sunset for unset, empty, and garbage values', () => {
    expect(parseCreatorWebMode(undefined)).toBe('sunset')
    expect(parseCreatorWebMode(null)).toBe('sunset')
    expect(parseCreatorWebMode('')).toBe('sunset')
    expect(parseCreatorWebMode('   ')).toBe('sunset')
    expect(parseCreatorWebMode('read-only')).toBe('sunset')
    expect(parseCreatorWebMode('true')).toBe('sunset')
  })
})

describe('getCreatorWebMode', () => {
  it('reads the mode from the environment', () => {
    setMode('full')
    expect(getCreatorWebMode()).toBe('full')

    setMode('readonly')
    expect(getCreatorWebMode()).toBe('readonly')

    setMode('sunset')
    expect(getCreatorWebMode()).toBe('sunset')
  })

  it('falls back to sunset when the variable is missing or invalid', () => {
    setMode(undefined)
    expect(getCreatorWebMode()).toBe('sunset')

    setMode('nonsense')
    expect(getCreatorWebMode()).toBe('sunset')
  })
})

describe('isCreatorWriteAllowed', () => {
  it('allows writes only in full mode', () => {
    setMode('full')
    expect(isCreatorWriteAllowed()).toBe(true)

    setMode('readonly')
    expect(isCreatorWriteAllowed()).toBe(false)

    setMode('sunset')
    expect(isCreatorWriteAllowed()).toBe(false)
  })

  it('blocks writes when the variable is unset or invalid', () => {
    setMode(undefined)
    expect(isCreatorWriteAllowed()).toBe(false)

    setMode('yes')
    expect(isCreatorWriteAllowed()).toBe(false)
  })
})

describe('creatorWriteBlockedResponse', () => {
  it('returns null in full mode so handlers continue', () => {
    setMode('full')
    expect(creatorWriteBlockedResponse()).toBeNull()
  })

  it('returns a 403 with the app-handoff message in readonly mode', async () => {
    setMode('readonly')
    const res = creatorWriteBlockedResponse()

    expect(res).not.toBeNull()
    expect(res?.status).toBe(403)
    await expect(res?.json()).resolves.toEqual({ error: CREATOR_WRITE_BLOCKED_ERROR })
  })

  it('also blocks in sunset mode', () => {
    setMode('sunset')
    expect(creatorWriteBlockedResponse()?.status).toBe(403)
  })

  it('blocks by default when the variable is unset', () => {
    setMode(undefined)
    expect(creatorWriteBlockedResponse()?.status).toBe(403)
  })
})

describe('readRequestPathname', () => {
  it('prefers x-pathname, then x-matched-path, then next-url', () => {
    expect(
      readRequestPathname(
        new Headers({ 'x-pathname': '/creator/settings', 'x-matched-path': '/creator', 'next-url': '/creator' }),
      ),
    ).toBe('/creator/settings')

    expect(readRequestPathname(new Headers({ 'x-matched-path': '/creator', 'next-url': '/creator/payouts' }))).toBe('/creator')
    expect(readRequestPathname(new Headers({ 'next-url': '/creator/payouts' }))).toBe('/creator/payouts')
  })

  it('strips query strings, fragments, and trailing slashes', () => {
    expect(readRequestPathname(new Headers({ 'x-pathname': '/creator/settings?onboarded=true' }))).toBe('/creator/settings')
    expect(readRequestPathname(new Headers({ 'x-pathname': '/creator/settings#stripe' }))).toBe('/creator/settings')
    expect(readRequestPathname(new Headers({ 'x-pathname': '/creator/settings/' }))).toBe('/creator/settings')
  })

  it('ignores values that are not root-relative paths', () => {
    expect(readRequestPathname(new Headers({ 'x-pathname': 'https://evil.test/creator/settings' }))).toBeNull()
    expect(readRequestPathname(new Headers({ 'x-pathname': '   ' }))).toBeNull()
  })

  it('returns null when no header carries a path', () => {
    expect(readRequestPathname(new Headers())).toBeNull()
  })
})

describe('isCreatorPathSunsetExempt', () => {
  it('exempts the Stripe onboarding return path and anything under it', () => {
    expect(isCreatorPathSunsetExempt('/creator/settings')).toBe(true)
    expect(isCreatorPathSunsetExempt('/creator/settings/payouts')).toBe(true)
  })

  it('does not exempt other creator paths', () => {
    expect(isCreatorPathSunsetExempt('/creator')).toBe(false)
    expect(isCreatorPathSunsetExempt('/creator/campaigns')).toBe(false)
    // Prefix-only matches must not slip through.
    expect(isCreatorPathSunsetExempt('/creator/settings-export')).toBe(false)
  })
})

describe('resolveCreatorSunsetRedirect', () => {
  it('never redirects in full or readonly mode', () => {
    setMode('full')
    expect(resolveCreatorSunsetRedirect('/creator')).toBeNull()

    setMode('readonly')
    expect(resolveCreatorSunsetRedirect('/creator')).toBeNull()
  })

  it('redirects creator dashboard routes in sunset mode', () => {
    setMode('sunset')
    expect(resolveCreatorSunsetRedirect('/creator')).toBe(GET_THE_APP_PATH)
    expect(resolveCreatorSunsetRedirect('/creator/campaigns')).toBe(GET_THE_APP_PATH)
    expect(resolveCreatorSunsetRedirect('/creator/applications')).toBe(GET_THE_APP_PATH)
    expect(resolveCreatorSunsetRedirect('/creator/payouts')).toBe(GET_THE_APP_PATH)
  })

  it('keeps the Stripe return path reachable in sunset mode', () => {
    setMode('sunset')
    expect(resolveCreatorSunsetRedirect('/creator/settings')).toBeNull()
  })

  it('fails open when the pathname cannot be determined', () => {
    setMode('sunset')
    expect(resolveCreatorSunsetRedirect(null)).toBeNull()
  })

  it('redirects by default when the variable is unset', () => {
    setMode(undefined)
    expect(resolveCreatorSunsetRedirect('/creator')).toBe(GET_THE_APP_PATH)
    expect(resolveCreatorSunsetRedirect('/creator/settings')).toBeNull()
  })
})
