import { formatCents, formatCentsCompact } from './format-money';

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

describe('formatCentsCompact', () => {
  it('drops trailing .00 on whole dollar amounts', () => {
    expect(formatCentsCompact(500000)).toBe('$5,000');
  });

  it('drops trailing .00 on zero', () => {
    expect(formatCentsCompact(0)).toBe('$0');
  });

  it('keeps cents when the amount is not a whole dollar', () => {
    expect(formatCentsCompact(4550)).toBe('$45.50');
  });
});
