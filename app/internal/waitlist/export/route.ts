import prisma from '@/lib/prisma'
import { getCurrentAppUser } from '@/lib/current-app-user'
import { isAllowedAdminUser } from '@/lib/admin-config'

function escapeCsv(value: string | number | null | undefined) {
  const rawValue = value == null ? '' : String(value)
  const stringValue = /^[=+\-@]/.test(rawValue) ? `'${rawValue}` : rawValue
  if (!/[,"\n]/.test(stringValue)) return stringValue
  return `"${stringValue.replace(/"/g, '""')}"`
}

export async function GET() {
  const { userId, user } = await getCurrentAppUser()
  if (!userId) {
    return new Response('Unauthorized', { status: 401 })
  }

  if (!isAllowedAdminUser(user)) {
    // 404 instead of 403 so the export path stays concealed from non-admins.
    return new Response('Not found', { status: 404 })
  }

  const submissions = await prisma.waitlistSubmission.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      referredBy: {
        select: { name: true, referralCode: true },
      },
      _count: {
        select: { referrals: true },
      },
    },
  })

  const csvHeaders = [
    'name',
    'email',
    'primaryPlatform',
    'handle',
    'niche',
    'followerRange',
    'referralCode',
    'referredByName',
    'referredByCode',
    'referralCount',
    'status',
    'profileCompletedAt',
    'createdAt',
  ]

  const rows = submissions.map(submission => ([
    submission.name,
    submission.email,
    submission.primaryPlatform,
    submission.handle,
    submission.niche,
    submission.followerRange,
    submission.referralCode,
    submission.referredBy?.name ?? '',
    submission.referredBy?.referralCode ?? '',
    submission._count.referrals,
    submission.status,
    submission.profileCompletedAt?.toISOString() ?? '',
    submission.createdAt.toISOString(),
  ].map(escapeCsv).join(',')))

  const csv = [csvHeaders.join(','), ...rows].join('\n')

  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="creatordocks-waitlist.csv"',
    },
  })
}
