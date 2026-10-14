
import { createUserApi, updateUserApi, deleteUserApi } from '../api/users';
import { User, type ActionResponse } from '../types/index';

export async function saveUserAction(userData: {
    id?: string;
    first_name: string;
    last_name: string;
    username?: string;
    email: string;
    organization: string;
    department: string;
    role_id: string;
}): Promise<ActionResponse<User>> {
    try {
        let result: User;
        if (userData.id) {
            result = await updateUserApi(userData.id, {
                first_name: userData.first_name,
                last_name: userData.last_name,
                email: userData.email,
                organization: userData.organization,
                department: userData.department,
                role_id: userData.role_id,
            });
        } else {
            result = await createUserApi({
                email: userData.email,
                first_name: userData.first_name,
                last_name: userData.last_name,
                organization: userData.organization,
                department: userData.department,
                username: userData.username || userData.email,
                role_id: userData.role_id,
            });
        }
        return { success: true, data: result };
    } catch (error: any) {
        return { success: false, error: error.message || 'Failed to save user' };
    }
}

export async function deleteUserAction(userId: string): Promise<ActionResponse<string>> {
    try {
        await deleteUserApi(userId);
        return { success: true, data: userId };
    } catch (error: any) {
        return { success: false, error: error.message || 'Failed to delete user' };
    }
}

