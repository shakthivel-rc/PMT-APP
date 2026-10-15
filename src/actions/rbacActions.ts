
import { createPermissionApi, updateRolePermissionsApi, fetchRolesApi, fetchPermissionsApi } from '../api/rbac';
import { Permission, RoleDefinition, type ActionResponse } from '../types/index';

export async function createPermissionAction(data: { name: string; machine_name?: string }): Promise<ActionResponse<Permission>> {
    try {
        const result = await createPermissionApi(data);
        return { success: true, data: result };
    } catch (error: any) {
        return { success: false, error: error.message || 'Failed to create permission' };
    }
}

export async function updateRolePermissionsAction(roleId: string, permissionIds: string[]): Promise<ActionResponse<RoleDefinition>> {
    try {
        const result = await updateRolePermissionsApi(roleId, permissionIds);
        return { success: true, data: result };
    } catch (error: any) {
        return { success: false, error: error.message || 'Failed to update role' };
    }
}

export async function revalidateRbacData() {
    const [roles, permissions] = await Promise.all([fetchRolesApi(), fetchPermissionsApi()]);
    return { roles, permissions };
}
