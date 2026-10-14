import { describe, it, expect } from 'vitest';
import { canManageWorkspace, canWriteIssues, getDisplayName, getUserRoleName, hasPermission } from '@/types';
import { makeUser } from '@/test/fixtures';

describe('getDisplayName', () => {
  it('joins first + last name', () => {
    expect(getDisplayName(makeUser({ first_name: 'Ada', last_name: 'Lovelace' }))).toBe('Ada Lovelace');
  });

  it('trims when a name part is empty', () => {
    expect(getDisplayName(makeUser({ first_name: 'Ada', last_name: '' }))).toBe('Ada');
    expect(getDisplayName(makeUser({ first_name: '', last_name: '' }))).toBe('');
  });
});

describe('hasPermission', () => {
  const user = makeUser({
    permissions: [
      { permission_name: 'Manage Users', machine_name: 'manage_users' },
      { permission_name: 'Audit Read', machine_name: 'audit:read' },
    ],
  });

  it('returns false for a null user', () => {
    expect(hasPermission(null, ['manage_users'])).toBe(false);
  });

  it('requires every requested machine_name to be present', () => {
    expect(hasPermission(user, ['manage_users'])).toBe(true);
    expect(hasPermission(user, ['manage_users', 'audit:read'])).toBe(true);
    expect(hasPermission(user, ['manage_users', 'roles:delete'])).toBe(false);
  });

  it('is vacuously true for an empty requirement list', () => {
    expect(hasPermission(user, [])).toBe(true);
  });
});

describe('getUserRoleName', () => {
  it('returns the first role name', () => {
    expect(getUserRoleName(makeUser({ roles: [{ role_id: 'r1', role_name: 'Admin' }] }))).toBe('Admin');
  });

  it('returns "No Role" when the user has no roles', () => {
    expect(getUserRoleName(makeUser({ roles: [] }))).toBe('No Role');
  });
});

describe('workspace role gates', () => {
  // The API enforces both; these only decide which controls a role is offered, so that
  // nobody is handed a form whose one possible answer is 403.
  it('lets admins and owners manage the hierarchy, and nobody else', () => {
    expect((['guest', 'member', 'admin', 'owner'] as const).map(canManageWorkspace)).toEqual([false, false, true, true]);
  });

  it('lets everyone but a guest write issues', () => {
    expect((['guest', 'member', 'admin', 'owner'] as const).map(canWriteIssues)).toEqual([false, true, true, true]);
  });
});
