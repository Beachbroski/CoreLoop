import { describe, expect, it } from 'vitest'
import { createSubmissionRequestSchema, resubmitSubmissionRequestSchema, submissionSchema } from './submission'

describe('createSubmissionRequestSchema', () => {
  it('accepts content uploaded through CreatorDocks', () => {
    const result = createSubmissionRequestSchema.safeParse({
      applicationId: 'app_1',
      contentUrl: 'https://abc123.ufs.sh/f/uploaded-key',
    })
    expect(result.success).toBe(true)
  })

  it('rejects a non-URL contentUrl', () => {
    const result = createSubmissionRequestSchema.safeParse({
      applicationId: 'app_1',
      contentUrl: 'not-a-url',
    })
    expect(result.success).toBe(false)
  })

  // Submissions are rendered as a clickable link in the brand's dashboard, so an
  // arbitrary external URL is not acceptable content — see content-url.ts.
  it('rejects an arbitrary external URL', () => {
    const result = createSubmissionRequestSchema.safeParse({
      applicationId: 'app_1',
      contentUrl: 'https://tiktok.com/@creator/video/123',
    })
    expect(result.success).toBe(false)
  })
})

describe('resubmitSubmissionRequestSchema', () => {
  it('requires a contentUrl', () => {
    const result = resubmitSubmissionRequestSchema.safeParse({ caption: 'hi' })
    expect(result.success).toBe(false)
  })
})

describe('submissionSchema', () => {
  it('accepts a valid submission response', () => {
    const result = submissionSchema.safeParse({
      id: 'sub_1',
      applicationId: 'app_1',
      contentUrl: 'https://tiktok.com/@creator/video/123',
      caption: null,
      notes: null,
      status: 'PENDING',
      reviewNote: null,
      createdAt: '2026-07-01T00:00:00.000Z',
      application: { id: 'app_1', campaign: { id: 'camp_1', title: 'Summer glow-up' } },
    })
    expect(result.success).toBe(true)
  })

  it('accepts REVISION_REQUESTED as a valid status', () => {
    const result = submissionSchema.safeParse({
      id: 'sub_1',
      applicationId: 'app_1',
      contentUrl: 'https://tiktok.com/@creator/video/123',
      caption: null,
      notes: null,
      status: 'REVISION_REQUESTED',
      reviewNote: 'Please retake in landscape',
      createdAt: '2026-07-01T00:00:00.000Z',
      application: { id: 'app_1', campaign: { id: 'camp_1', title: 'Summer glow-up' } },
    })
    expect(result.success).toBe(true)
  })
})
