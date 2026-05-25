import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import { releasePayout } from '@/lib/payout'

const schema = z.object({
  submissionId: z.string().min(1),
  paymentIntentId: z.string().min(1),
})

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    await releasePayout(parsed.data.submissionId, parsed.data.paymentIntentId)

    return Response.json({ success: true })
  } catch (err) {
    console.error('[POST /api/stripe/release-payout]', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
