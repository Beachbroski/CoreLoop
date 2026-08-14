import { formatDate, formatDeadline } from './format-date';

describe('formatDate', () => {
  it('formats an ISO timestamp as a short date', () => {
    expect(formatDate('2026-03-04T12:00:00.000Z')).toBe('Mar 4, 2026');
  });

  it('formats a date-only ISO string', () => {
    expect(formatDate('2026-12-25')).toBe('Dec 25, 2026');
  });
});

describe('formatDeadline', () => {
  it('formats a deadline without the year', () => {
    expect(formatDeadline('2026-03-04T12:00:00.000Z')).toBe('Due Mar 4');
  });
});
