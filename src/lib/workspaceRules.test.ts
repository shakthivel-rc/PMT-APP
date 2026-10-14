import { describe, expect, it } from 'vitest';
import { assignableRoles, canDeleteWorkspace, canManageMember } from './workspaceRules';

const ROLES = ['guest', 'member', 'admin', 'owner'] as const;

// The API enforces every one of these; they only decide which controls a role is offered.
describe('workspace role rules', () => {
  it('lets only an owner delete a workspace', () => {
    expect(ROLES.map(canDeleteWorkspace)).toEqual([false, false, false, true]);
  });

  it('offers owner only to an owner, and no roles at all to members and guests', () => {
    expect(assignableRoles('owner')).toEqual(['guest', 'member', 'admin', 'owner']);
    expect(assignableRoles('admin')).toEqual(['guest', 'member', 'admin']);
    expect(assignableRoles('member')).toEqual([]);
    expect(assignableRoles('guest')).toEqual([]);
  });

  it('lets an admin manage everyone but an owner, and an owner manage everyone', () => {
    const matrix = ROLES.map((caller) => ROLES.map((target) => canManageMember(caller, target)));
    expect(matrix).toEqual([
      // target: guest, member, admin, owner
      [false, false, false, false], // guest
      [false, false, false, false], // member
      [true, true, true, false], // admin
      [true, true, true, true], // owner
    ]);
  });
});
