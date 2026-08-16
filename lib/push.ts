import { Expo, type ExpoPushMessage } from 'expo-server-sdk'
import prisma from './prisma'
import { formatCents } from './utils'

const expo = new Expo()

type PushPayload = {
  title: string
  body: string
  /** Carried to the app; `url` is used for tap-through deep linking. */
  data?: Record<string, unknown>
}

/**
 * Sends a push to every device registered to a user. Mirrors lib/email.ts:
 * best-effort, never throws into the caller, and a no-op when the user has no
 * devices. Prunes tokens the Expo push service reports as no longer
 * registered (delayed receipt-based pruning is a follow-up).
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  try {
    const devices = await prisma.device.findMany({
      where: { userId },
      select: { expoPushToken: true },
    })
    if (devices.length === 0) return

    const messages: ExpoPushMessage[] = []
    const invalidTokens: string[] = []

    for (const { expoPushToken } of devices) {
      if (!Expo.isExpoPushToken(expoPushToken)) {
        invalidTokens.push(expoPushToken)
        continue
      }
      messages.push({
        to: expoPushToken,
        title: payload.title,
        body: payload.body,
        data: payload.data ?? {},
        sound: 'default',
      })
    }

    for (const chunk of messages.length > 0 ? expo.chunkPushNotifications(messages) : []) {
      try {
        const tickets = await expo.sendPushNotificationsAsync(chunk)
        tickets.forEach((ticket, index) => {
          if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
            const to = chunk[index]?.to
            if (typeof to === 'string') invalidTokens.push(to)
          }
        })
      } catch (err) {
        console.error('[push] send chunk failed', err)
      }
    }

    if (invalidTokens.length > 0) {
      await prisma.device.deleteMany({ where: { expoPushToken: { in: invalidTokens } } })
    }
  } catch (err) {
    console.error('[push] sendPushToUser failed', err)
  }
}

// Per-event senders — mirror the lib/email.ts exports so route hooks are
// one-liners. `data.url` is a mobile route path the app opens on tap.

export function sendApplicationAcceptedPush(userId: string, params: { campaignTitle: string }) {
  return sendPushToUser(userId, {
    title: "You're in! 🎉",
    body: `${params.campaignTitle} accepted your application.`,
    data: { url: '/activity' },
  })
}

export function sendApplicationRejectedPush(userId: string, params: { campaignTitle: string }) {
  return sendPushToUser(userId, {
    title: 'Application update',
    body: `${params.campaignTitle} didn't move forward this time.`,
    data: { url: '/activity' },
  })
}

export function sendSubmissionApprovedPush(
  userId: string,
  params: { campaignTitle: string; submissionId: string },
) {
  return sendPushToUser(userId, {
    title: 'Content approved ✅',
    body: `${params.campaignTitle} approved your submission.`,
    data: { url: `/activity/submissions/${params.submissionId}` },
  })
}

export function sendSubmissionRevisionRequestedPush(
  userId: string,
  params: { campaignTitle: string; submissionId: string },
) {
  return sendPushToUser(userId, {
    title: 'Changes requested',
    body: `${params.campaignTitle} asked for revisions to your submission.`,
    data: { url: `/activity/submissions/${params.submissionId}` },
  })
}

export function sendSubmissionRejectedPush(
  userId: string,
  params: { campaignTitle: string; submissionId: string },
) {
  return sendPushToUser(userId, {
    title: 'Submission update',
    body: `${params.campaignTitle} declined your submission.`,
    data: { url: `/activity/submissions/${params.submissionId}` },
  })
}

/**
 * `netAmount` is the creator's take-home — the agreed rate minus the platform
 * fee the destination charge withholds. The gross rate would announce money
 * that never lands, and it has to match the figure in the payout email.
 */
export function sendPayoutPaidPush(userId: string, params: { netAmount: number }) {
  return sendPushToUser(userId, {
    title: 'You got paid 💸',
    body: `${formatCents(params.netAmount)} is on its way to your account.`,
    data: { url: '/earnings' },
  })
}

export function sendPayoutFailedPush(userId: string) {
  return sendPushToUser(userId, {
    title: 'Payout issue',
    body: "A payout couldn't be processed. Tap to review your earnings.",
    data: { url: '/earnings' },
  })
}
