import { canManageWorkspace, type WorkspaceRole } from '@/types';

/*
 * Who may change a workspace and its membership: the rules pmt-api enforces on `PATCH` and
 * `DELETE /workspaces/{id}` and on `…/members/{user_id}`, mirrored so that a screen offers only
 * what the API would accept. Renaming is `canManageWorkspace`. The API still decides; these
 * rules exist so that nobody is handed a control whose only possible answer is 403.
 *
 * Two refusals depend on the whole membership, so they are left to the API, whose 409 says
 * what to change first: the last owner can be neither demoted nor removed (leaving included),
 * and a member who still owns something, such as a space, cannot be removed until it is
 * handed over.
 *
 * Kept out of `types/index.ts` on purpose. That module is part of the initial bundle, and
 * these rules are needed only by the project screens, which load as their own chunk.
 */

/** Deleting a workspace is for owners only; an admin is refused. */
export const canDeleteWorkspace = (role: WorkspaceRole): boolean => role === 'owner';

/** The roles `caller` may give someone, lowest first. Only an owner makes an owner. */
export const assignableRoles = (caller: WorkspaceRole): WorkspaceRole[] => {
  if (caller === 'owner') return ['guest', 'member', 'admin', 'owner'];
  return canManageWorkspace(caller) ? ['guest', 'member', 'admin'] : [];
};

/**
 * May `caller` change the role of a member who is `target`, or remove them? Admins and owners
 * manage members, and only an owner may change or remove an owner. Leaving, which is removing
 * yourself, needs no role and is not asked here.
 */
export const canManageMember = (caller: WorkspaceRole, target: WorkspaceRole): boolean =>
  canManageWorkspace(caller) && (target !== 'owner' || caller === 'owner');
