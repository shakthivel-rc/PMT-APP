import type { DependencyCreate, DependencySummary } from '../types/dependencies';
import { api } from './client';
import { workspacePath } from './workspaces';

/*
 * Typed dependencies (`routes/dependencies.py` in pmt-api; 09-restructuring.md §10). Linking
 * is planning: it bumps neither issue's `version`. Refusals: 404 for an issue that is not
 * there (or not yours), 422 for a link to itself, 423 when either end is read-only, and 409
 * for a duplicate — `data.dependency_id` names the link that already exists.
 */

/** Grouped by `label`, read from this issue's side. */
export async function fetchDependenciesApi(workspaceId: string, issueId: string): Promise<DependencySummary[]> {
  const res = await api.get<DependencySummary[]>(workspacePath(workspaceId, 'issues', issueId, 'dependencies'));
  return res.data;
}

export async function createDependencyApi(
  workspaceId: string,
  issueId: string,
  body: DependencyCreate,
): Promise<DependencySummary> {
  const res = await api.post<DependencySummary>(workspacePath(workspaceId, 'issues', issueId, 'dependencies'), body);
  return res.data;
}

export async function deleteDependencyApi(workspaceId: string, dependencyId: string): Promise<void> {
  await api.delete(workspacePath(workspaceId, 'dependencies', dependencyId));
}
