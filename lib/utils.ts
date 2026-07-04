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

export type Trend = { direction: 'up' | 'down' | 'flat'; label: string }

export function compareToLastWeek(thisWeek: number, lastWeek: number): Trend {
  if (thisWeek === lastWeek) {
    return { direction: 'flat', label: 'Same as last week' }
  }

  if (lastWeek === 0) {
    return { direction: 'up', label: `+${thisWeek} vs last week` }
  }

  const change = Math.round(((thisWeek - lastWeek) / lastWeek) * 100)
  return {
    direction: change > 0 ? 'up' : 'down',
    label: `${change > 0 ? '+' : ''}${change}% vs last week`,
  }
}
