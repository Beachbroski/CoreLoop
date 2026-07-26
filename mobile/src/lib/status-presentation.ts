// Covers every status string across ApplicationStatus, SubmissionStatus, and
// PayoutStatus — one semantic mapping so "pending" always reads the same
// color regardless of which resource it's describing.
export const STATUS_COLORS = {
  PENDING: 'warning',
  PROCESSING: 'warning',
  REVISION_REQUESTED: 'warning',
  ACCEPTED: 'success',
  APPROVED: 'success',
  PAID: 'success',
  REJECTED: 'danger',
  FAILED: 'danger',
} as const;

export const STATUS_SOFT_COLORS = {
  PENDING: 'warningSoft',
  PROCESSING: 'warningSoft',
  REVISION_REQUESTED: 'warningSoft',
  ACCEPTED: 'successSoft',
  APPROVED: 'successSoft',
  PAID: 'successSoft',
  REJECTED: 'dangerSoft',
  FAILED: 'dangerSoft',
} as const;

export function statusTextColor(status: string): 'success' | 'warning' | 'danger' | 'textSecondary' {
  return (STATUS_COLORS as Record<string, 'success' | 'warning' | 'danger'>)[status] ?? 'textSecondary';
}

export function statusSoftColor(status: string): 'successSoft' | 'warningSoft' | 'dangerSoft' | undefined {
  return (STATUS_SOFT_COLORS as Record<string, 'successSoft' | 'warningSoft' | 'dangerSoft'>)[status];
}

export function formatStatus(status: string): string {
  return status.replace('_', ' ');
}
