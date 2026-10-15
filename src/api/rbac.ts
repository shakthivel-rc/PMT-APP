
import { Permission, RoleDefinition } from '../types/index';
import { api } from './client';

export async function fetchPermissionsApi(): Promise<Permission[]> {
  const res = await api.get<{ records: any[]; total: number }>('/permissions?page=1&limit=0');
  return res.data.records.map((p: any) => ({
    id: p.permission_id || p.id,
    permission_name: p.permission_name || p.name,
    machine_name: p.machine_name || '',
  }));
}

export async function fetchRolesApi(): Promise<RoleDefinition[]> {
  const res = await api.get<{ records: any[]; total: number }>('/roles?page=1&limit=0');

  // `Promise.all` over a map, not `await` inside a `for…of`. The loop meant request k+1
  // did not start until k had fully returned, so latency was (1+N) round trips in series --
  // each one through nginx to FastAPI, where the auth middleware's session check and the
  // handler's own `get_db` session each take a DB connection before any work is done.
  //
  // N is small on a seeded install, so this was never an emergency. It matters because it
  // also runs on every "Add member" modal open, where the role dropdown stays empty for the
  // whole waterfall -- and that window is exactly when a mistimed reset could eat typed
  // input. Same requests, same per-role error handling, same output order.
  return Promise.all(
    res.data.records.map(async (role): Promise<RoleDefinition> => {
      try {
        const roleDetail = await api.get<any>(`/roles/${role.id}`);
        return {
          id: roleDetail.data.id,
          name: roleDetail.data.name,
          permissions: roleDetail.data.permissions?.map((p: any) => ({
            id: p.id || p.permission_id,
            permission_name: p.permission_name || p.name,
          })) || [],
        };
      } catch {
        // One role's detail failing must not lose the other roles -- the list is still
        // usable without that role's permissions, and this is what kept it that way.
        return { id: role.id, name: role.name, permissions: [] };
      }
    }),
  );
}

export async function createPermissionApi(permission: { name: string; machine_name?: string }): Promise<Permission> {
  const payload: Record<string, any> = {
    permission_name: permission.name,
  };
  if (permission.machine_name && permission.machine_name.trim()) {
    payload.machine_name = permission.machine_name.trim();
  }
  const res = await api.post<any>('/permissions', payload);
  return {
    id: res.data.permission_id || res.data.id,
    permission_name: res.data.permission_name || permission.name,
    machine_name: res.data.machine_name || '',
  };
}

export async function updateRolePermissionsApi(
  roleId: string,
  permissionIds: string[],
  roleName?: string
): Promise<RoleDefinition> {
  // We need to get the current role name if not provided
  let name = roleName;
  if (!name) {
    const roleRes = await api.get<any>(`/roles/${roleId}`);
    name = roleRes.data.name;
  }

  await api.put(`/roles/${roleId}`, {
    name,
    permission_ids: permissionIds,
  });

  // Re-fetch the role to get updated data
  const roleDetail = await api.get<any>(`/roles/${roleId}`);
  return {
    id: roleDetail.data.id,
    name: roleDetail.data.name,
    permissions: roleDetail.data.permissions?.map((p: any) => ({
      id: p.id || p.permission_id,
      permission_name: p.permission_name || p.name,
    })) || [],
  };
}
