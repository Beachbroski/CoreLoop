import type { Role } from '@creatordocks/shared';

const ROLE_LABELS: Record<Role, string> = {
  CREATOR: 'Creator',
  BRAND: 'Brand',
  ADMIN: 'Admin',
};

export function formatRoleLabel(role: Role): string {
  return ROLE_LABELS[role];
}
