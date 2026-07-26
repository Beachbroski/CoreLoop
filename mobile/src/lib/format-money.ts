/** Matches lib/utils.ts#formatCents on web — same currency formatting on both surfaces. */
export function formatCents(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

/**
 * Mobile-only display variant for large/casual amounts (card budgets, hero totals):
 * drops ".00" on whole dollars. Precise contexts (payout line items) should keep
 * `formatCents` so exact amounts stay unambiguous.
 */
export function formatCentsCompact(cents: number): string {
  const dollars = cents / 100;
  if (!Number.isInteger(dollars)) return formatCents(cents);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
  }).format(dollars);
}
