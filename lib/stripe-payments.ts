import type { Application } from '@prisma/client'
import { stripe } from './stripe'
import { calculatePlatformFee } from './utils'

export async function retrievePaymentIntent(paymentIntentId: string) {
  return stripe.paymentIntents.retrieve(paymentIntentId)
}

export async function validatePaymentIntentForApplication(args: {
  application: Pick<Application, 'id' | 'paymentIntentId' | 'proposedRate'>
  destinationAccountId: string
  requireAuthorized?: boolean
}) {
  const { application, destinationAccountId, requireAuthorized = false } = args

  if (!application.paymentIntentId) {
    throw new Error('No payment intent is attached to this application')
  }

  const paymentIntent = await retrievePaymentIntent(application.paymentIntentId)
  const expectedPlatformFee = calculatePlatformFee(application.proposedRate)

  if (paymentIntent.metadata.applicationId !== application.id) {
    throw new Error('Payment intent metadata does not match the application')
  }

  if (paymentIntent.amount !== application.proposedRate || paymentIntent.currency !== 'usd') {
    throw new Error('Payment intent amount does not match the application rate')
  }

  if (paymentIntent.capture_method !== 'manual') {
    throw new Error('Payment intent is not configured for manual capture')
  }

  if (paymentIntent.application_fee_amount !== expectedPlatformFee) {
    throw new Error('Payment intent platform fee does not match the expected fee')
  }

  if (paymentIntent.transfer_data?.destination !== destinationAccountId) {
    throw new Error('Payment intent destination does not match the creator account')
  }

  if (requireAuthorized && paymentIntent.status !== 'requires_capture') {
    throw new Error('Payment has not been authorized yet')
  }

  return paymentIntent
}

export async function cancelPaymentIntentIfCancelable(paymentIntentId: string) {
  const paymentIntent = await retrievePaymentIntent(paymentIntentId)
  const cancelableStatuses = new Set([
    'requires_payment_method',
    'requires_confirmation',
    'requires_action',
    'requires_capture',
    'processing',
  ])

  if (cancelableStatuses.has(paymentIntent.status)) {
    await stripe.paymentIntents.cancel(paymentIntentId)
    return true
  }

  return false
}
