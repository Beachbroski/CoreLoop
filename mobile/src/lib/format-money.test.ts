import { formatCents } from './format-money';

describe('formatCents', () => {
  it('formats whole dollar amounts', () => {
    expect(formatCents(500000)).toBe('$5,000.00');
  });

  it('formats amounts with cents', () => {
    expect(formatCents(4550)).toBe('$45.50');
  });

  it('formats zero', () => {
    expect(formatCents(0)).toBe('$0.00');
  });
});
