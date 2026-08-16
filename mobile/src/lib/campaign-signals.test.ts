import { deadlineSignal, isNewCampaign, spotsLabel, tileAspectRatio } from './campaign-signals';

const NOW = new Date('2026-08-14T12:00:00.000Z').getTime();

function isoIn(hours: number) {
  return new Date(NOW + hours * 3600_000).toISOString();
}

describe('isNewCampaign', () => {
  it('flags a campaign posted within the last 3 days', () => {
    expect(isNewCampaign(isoIn(-2), NOW)).toBe(true);
    expect(isNewCampaign(isoIn(-70), NOW)).toBe(true);
  });

  it('does not flag older campaigns', () => {
    expect(isNewCampaign(isoIn(-24 * 5), NOW)).toBe(false);
  });

  it('handles a malformed date safely', () => {
    expect(isNewCampaign('not-a-date', NOW)).toBe(false);
  });
});

describe('deadlineSignal', () => {
  it('marks a deadline inside 24h as urgent, in hours', () => {
    const signal = deadlineSignal(isoIn(18), NOW);
    expect(signal.urgent).toBe(true);
    expect(signal.label).toBe('Ends in 18h');
  });

  it('says "Ends today" when under an hour remains', () => {
    expect(deadlineSignal(isoIn(0.4), NOW).label).toBe('Ends today');
  });

  it('counts days when further out, urgent within 3 days', () => {
    expect(deadlineSignal(isoIn(48), NOW)).toEqual({ label: '2d left', urgent: true, passed: false });
    expect(deadlineSignal(isoIn(24 * 9), NOW)).toEqual({ label: '9d left', urgent: false, passed: false });
  });

  it('reports a passed deadline', () => {
    const signal = deadlineSignal(isoIn(-5), NOW);
    expect(signal.passed).toBe(true);
    expect(signal.label).toBe('Closed');
  });

  it('handles a malformed date safely', () => {
    expect(deadlineSignal('nope', NOW)).toEqual({ label: '', urgent: false, passed: false });
  });
});

describe('tileAspectRatio', () => {
  it('is deterministic per campaign id', () => {
    expect(tileAspectRatio('camp_1')).toBe(tileAspectRatio('camp_1'));
  });

  it('produces a mix of ratios across ids (mosaic feel)', () => {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];
    const ratios = new Set(ids.map(tileAspectRatio));
    expect(ratios.size).toBeGreaterThan(1);
  });

  it('only returns supported ratios', () => {
    for (const id of ['a', 'b', 'c', 'd', 'e', 'f']) {
      expect([1, 4 / 5, 4 / 3]).toContain(tileAspectRatio(id));
    }
  });
});

describe('spotsLabel', () => {
  it('pluralizes spots', () => {
    expect(spotsLabel(1)).toBe('1 spot');
    expect(spotsLabel(4)).toBe('4 spots');
  });

  it('returns null when the campaign does not say', () => {
    expect(spotsLabel(null)).toBeNull();
    expect(spotsLabel(0)).toBeNull();
  });
});
