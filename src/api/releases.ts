import type {
  FixVersion,
  ReleaseCreate,
  ReleaseDetail,
  ReleaseNotes,
  ReleaseOutcome,
  ReleaseShip,
  ReleaseState,
  ReleaseSummary,
  ReleaseUpdate,
} from '../types/releases';
import { api } from './client';
import { workspacePath } from './workspaces';

/*
 * Releases and fix versions (`routes/releases.py` in pmt-api; 09-restructuring.md §10). A
 * release belongs to one space; its progress is counted from its issues on every read.
 * Refusals: 409 for a duplicate name, deleting a release that shipped, or PATCHing a release
 * to `released` (that is `shipReleaseApi`); 423 when the space is archived or frozen.
 */

const releasePath = (workspaceId: string, releaseId: string, ...segments: string[]) =>
  workspacePath(workspaceId, 'releases', releaseId, ...segments);

export async function fetchReleasesApi(
  workspaceId: string,
  spaceId: string,
  state?: ReleaseState,
): Promise<ReleaseSummary[]> {
  const query = state ? `?state=${encodeURIComponent(state)}` : '';
  const res = await api.get<ReleaseSummary[]>(`${workspacePath(workspaceId, 'spaces', spaceId, 'releases')}${query}`);
  return res.data;
}

export async function createReleaseApi(workspaceId: string, spaceId: string, body: ReleaseCreate): Promise<ReleaseSummary> {
  const res = await api.post<ReleaseSummary>(workspacePath(workspaceId, 'spaces', spaceId, 'releases'), body);
  return res.data;
}

export async function fetchReleaseApi(workspaceId: string, releaseId: string): Promise<ReleaseDetail> {
  const res = await api.get<ReleaseDetail>(releasePath(workspaceId, releaseId));
  return res.data;
}

export async function updateReleaseApi(workspaceId: string, releaseId: string, body: ReleaseUpdate): Promise<ReleaseSummary> {
  const res = await api.patch<ReleaseSummary>(releasePath(workspaceId, releaseId), body);
  return res.data;
}

/** Only a release that never shipped. */
export async function deleteReleaseApi(workspaceId: string, releaseId: string): Promise<void> {
  await api.delete(releasePath(workspaceId, releaseId));
}

/** Release it, optionally moving its open issues to another unreleased release. */
export async function shipReleaseApi(workspaceId: string, releaseId: string, body: ReleaseShip = {}): Promise<ReleaseOutcome> {
  const res = await api.post<ReleaseOutcome>(releasePath(workspaceId, releaseId, 'release'), body);
  return res.data;
}

export async function fetchReleaseNotesApi(workspaceId: string, releaseId: string): Promise<ReleaseNotes> {
  const res = await api.get<ReleaseNotes>(releasePath(workspaceId, releaseId, 'notes'));
  return res.data;
}

/** Archived releases included, with `state: 'archived'`. */
export async function fetchFixVersionsApi(workspaceId: string, issueId: string): Promise<FixVersion[]> {
  const res = await api.get<FixVersion[]>(workspacePath(workspaceId, 'issues', issueId, 'fix-versions'));
  return res.data;
}

/** REPLACES the set — pass every release that should stay, archived ones included. */
export async function setFixVersionsApi(workspaceId: string, issueId: string, releaseIds: string[]): Promise<FixVersion[]> {
  const res = await api.put<FixVersion[]>(workspacePath(workspaceId, 'issues', issueId, 'fix-versions'), {
    release_ids: releaseIds,
  });
  return res.data;
}
