import type { IssueCard } from '../types/index';
import type {
  SprintClose,
  SprintCloseResult,
  SprintCreate,
  SprintIssueChange,
  SprintStart,
  SprintSummary,
  SprintUpdate,
} from '../types/sprints';
import { api } from './client';
import { workspacePath } from './workspaces';

/*
 * Sprint planning (`routes/sprints.py` in pmt-api). Refusals worth knowing, as
 * `ApiError.status`:
 * - 403: starting, closing or deleting needs the workspace's `sprint_manage_role`.
 * - 409: another sprint in the project is active (`data.active_sprint_id`), the sprint is
 *   closed, or only a planned sprint can be deleted.
 * - 422: a sprint starts with both dates set.
 */

export async function fetchSprintsApi(workspaceId: string, spaceId: string, state?: string): Promise<SprintSummary[]> {
  const query = state ? `?state=${encodeURIComponent(state)}` : '';
  const res = await api.get<SprintSummary[]>(`${workspacePath(workspaceId, 'spaces', spaceId, 'sprints')}${query}`);
  return res.data;
}

export async function createSprintApi(workspaceId: string, spaceId: string, body: SprintCreate): Promise<SprintSummary> {
  const res = await api.post<SprintSummary>(workspacePath(workspaceId, 'spaces', spaceId, 'sprints'), body);
  return res.data;
}

export async function updateSprintApi(workspaceId: string, sprintId: string, body: SprintUpdate): Promise<SprintSummary> {
  const res = await api.patch<SprintSummary>(workspacePath(workspaceId, 'sprints', sprintId), body);
  return res.data;
}

export async function deleteSprintApi(workspaceId: string, sprintId: string): Promise<void> {
  await api.delete(workspacePath(workspaceId, 'sprints', sprintId));
}

export async function startSprintApi(workspaceId: string, sprintId: string, body: SprintStart = {}): Promise<SprintSummary> {
  const res = await api.post<SprintSummary>(workspacePath(workspaceId, 'sprints', sprintId, 'start'), body);
  return res.data;
}

export async function closeSprintApi(workspaceId: string, sprintId: string, body: SprintClose): Promise<SprintCloseResult> {
  const res = await api.post<SprintCloseResult>(workspacePath(workspaceId, 'sprints', sprintId, 'close'), body);
  return res.data;
}

export async function fetchSprintIssuesApi(workspaceId: string, sprintId: string): Promise<IssueCard[]> {
  const res = await api.get<IssueCard[]>(workspacePath(workspaceId, 'sprints', sprintId, 'issues'));
  return res.data;
}

export async function addSprintIssuesApi(workspaceId: string, sprintId: string, issueIds: string[]): Promise<SprintIssueChange> {
  const res = await api.post<SprintIssueChange>(workspacePath(workspaceId, 'sprints', sprintId, 'issues'), {
    issue_ids: issueIds,
  });
  return res.data;
}

export async function removeSprintIssuesApi(workspaceId: string, sprintId: string, issueIds: string[]): Promise<SprintIssueChange> {
  const res = await api.delete<SprintIssueChange>(workspacePath(workspaceId, 'sprints', sprintId, 'issues'), undefined, {
    issue_ids: issueIds,
  });
  return res.data;
}
