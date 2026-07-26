/** Matches lib/utils.ts#formatCents on web — same currency formatting on both surfaces. */
export function formatCents(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}
