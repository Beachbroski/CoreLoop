import { describe, expect, it } from 'vitest'
import { isAllowedContentUrl } from './content-url'

describe('isAllowedContentUrl', () => {
  it('accepts UploadThing v7 app-subdomain URLs', () => {
    expect(isAllowedContentUrl('https://abc123.ufs.sh/f/somekey')).toBe(true)
  })

  it('accepts legacy utfs.io URLs', () => {
    expect(isAllowedContentUrl('https://utfs.io/f/somekey')).toBe(true)
    expect(isAllowedContentUrl('https://uploads.utfs.io/f/somekey')).toBe(true)
  })

  it('rejects arbitrary hosts', () => {
    expect(isAllowedContentUrl('https://evil.com/f/key')).toBe(false)
    expect(isAllowedContentUrl('https://ufs.sh.evil.com/f/key')).toBe(false)
  })

  it('rejects non-https schemes', () => {
    expect(isAllowedContentUrl('http://abc123.ufs.sh/f/key')).toBe(false)
    expect(isAllowedContentUrl('javascript:alert(1)')).toBe(false)
  })

  it('rejects malformed input', () => {
    expect(isAllowedContentUrl('not a url')).toBe(false)
    expect(isAllowedContentUrl('')).toBe(false)
  })
})
