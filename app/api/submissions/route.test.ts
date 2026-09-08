import { describe, expect, it } from 'vitest'
import { contentUrlSchema } from '@creatordocks/shared'

/**
 * The legacy web submission route validated `contentUrl` with a bare
 * `z.string().url()` until 2026-09-07, so it accepted `javascript:` and any
 * host — the H-3 hardening (cacff54) had only reached `/api/v1`. The brand
 * dashboard renders this value as an href, so a hostile scheme stored here was
 * one click away from executing in a brand's session.
 *
 * These assert the schema the route now shares with the mobile namespace.
 */
describe('submission contentUrl validation (shared by web and /api/v1)', () => {
  it.each([
    ['javascript:alert(1)', 'script scheme'],
    ['data:text/html,<script>alert(1)</script>', 'data scheme'],
    ['vbscript:msgbox(1)', 'vbscript scheme'],
    ['file:///etc/passwd', 'local file'],
    ['http://utfs.io/f/abc', 'http downgrade'],
    ['https://evil.example.com/f/abc', 'off-host'],
    ['https://utfs.io.evil.com/f/abc', 'look-alike host'],
  ])('rejects %s (%s)', url => {
    expect(contentUrlSchema.safeParse(url).success).toBe(false)
  })

  it('accepts a URL from our own UploadThing hosts', () => {
    expect(contentUrlSchema.safeParse('https://utfs.io/f/abcdef123456').success).toBe(true)
  })

  it('rejects a URL past the length cap', () => {
    expect(contentUrlSchema.safeParse(`https://utfs.io/f/${'a'.repeat(4000)}`).success).toBe(false)
  })
})
