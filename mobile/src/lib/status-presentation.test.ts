import { formatStatus, statusSoftColor, statusTextColor } from './status-presentation';

describe('statusTextColor', () => {
  it('maps in-progress statuses to warning', () => {
    expect(statusTextColor('PENDING')).toBe('warning');
    expect(statusTextColor('PROCESSING')).toBe('warning');
    expect(statusTextColor('REVISION_REQUESTED')).toBe('warning');
  });

  it('maps positive-outcome statuses to success', () => {
    expect(statusTextColor('ACCEPTED')).toBe('success');
    expect(statusTextColor('APPROVED')).toBe('success');
    expect(statusTextColor('PAID')).toBe('success');
  });

  it('maps negative-outcome statuses to danger', () => {
    expect(statusTextColor('REJECTED')).toBe('danger');
    expect(statusTextColor('FAILED')).toBe('danger');
  });

  it('falls back to textSecondary for an unknown status', () => {
    expect(statusTextColor('SOMETHING_NEW')).toBe('textSecondary');
  });
});

describe('statusSoftColor', () => {
  it('returns a soft background for known statuses', () => {
    expect(statusSoftColor('PAID')).toBe('successSoft');
    expect(statusSoftColor('REJECTED')).toBe('dangerSoft');
  });

  it('returns undefined for an unknown status', () => {
    expect(statusSoftColor('SOMETHING_NEW')).toBeUndefined();
  });
});

describe('formatStatus', () => {
  it('title-cases multi-word statuses', () => {
    expect(formatStatus('REVISION_REQUESTED')).toBe('Revision Requested');
  });

  it('title-cases single-word statuses', () => {
    expect(formatStatus('PAID')).toBe('Paid');
    expect(formatStatus('PENDING')).toBe('Pending');
  });

  it('handles statuses with more than one underscore', () => {
    expect(formatStatus('A_B_C')).toBe('A B C');
  });
});
