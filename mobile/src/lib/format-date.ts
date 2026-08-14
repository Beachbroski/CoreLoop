// UTC-pinned so a timestamp renders the same date regardless of the
// device's timezone (server dates are calendar dates, not local moments).
const DATE_FORMAT = new Intl.DateTimeFormat('en-US', {
  timeZone: 'UTC',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

const DEADLINE_FORMAT = new Intl.DateTimeFormat('en-US', {
  timeZone: 'UTC',
  month: 'short',
  day: 'numeric',
});

/** "2026-03-04T12:00:00.000Z" → "Mar 4, 2026" */
export function formatDate(iso: string): string {
  return DATE_FORMAT.format(new Date(iso));
}

/** "2026-03-04T12:00:00.000Z" → "Due Mar 4" */
export function formatDeadline(iso: string): string {
  return `Due ${DEADLINE_FORMAT.format(new Date(iso))}`;
}
