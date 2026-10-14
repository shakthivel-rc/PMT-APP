import type {
  SavedViewCreate,
  SavedViewSummary,
  SavedViewUpdate,
  ViewScopeKind,
  ViewType,
} from '../types/savedViews';
import { api } from './client';
import { workspacePath } from './workspaces';

/*
 * Saved board filters (`routes/saved_views.py` in pmt-api; 09-restructuring.md §5.4). A view
 * is private to its owner or shared with the workspace; only its owner may change it, and an
 * admin may also delete a shared one.
 */

export interface SavedViewQuery {
  scope_kind?: ViewScopeKind;
  scope_id?: string;
  view_type?: ViewType;
}

export async function fetchSavedViewsApi(workspaceId: string, query: SavedViewQuery = {}): Promise<SavedViewSummary[]> {
  const params = new URLSearchParams();
  for (const [name, value] of Object.entries(query)) if (value) params.set(name, value);
  const search = params.toString();
  const res = await api.get<SavedViewSummary[]>(`${workspacePath(workspaceId, 'saved-views')}${search ? `?${search}` : ''}`);
  return res.data;
}

export async function fetchSavedViewApi(workspaceId: string, viewId: string): Promise<SavedViewSummary> {
  const res = await api.get<SavedViewSummary>(workspacePath(workspaceId, 'saved-views', viewId));
  return res.data;
}

export async function createSavedViewApi(workspaceId: string, body: SavedViewCreate): Promise<SavedViewSummary> {
  const res = await api.post<SavedViewSummary>(workspacePath(workspaceId, 'saved-views'), body);
  return res.data;
}

export async function updateSavedViewApi(workspaceId: string, viewId: string, body: SavedViewUpdate): Promise<SavedViewSummary> {
  const res = await api.patch<SavedViewSummary>(workspacePath(workspaceId, 'saved-views', viewId), body);
  return res.data;
}

export async function deleteSavedViewApi(workspaceId: string, viewId: string): Promise<void> {
  await api.delete(workspacePath(workspaceId, 'saved-views', viewId));
}
