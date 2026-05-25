export function formatCents(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100)
}

export function PLATFORM_FEE_RATE() {
  return 0.15
}

export function calculatePlatformFee(amountCents: number): number {
  return Math.round(amountCents * PLATFORM_FEE_RATE())
}
