import { Resend } from 'resend'
import { getSiteUrl } from './site-url'
import { formatCents } from './utils'

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
const FROM_ADDRESS = process.env.EMAIL_FROM_ADDRESS ?? 'CreatorDocks <notifications@creatordocks.com>'

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function absoluteUrl(path: string) {
  const siteUrl = getSiteUrl()
  if (!siteUrl) return path
  try {
    return new URL(path, siteUrl).toString()
  } catch {
    return path
  }
}

function emailShell(heading: string, bodyHtml: string, ctaHref?: string, ctaLabel?: string) {
  return `
    <div style="font-family: -apple-system, Helvetica, Arial, sans-serif; background: #f4f6fb; padding: 32px 16px;">
      <div style="max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 20px; padding: 32px; border: 1px solid #e6e9f0;">
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 24px;">
          <div style="width: 28px; height: 28px; border-radius: 9px; background: #ff503d; color: white; font-weight: 900; font-size: 18px; text-align: center; line-height: 28px;">D</div>
          <span style="font-weight: 700; font-size: 16px; color: #0f1728;">CreatorDocks</span>
        </div>
        <h1 style="font-size: 22px; letter-spacing: -0.02em; margin: 0 0 12px; color: #0f1728;">${heading}</h1>
        <div style="font-size: 15px; line-height: 1.6; color: #465066;">${bodyHtml}</div>
        ${ctaHref && ctaLabel ? `
          <div style="margin-top: 24px;">
            <a href="${ctaHref}" style="display: inline-block; background: #1371ff; color: white; text-decoration: none; font-weight: 600; padding: 12px 20px; border-radius: 999px; font-size: 14px;">${ctaLabel}</a>
          </div>
        ` : ''}
      </div>
    </div>
  `
}

async function sendEmail(to: string, subject: string, html: string) {
  if (!resend) {
    console.warn(`[email] RESEND_API_KEY not set — skipping "${subject}" to ${to}`)
    return
  }

  try {
    await resend.emails.send({ from: FROM_ADDRESS, to, subject, html })
  } catch (err) {
    console.error('[email] send failed', err)
  }
}

export async function sendApplicationAcceptedEmail(to: string, params: { campaignTitle: string }) {
  const campaignTitle = escapeHtml(params.campaignTitle)
  await sendEmail(
    to,
    `You're in: "${params.campaignTitle}"`,
    emailShell(
      'Your application was accepted.',
      `<p>Good news — the brand behind <strong>${campaignTitle}</strong> accepted your application. Head over to your applications to see next steps and submit your content.</p>`,
      absoluteUrl('/creator/applications'),
      'View application',
    ),
  )
}

export async function sendApplicationRejectedEmail(to: string, params: { campaignTitle: string }) {
  const campaignTitle = escapeHtml(params.campaignTitle)
  await sendEmail(
    to,
    `Update on "${params.campaignTitle}"`,
    emailShell(
      'This application wasn\'t accepted.',
      `<p>The brand behind <strong>${campaignTitle}</strong> passed on your application this time. Keep browsing — new campaigns open regularly.</p>`,
      absoluteUrl('/creator/campaigns'),
      'Browse campaigns',
    ),
  )
}

export async function sendSubmissionApprovedEmail(to: string, params: { campaignTitle: string }) {
  const campaignTitle = escapeHtml(params.campaignTitle)
  await sendEmail(
    to,
    `Approved: "${params.campaignTitle}"`,
    emailShell(
      'Your content was approved.',
      `<p>Your submission for <strong>${campaignTitle}</strong> was approved. Payout is on its way to your connected Stripe account.</p>`,
      absoluteUrl('/creator/applications'),
      'View details',
    ),
  )
}

export async function sendPayoutPaidEmail(to: string, params: { campaignTitle: string; amountCents: number }) {
  const campaignTitle = escapeHtml(params.campaignTitle)
  await sendEmail(
    to,
    `You've been paid for "${params.campaignTitle}"`,
    emailShell(
      `${formatCents(params.amountCents)} is on its way.`,
      `<p>Your payout for <strong>${campaignTitle}</strong> has been sent to your connected Stripe account.</p>`,
      absoluteUrl('/creator/settings'),
      'View payouts',
    ),
  )
}

export async function sendWaitlistConfirmationEmail(to: string, params: { name?: string | null; referralLink: string }) {
  const name = params.name ? escapeHtml(params.name) : null
  const referralLink = escapeHtml(params.referralLink)
  await sendEmail(
    to,
    'You\'re on the CreatorDocks waitlist',
    emailShell(
      `${name ? `Thanks, ${name}.` : 'You\'re in.'} Your spot is saved.`,
      `<p>We'll use your creator details to match you with local brand deals that fit. Want to speed things up? Share your referral link with other creators:</p>
       <p style="word-break: break-all; background: #f4f6fb; padding: 10px 14px; border-radius: 10px; font-size: 13px;">${referralLink}</p>`,
    ),
  )
}

export async function sendReferralMilestoneEmail(to: string, params: { name?: string | null }) {
  const name = params.name ? escapeHtml(params.name) : null
  await sendEmail(
    to,
    'You just referred 3 creators',
    emailShell(
      `${name ? `Nice work, ${name}.` : 'Nice work.'}`,
      '<p>You\'ve referred 3 creators to CreatorDocks — that helps us open more brand matches, faster. Thanks for spreading the word.</p>',
    ),
  )
}

export async function sendWaitlistInviteEmail(to: string, params: { name?: string | null }) {
  const name = params.name ? escapeHtml(params.name) : null
  await sendEmail(
    to,
    'You\'re invited to CreatorDocks',
    emailShell(
      `${name ? `${name}, you're` : 'You\'re'} invited off the waitlist.`,
      '<p>A spot just opened up. Create your account to start browsing local brand campaigns and applying to the ones that fit.</p>',
      absoluteUrl('/sign-up'),
      'Create your account',
    ),
  )
}
