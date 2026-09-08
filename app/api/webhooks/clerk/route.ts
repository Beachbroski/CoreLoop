import { Webhook } from 'svix'
import { headers } from 'next/headers'
import { WebhookEvent } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'
import { anonymizeAccountByClerkId } from '@/app/api/_lib/account-deletion'

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET
  if (!WEBHOOK_SECRET) throw new Error('Missing CLERK_WEBHOOK_SECRET')

  const headersList = await headers()
  const svix_id = headersList.get('svix-id')
  const svix_timestamp = headersList.get('svix-timestamp')
  const svix_signature = headersList.get('svix-signature')

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response('Missing svix headers', { status: 400 })
  }

  const payload = await req.json()
  const body = JSON.stringify(payload)

  const wh = new Webhook(WEBHOOK_SECRET)
  let evt: WebhookEvent

  try {
    evt = wh.verify(body, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    }) as WebhookEvent
  } catch {
    return new Response('Invalid signature', { status: 400 })
  }

  if (evt.type === 'user.created') {
    const { id, email_addresses, first_name, last_name, image_url } = evt.data
    try {
      const primaryEmail = email_addresses[0]?.email_address
      if (!primaryEmail) {
        return new Response('Missing email address', { status: 400 })
      }

      const existingUser = await prisma.user.findFirst({
        where: {
          OR: [{ clerkId: id }, { email: primaryEmail }],
        },
      })

      if (existingUser) {
        await prisma.user.update({
          where: { id: existingUser.id },
          data: {
            clerkId: id,
            email: primaryEmail,
            name: `${first_name ?? ''} ${last_name ?? ''}`.trim() || null,
            avatarUrl: image_url,
          },
        })
      }
      // New users are created lazily in /api/users/role once they complete onboarding.
      // Creating here would assign the schema default role (CREATOR) before the user
      // has chosen, causing the onboarding page to skip role selection entirely.
    } catch (err) {
      console.error('[clerk webhook] user.created failed', err)
      return new Response('Database error', { status: 500 })
    }
  }

  // Deletion started on Clerk's side (dashboard, or Clerk's own account-deletion
  // UI), and the safety net for `DELETE /api/v1/me` dying between removing the
  // Clerk identity and scrubbing the row. Same anonymization either way, and it
  // is idempotent, so a redelivery is harmless.
  if (evt.type === 'user.deleted') {
    const clerkId = evt.data.id
    // Clerk can send a deletion event with no id (a partially-formed object).
    // There is nothing to match on, and returning non-2xx would make Clerk
    // redeliver an event that can never succeed, so acknowledge and move on.
    if (!clerkId) {
      console.warn('[clerk webhook] user.deleted arrived with no id; nothing to anonymize')
      return Response.json({ received: true })
    }

    try {
      const outcome = await anonymizeAccountByClerkId(clerkId)
      if (outcome === 'not-found') {
        // Already anonymized by the API route, or the identity never had a row.
        console.warn('[clerk webhook] user.deleted matched no user row', { clerkId })
      }
    } catch (err) {
      // 500 so Clerk retries: an identified row whose login is gone must not be
      // left behind because one delivery happened to hit a database blip.
      console.error('[clerk webhook] user.deleted anonymization failed', { clerkId, err })
      return new Response('Database error', { status: 500 })
    }
  }

  return Response.json({ received: true })
}
