import prisma from '@/lib/prisma'
import { withMobileApi } from '@/lib/mobile-api-guard'
import { createSubmissionRequestSchema, listSubmissionsQuerySchema, submissionSchema } from '@creatordocks/shared'

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

export const POST = withMobileApi(
  { rateLimit: { limit: 20, windowMs: 60_000 }, role: 'CREATOR' },
  async ({ req, user }) => {
    const body = await req.json().catch(() => null)
    const parsed = createSubmissionRequestSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json(
        { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid request' },
        { status: 400 },
      )
    }

    const application = await prisma.application.findUnique({ where: { id: parsed.data.applicationId } })
    if (!application || application.creatorId !== user.id) {
      return Response.json({ success: false, error: 'Application not found' }, { status: 404 })
    }
    if (application.status !== 'ACCEPTED') {
      return Response.json(
        { success: false, error: 'Application must be accepted before submitting content' },
        { status: 400 },
      )
    }

    const submission = await prisma.submission.create({
      data: {
        applicationId: parsed.data.applicationId,
        creatorId: user.id,
        contentUrl: parsed.data.contentUrl,
        caption: parsed.data.caption || null,
        notes: parsed.data.notes || null,
      },
      include: { application: { select: applicationSummarySelect } },
    })

    return Response.json({ success: true, data: toSubmissionResponse(submission) }, { status: 201 })
  },
)

export const GET = withMobileApi(
  { rateLimit: { limit: 60, windowMs: 60_000 }, role: 'CREATOR' },
  async ({ req, user }) => {
    const { searchParams } = new URL(req.url)
    const parsed = listSubmissionsQuerySchema.safeParse(Object.fromEntries(searchParams))
    if (!parsed.success) {
      return Response.json(
        { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid query' },
        { status: 400 },
      )
    }

    const { page, limit } = parsed.data
    const where = { creatorId: user.id }

    const [submissions, total] = await Promise.all([
      prisma.submission.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { application: { select: applicationSummarySelect } },
      }),
      prisma.submission.count({ where }),
    ])

    return Response.json({
      success: true,
      data: submissions.map(toSubmissionResponse),
      meta: { total, page, limit },
    })
  },
)
