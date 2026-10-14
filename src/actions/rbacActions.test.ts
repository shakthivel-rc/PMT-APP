import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/api/rbac', () => ({
  createPermissionApi: vi.fn(),
  updateRolePermissionsApi: vi.fn(),
  fetchRolesApi: vi.fn(),
  fetchPermissionsApi: vi.fn(),
}));

import {
  createPermissionApi,
  fetchPermissionsApi,
  fetchRolesApi,
  updateRolePermissionsApi,
} from '@/api/rbac';
import {
  createPermissionAction,
  revalidateRbacData,
  updateRolePermissionsAction,
} from '@/actions/rbacActions';
import { makeRole } from '@/test/fixtures';

beforeEach(() => vi.clearAllMocks());

describe('createPermissionAction', () => {
  it('wraps a created permission in a success envelope', async () => {
    vi.mocked(createPermissionApi).mockResolvedValue({ id: 'p1', permission_name: 'Perm', machine_name: 'perm' });
    const res = await createPermissionAction({ name: 'Perm' });
    expect(res).toEqual({ success: true, data: { id: 'p1', permission_name: 'Perm', machine_name: 'perm' } });
  });

  it('returns a failure envelope on error', async () => {
    vi.mocked(createPermissionApi).mockRejectedValue(new Error('exists'));
    expect(await createPermissionAction({ name: 'Perm' })).toEqual({ success: false, error: 'exists' });
  });
});

describe('updateRolePermissionsAction', () => {
  it('forwards role id + permission ids and wraps the result', async () => {
    vi.mocked(updateRolePermissionsApi).mockResolvedValue(makeRole({ id: 'r1' }));
    const res = await updateRolePermissionsAction('r1', ['p1', 'p2']);
    expect(updateRolePermissionsApi).toHaveBeenCalledWith('r1', ['p1', 'p2']);
    expect(res.success).toBe(true);
  });
});

describe('revalidateRbacData', () => {
  it('loads roles and permissions in parallel', async () => {
    vi.mocked(fetchRolesApi).mockResolvedValue([makeRole()]);
    vi.mocked(fetchPermissionsApi).mockResolvedValue([{ id: 'p1', permission_name: 'Perm', machine_name: 'perm' }]);
    const { roles, permissions } = await revalidateRbacData();
    expect(roles).toHaveLength(1);
    expect(permissions).toHaveLength(1);
  });
});
