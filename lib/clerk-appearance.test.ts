import { describe, expect, it } from 'vitest'
import { authClerkAppearance } from './clerk-appearance'

/**
 * These links are the ONLY place terms and privacy are presented at web
 * sign-up — there is no separate consent checkbox on either auth page. They sat
 * under a misspelled `options` parent for months, which Clerk silently ignored,
 * so the sign-in and sign-up cards rendered with no legal footer at all.
 *
 * `satisfies Appearance` now makes wrong placement a compile error. It cannot
 * catch someone simply deleting the keys — every field on Clerk's `Layout` is
 * optional — so that is what these assert.
 */
describe('authClerkAppearance legal links', () => {
  it('exposes terms, privacy and help under layout, where Clerk reads them', () => {
    expect(authClerkAppearance.layout).toMatchObject({
      privacyPageUrl: '/privacy',
      termsPageUrl: '/terms',
      helpPageUrl: '/support',
    })
  })

  it('points at routes that exist and are public', () => {
    // proxy.ts lists /privacy, /terms and /support as public routes; a legal
    // link that bounced to /sign-in would defeat the purpose, and App Review
    // checks the privacy URL without signing in.
    for (const url of [
      authClerkAppearance.layout.privacyPageUrl,
      authClerkAppearance.layout.termsPageUrl,
      authClerkAppearance.layout.helpPageUrl,
    ]) {
      expect(url).toMatch(/^\/(privacy|terms|support)$/)
    }
  })

  it('keeps the social-button layout options beside them', () => {
    // Same block, same failure mode: these were also being ignored, so the
    // sign-in card was not laying social buttons out as intended either.
    expect(authClerkAppearance.layout.socialButtonsPlacement).toBe('top')
    expect(authClerkAppearance.layout.socialButtonsVariant).toBe('blockButton')
  })
})
