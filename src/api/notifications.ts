import { api } from './client';

export interface NotificationItem {
  id: string;
  user_id: string;
  actor_id: string | null;
  actor_name: string | null;
  workspace_id: string | null;
  issue_id: string | null;
  type: string;
  title: string;
  message: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
  read_at: string | null;
}

export interface NotificationListResponse {
  items: NotificationItem[];
  total: number;
  unread_count: number;
  page: number;
  limit: number;
}

export async function fetchNotificationsApi(options: {
  unread_only?: boolean;
  page?: number;
  limit?: number;
} = {}): Promise<NotificationListResponse> {
  const params = new URLSearchParams();
  if (options.unread_only) params.set('unread_only', 'true');
  if (options.page) params.set('page', String(options.page));
  if (options.limit) params.set('limit', String(options.limit));

  const qs = params.toString() ? `?${params.toString()}` : '';
  const res = await api.get<NotificationListResponse>(`/notifications${qs}`);
  return res.data;
}

export async function markNotificationReadApi(id: string): Promise<{ id: string; is_read: boolean }> {
  const res = await api.patch<{ id: string; is_read: boolean }>(`/notifications/${id}/read`, {});
  return res.data;
}

export async function markAllNotificationsReadApi(): Promise<{ marked_count: number }> {
  const res = await api.post<{ marked_count: number }>('/notifications/mark-all-read', {});
  return res.data;
}
