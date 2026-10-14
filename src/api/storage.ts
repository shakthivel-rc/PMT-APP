import { api } from './client';
import type {
  StorageSettings,
  StorageSettingsUpdate,
  StorageTestRequest,
  StorageTestResponse,
  IssueAttachment,
} from '@/types';

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64);
    };
    reader.onerror = error => reject(error);
    reader.readAsDataURL(file);
  });
}

export async function getStorageSettings(workspaceId: string): Promise<StorageSettings> {
  const res = await api.get<StorageSettings>(`/workspaces/${workspaceId}/settings/storage`);
  return res.data;
}

export async function updateStorageSettings(
  workspaceId: string,
  update: StorageSettingsUpdate
): Promise<StorageSettings> {
  const res = await api.patch<StorageSettings>(
    `/workspaces/${workspaceId}/settings/storage`,
    update
  );
  return res.data;
}

export async function testStorageConnection(
  workspaceId: string,
  req: StorageTestRequest
): Promise<StorageTestResponse> {
  const res = await api.post<StorageTestResponse>(
    `/workspaces/${workspaceId}/settings/storage/test`,
    req
  );
  return res.data;
}

export async function listIssueAttachments(
  workspaceId: string,
  issueId: string,
  commentId?: string
): Promise<IssueAttachment[]> {
  const params = commentId ? `?comment_id=${encodeURIComponent(commentId)}` : '';
  const res = await api.get<IssueAttachment[]>(
    `/workspaces/${workspaceId}/issues/${issueId}/attachments${params}`
  );
  return res.data;
}

export async function uploadIssueAttachment(
  workspaceId: string,
  issueId: string,
  file: File,
  commentId?: string
): Promise<IssueAttachment> {
  const b64 = await fileToBase64(file);
  const payload: Record<string, unknown> = {
    filename: file.name,
    content_type: file.type || 'application/octet-stream',
    content_base64: b64,
  };
  if (commentId) {
    payload.comment_id = commentId;
  }
  const params = commentId ? `?comment_id=${encodeURIComponent(commentId)}` : '';
  const res = await api.post<IssueAttachment>(
    `/workspaces/${workspaceId}/issues/${issueId}/attachments${params}`,
    payload
  );
  return res.data;
}

export async function deleteIssueAttachment(
  workspaceId: string,
  issueId: string,
  attachmentId: string
): Promise<{ deleted: boolean }> {
  const res = await api.delete<{ deleted: boolean }>(
    `/workspaces/${workspaceId}/issues/${issueId}/attachments/${attachmentId}`
  );
  return res.data;
}

export function normalizeAttachmentEndpoint(url: string): string {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) {
    try {
      const parsed = new URL(url);
      return parsed.pathname + parsed.search;
    } catch {
      return url;
    }
  }
  return url.startsWith('/api/') ? url.slice(4) : url;
}

export function getAttachmentDownloadUrl(downloadUrl: string, withToken = true): string {
  if (!downloadUrl) return '';
  let url = downloadUrl;
  if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('/api/')) {
    url = `/api${url.startsWith('/') ? '' : '/'}${url}`;
  }
  if (withToken) {
    const token = localStorage.getItem('access_token');
    if (token) {
      const sep = url.includes('?') ? '&' : '?';
      url = `${url}${sep}token=${encodeURIComponent(token)}`;
    }
  }
  return url;
}

export async function fetchAttachmentBlob(downloadUrl: string): Promise<Blob> {
  const endpoint = normalizeAttachmentEndpoint(downloadUrl);
  if (downloadUrl.startsWith('http://') || downloadUrl.startsWith('https://')) {
    const token = localStorage.getItem('access_token');
    const res = await fetch(downloadUrl, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (!res.ok) throw new Error(`Failed to load file (${res.status})`);
    return await res.blob();
  }
  const res = await api.get<{ kind: 'file'; blob: Blob }>(endpoint, { file: true });
  return (res.data as any).blob || (res.data as any);
}

export async function fetchAttachmentObjectUrl(downloadUrl: string): Promise<string> {
  const blob = await fetchAttachmentBlob(downloadUrl);
  return URL.createObjectURL(blob);
}

export function isPdfAttachment(att: { filename: string; content_type?: string }): boolean {
  return (
    att.content_type?.toLowerCase() === 'application/pdf' ||
    att.filename?.toLowerCase().endsWith('.pdf')
  );
}

export function isImageAttachment(att: {
  filename: string;
  content_type?: string;
  is_image?: boolean;
}): boolean {
  if (att.is_image) return true;
  if (att.content_type?.toLowerCase().startsWith('image/')) return true;
  return /\.(png|jpe?g|gif|webp|svg|bmp|ico)$/i.test(att.filename || '');
}

