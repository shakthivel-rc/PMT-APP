
import { User } from '../types/index';
import { api } from './client';

export interface UserStats {
  totalUsers: number;
  activeNow: number;
  newThisWeek: number;
  rolesDistribution: Record<string, number>;
}

export async function fetchUsersApi(): Promise<User[]> {
  const res = await api.get<{ records: any[]; total: number }>('/users?page=1&limit=0');
  return res.data.records.map(mapBackendUser);
}

export async function fetchUserStatsApi(): Promise<UserStats> {
  const users = await fetchUsersApi();

  const rolesDistribution: Record<string, number> = {};
  users.forEach(user => {
    const roleName = user.roles[0]?.role_name || 'No Role';
    rolesDistribution[roleName] = (rolesDistribution[roleName] || 0) + 1;
  });

  return {
    totalUsers: users.length,
    activeNow: users.filter(u => u.status).length,
    newThisWeek: 0,
    rolesDistribution,
  };
}

export async function createUserApi(user: {
  email: string;
  first_name: string;
  last_name: string;
  organization: string;
  department: string;
  username: string;
  role_id: string;
}): Promise<User> {
  await api.post<any>('/users', user);
  // Re-fetch all users to get the created user with roles
  const users = await fetchUsersApi();
  const created = users.find(u => u.email === user.email);
  return created || users[users.length - 1];
}

export async function updateUserApi(userId: string, data: {
  first_name: string;
  last_name: string;
  email: string;
  organization: string;
  department: string;
  role_id?: string;
}): Promise<User> {
  await api.put(`/users/${userId}`, data);
  const res = await api.get<any>(`/users/${userId}`);
  return mapBackendUser(res.data);
}

export async function deleteUserApi(userId: string): Promise<string> {
  await api.delete(`/users/${userId}`);
  return userId;
}

// Map backend user response to frontend User type
function mapBackendUser(backendUser: any): User {
  return {
    id: backendUser.id,
    first_name: backendUser.first_name || '',
    last_name: backendUser.last_name || '',
    username: backendUser.username || '',
    email: backendUser.email || '',
    organization: backendUser.organization || '',
    department: backendUser.department || '',
    status: backendUser.status ?? true,
    roles: backendUser.roles?.map((r: any) => ({
      role_id: r.role_id || r.id,
      role_name: r.role_name || r.name,
    })) || [],
    permissions: backendUser.permissions?.map((p: any) => ({
      permission_name: p.permission_name || p.name,
      machine_name: p.machine_name || p.code,
    })) || [],
  };
}
