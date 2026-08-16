import { describe, expect, it } from 'vitest'
import { contentUrlSchema, isAllowedContentUrl, MAX_CONTENT_URL_LENGTH } from './content-url'
import { createSubmissionRequestSchema, resubmitSubmissionRequestSchema } from './submission'

describe('isAllowedContentUrl', () => {
  it('accepts UploadThing hosts over https', () => {
    expect(isAllowedContentUrl('https://abc123.ufs.sh/f/somekey')).toBe(true)
    expect(isAllowedContentUrl('https://utfs.io/f/somekey')).toBe(true)
    expect(isAllowedContentUrl('https://uploads.utfs.io/f/somekey')).toBe(true)
  })

  // The whole point of this module: zod's .url() accepts these.
  it('rejects dangerous URL schemes', () => {
    expect(isAllowedContentUrl('javascript:alert(1)')).toBe(false)
    expect(isAllowedContentUrl('JavaScript:alert(1)')).toBe(false)
    expect(isAllowedContentUrl('data:text/html,<script>alert(1)</script>')).toBe(false)
    expect(isAllowedContentUrl('vbscript:msgbox(1)')).toBe(false)
    expect(isAllowedContentUrl('file:///etc/passwd')).toBe(false)
    expect(isAllowedContentUrl('blob:https://abc123.ufs.sh/x')).toBe(false)
  })

  it('rejects arbitrary and look-alike hosts', () => {
    expect(isAllowedContentUrl('https://evil.com/f/key')).toBe(false)
    expect(isAllowedContentUrl('https://ufs.sh.evil.com/f/key')).toBe(false)
    expect(isAllowedContentUrl('https://notutfs.io/f/key')).toBe(false)
    expect(isAllowedContentUrl('https://tiktok.com/@creator/video/1')).toBe(false)
  })

  it('rejects http (downgrade) even on an allowed host', () => {
    expect(isAllowedContentUrl('http://abc123.ufs.sh/f/key')).toBe(false)
  })

  it('rejects malformed and oversized input', () => {
    expect(isAllowedContentUrl('')).toBe(false)
    expect(isAllowedContentUrl('not a url')).toBe(false)
    expect(isAllowedContentUrl(`https://abc.ufs.sh/f/${'x'.repeat(MAX_CONTENT_URL_LENGTH)}`)).toBe(false)
  })
})

describe('submission request schemas enforce the allowlist', () => {
  const base = { applicationId: 'app_1' }

  it('rejects a javascript: contentUrl on create', () => {
    const result = createSubmissionRequestSchema.safeParse({
      ...base,
      contentUrl: 'javascript:alert(1)',
    })
    expect(result.success).toBe(false)
  })

  it('rejects a javascript: contentUrl on resubmit', () => {
    expect(resubmitSubmissionRequestSchema.safeParse({ contentUrl: 'javascript:alert(1)' }).success).toBe(
      false,
    )
  })

  it('accepts a real uploaded URL', () => {
    expect(
      createSubmissionRequestSchema.safeParse({ ...base, contentUrl: 'https://abc.ufs.sh/f/key' }).success,
    ).toBe(true)
  })

  it('is reachable directly as contentUrlSchema', () => {
    expect(contentUrlSchema.safeParse('https://abc.ufs.sh/f/key').success).toBe(true)
    expect(contentUrlSchema.safeParse('javascript:alert(1)').success).toBe(false)
  })
})
