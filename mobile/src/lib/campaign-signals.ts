/**
 * Browsing signals derived from data the API actually returns. Deliberately
 * no invented social proof: the campaigns endpoint exposes no applicant
 * counts or trending flags, so the feed leans on real deadline urgency,
 * freshness, and open spots rather than fabricated numbers.
 */

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
const NEW_WINDOW_DAYS = 3;
const URGENT_WINDOW_DAYS = 3;

/** Supported tile shapes — the mix is what gives the grid its mosaic rhythm. */
const ASPECT_RATIOS = [1, 4 / 5, 4 / 3] as const;

function parseTime(iso: string): number | null {
  const time = new Date(iso).getTime();
  return Number.isNaN(time) ? null : time;
}

/** Posted within the last few days — worth a "New" badge. */
export function isNewCampaign(createdAt: string, now: number = Date.now()): boolean {
  const created = parseTime(createdAt);
  if (created === null) return false;
  return now - created <= NEW_WINDOW_DAYS * DAY_MS;
}

export type DeadlineSignal = {
  label: string;
  /** Closing soon — rendered in the accent color to create urgency. */
  urgent: boolean;
  passed: boolean;
};

export function deadlineSignal(deadline: string, now: number = Date.now()): DeadlineSignal {
  const end = parseTime(deadline);
  if (end === null) return { label: '', urgent: false, passed: false };

  const remaining = end - now;
  if (remaining <= 0) return { label: 'Closed', urgent: false, passed: true };

  if (remaining < DAY_MS) {
    const hours = Math.floor(remaining / HOUR_MS);
    return { label: hours < 1 ? 'Ends today' : `Ends in ${hours}h`, urgent: true, passed: false };
  }

  const days = Math.round(remaining / DAY_MS);
  return { label: `${days}d left`, urgent: days <= URGENT_WINDOW_DAYS, passed: false };
}

/**
 * Deterministic tile shape per campaign, so the mosaic looks varied but a
 * given campaign never changes shape between renders (which would make the
 * grid jump on refresh). Same hashing idea as lib/cover-art.
 */
export function tileAspectRatio(id: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return ASPECT_RATIOS[(hash >>> 0) % ASPECT_RATIOS.length];
}

/** "3 spots" — real openings from creatorsNeeded, or nothing when unknown. */
export function spotsLabel(creatorsNeeded: number | null): string | null {
  if (!creatorsNeeded || creatorsNeeded <= 0) return null;
  return `${creatorsNeeded} spot${creatorsNeeded === 1 ? '' : 's'}`;
}
