import prisma from '@/lib/prisma'
import { withMobileApi } from '@/lib/mobile-api-guard'
import { isAllowedContentUrl, resubmitSubmissionRequestSchema, submissionSchema } from '@creatordocks/shared'

type RouteContext = { params: Promise<{ id: string }> }

const applicationSummarySelect = {
  id: true,
  campaign: { select: { id: true, title: true } },
} as const

function toSubmissionResponse(submission: {
  id: string
  applicationId: string
  contentUrl: string
  caption: string | null
  notes: string | null
  status: string
  reviewNote: string | null
  createdAt: Date
  application: { id: string; campaign: { id: string; title: string } }
}) {
  return submissionSchema.parse({ ...submission, createdAt: submission.createdAt.toISOString() })
}

// A creator may resubmit only from these states — PENDING is already
// awaiting review and APPROVED is terminal (payout may already be
// released against it).
const RESUBMITTABLE_STATUSES = new Set(['REVISION_REQUESTED', 'REJECTED'])

export const GET = withMobileApi<RouteContext>(
  { rateLimit: { limit: 60, windowMs: 60_000 }, role: 'CREATOR' },
  async ({ user, context }) => {
    const { id } = await context.params

    const submission = await prisma.submission.findUnique({
      where: { id },
      include: { application: { select: applicationSummarySelect } },
    })

    if (!submission || submission.creatorId !== user.id) {
      return Response.json({ success: false, error: 'Submission not found' }, { status: 404 })
    }

    return Response.json({ success: true, data: toSubmissionResponse(submission) })
  },
)

export const PATCH = withMobileApi<RouteContext>(
  { rateLimit: { limit: 20, windowMs: 60_000 }, role: 'CREATOR' },
  async ({ req, user, context }) => {
    const { id } = await context.params

    const submission = await prisma.submission.findUnique({ where: { id } })
    if (!submission || submission.creatorId !== user.id) {
      return Response.json({ success: false, error: 'Submission not found' }, { status: 404 })
    }

    if (!RESUBMITTABLE_STATUSES.has(submission.status)) {
      return Response.json(
        { success: false, error: 'This submission cannot be resubmitted in its current state' },
        { status: 409 },
      )
    }

    const body = await req.json().catch(() => null)
    const parsed = resubmitSubmissionRequestSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json(
        { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid request' },
        { status: 400 },
      )
    }

    if (!isAllowedContentUrl(parsed.data.contentUrl)) {
      return Response.json(
        { success: false, error: 'Content must be uploaded through the app' },
        { status: 400 },
      )
    }

    const updated = await prisma.submission.update({
      where: { id },
      data: {
        contentUrl: parsed.data.contentUrl,
        caption: parsed.data.caption || null,
        notes: parsed.data.notes || null,
        status: 'PENDING',
        reviewNote: null,
      },
      include: { application: { select: applicationSummarySelect } },
    })

    return Response.json({ success: true, data: toSubmissionResponse(updated) })
  },
)
