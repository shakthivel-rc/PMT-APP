
import { ActivityLog } from '../types/index';
import { api } from './client';

export async function fetchActivityLogsApi(userId?: string): Promise<ActivityLog[]> {
    const params = new URLSearchParams();
    if (userId) params.set('user_id', userId);
    params.set('limit', '0'); // get all

    const response = await api.get<{ records: any[] }>(`/activity-logs?${params}`);
    return response.data.records.map((record: any) => ({
        id: record.id,
        userId: record.userId,
        userName: record.userName,
        action: record.action,
        details: record.details,
        type: record.type as ActivityLog['type'],
        timestamp: record.timestamp,
        ipAddress: record.ipAddress,
    }));
}
