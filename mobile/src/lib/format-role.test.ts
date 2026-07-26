import { formatRoleLabel } from './format-role';

describe('formatRoleLabel', () => {
  it('labels CREATOR as Creator', () => {
    expect(formatRoleLabel('CREATOR')).toBe('Creator');
  });

  it('labels BRAND as Brand', () => {
    expect(formatRoleLabel('BRAND')).toBe('Brand');
  });

  it('labels ADMIN as Admin', () => {
    expect(formatRoleLabel('ADMIN')).toBe('Admin');
  });
});
