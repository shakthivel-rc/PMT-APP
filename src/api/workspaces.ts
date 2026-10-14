import type {
  DeferredDelivery,
  FolderCreate,
  FolderNode,
  FolderUpdate,
  GovernanceSettings,
  GovernanceSettingsUpdate,
  ListCreate,
  ListNode,
  ListUpdate,
  MemberAdd,
  MemberSummary,
  MemberUpdate,
  RepositoryLink,
  RepositorySummary,
  SpaceCreate,
  SpaceDetail,
  SpaceFreeze,
  SpaceNode,
  SpaceUnfreezeResult,
  SpaceUpdate,
  WorkspaceCreate,
  WorkspaceRatesResponse,
  WorkspaceRatesUpdate,
  WorkspaceSummary,
  WorkspaceTree,
  WorkspaceUpdate,
} from '../types/index';
import { api } from './client';

/*
 * The tenancy and hierarchy routes (`routes/workspaces.py` in pmt-api).
 *
 * Unlike the older modules beside this one, nothing here maps its payload. These routes
 * declare a `response_model`, so the shape is a contract the API validates on the way out,
 * and `types/index.ts` mirrors it field for field. A mapper would only be somewhere for a
 * field to be renamed on one side.
 *
 * A 404 from any `/workspaces/{id}` route means "not a member, or no such workspace" — the
 * API does not distinguish the two, so that tenancy cannot be probed. It surfaces here as an
 * `ApiError` with `status === 404`, and screens show it as "not found".
 */

/**
 * `/workspaces/{id}/…`, with every segment encoded.
 *
 * The ids are opaque and today never contain a slash, but they reach this function from the
 * URL bar, and an unencoded `../` in one would re-target the request at a different route
 * of the same API — with the caller's token attached.
 */
export function workspacePath(workspaceId: string, ...segments: string[]): string {
  return ['', 'workspaces', workspaceId, ...segments].map(encodeURIComponent).join('/');
}

export async function fetchWorkspacesApi(): Promise<WorkspaceSummary[]> {
  const res = await api.get<WorkspaceSummary[]>('/workspaces');
  return res.data;
}

/** The caller becomes its owner. */
export async function createWorkspaceApi(body: WorkspaceCreate): Promise<WorkspaceSummary> {
  const res = await api.post<WorkspaceSummary>('/workspaces', body);
  return res.data;
}

/**
 * Admins and owners: rename, or change the slug. A 409 means the slug is taken — possibly by a
 * deleted workspace, which keeps its slug so that restoring it cannot collide.
 */
export async function updateWorkspaceApi(workspaceId: string, body: WorkspaceUpdate): Promise<WorkspaceSummary> {
  const res = await api.patch<WorkspaceSummary>(workspacePath(workspaceId), body);
  return res.data;
}

/**
 * Owners only (an admin gets 403). A soft delete: the workspace leaves every list and all of its
 * routes answer 404, while its issues, time and history stay in the database. Refused (409)
 * while something in it would keep running unseen, such as a timer on one of its issues; `data`
 * names what.
 */
export async function deleteWorkspaceApi(workspaceId: string): Promise<string> {
  const res = await api.delete<{ id: string }>(workspacePath(workspaceId));
  return res.data.id;
}

export async function fetchWorkspaceTreeApi(workspaceId: string): Promise<WorkspaceTree> {
  const res = await api.get<WorkspaceTree>(workspacePath(workspaceId));
  return res.data;
}

export async function fetchMembersApi(workspaceId: string): Promise<MemberSummary[]> {
  const res = await api.get<MemberSummary[]>(workspacePath(workspaceId, 'members'));
  return res.data;
}

export async function addMemberApi(workspaceId: string, body: MemberAdd): Promise<MemberSummary> {
  const res = await api.post<MemberSummary>(workspacePath(workspaceId, 'members'), body);
  return res.data;
}

/**
 * Admins and owners. Only an owner makes an owner or changes an owner's role (403), and the last
 * owner cannot be demoted (409). Asking for the role someone already has changes nothing.
 */
export async function updateMemberApi(
  workspaceId: string,
  userId: string,
  body: MemberUpdate,
): Promise<MemberSummary> {
  const res = await api.patch<MemberSummary>(workspacePath(workspaceId, 'members', userId), body);
  return res.data;
}

/**
 * Removing yourself is leaving, which anyone may do. Removing someone else takes an admin or
 * owner, and removing an owner takes an owner. The last owner can neither leave nor be removed,
 * and a member who still owns something that needs a member, such as a space, cannot be removed
 * until it is handed over: both are 409s that say what to change first.
 */
export async function removeMemberApi(workspaceId: string, userId: string): Promise<string> {
  const res = await api.delete<{ user_id: string }>(workspacePath(workspaceId, 'members', userId));
  return res.data.user_id;
}

/**
 * Created from `body.workflow_template`, or the workspace's governance default, itself the
 * four-stage default unless an admin chose another. With `require_space_charter` on, a 422
 * lists every missing checklist item at once in `data.missing` (`['owner_id',
 * 'charter.objective']`); a 409 means the key is taken now, or reserved by a space that used
 * to have it.
 */
export async function createSpaceApi(workspaceId: string, body: SpaceCreate): Promise<SpaceNode> {
  const res = await api.post<SpaceNode>(workspacePath(workspaceId, 'spaces'), body);
  return res.data;
}

/** The space with its creation checklist, its old keys and its freeze. */
export async function fetchSpaceApi(workspaceId: string, spaceId: string): Promise<SpaceDetail> {
  const res = await api.get<SpaceDetail>(workspacePath(workspaceId, 'spaces', spaceId));
  return res.data;
}

/** Admins. Only the fields present change. A frozen or archived space answers 423. */
export async function updateSpaceApi(workspaceId: string, spaceId: string, body: SpaceUpdate): Promise<SpaceDetail> {
  const res = await api.patch<SpaceDetail>(workspacePath(workspaceId, 'spaces', spaceId), body);
  return res.data;
}

/**
 * Read-only for good, history kept. Refused (409) while the space has an active sprint;
 * `data.sprint_id` names it.
 */
export async function archiveSpaceApi(workspaceId: string, spaceId: string): Promise<SpaceNode> {
  const res = await api.post<SpaceNode>(workspacePath(workspaceId, 'spaces', spaceId, 'archive'));
  return res.data;
}

export async function unarchiveSpaceApi(workspaceId: string, spaceId: string): Promise<SpaceNode> {
  const res = await api.post<SpaceNode>(workspacePath(workspaceId, 'spaces', spaceId, 'unarchive'));
  return res.data;
}

/** Read-only while it is reorganised: every write in it answers 423 with `body.reason`. GitHub deliveries are deferred. */
export async function freezeSpaceApi(workspaceId: string, spaceId: string, body: SpaceFreeze): Promise<SpaceNode> {
  const res = await api.post<SpaceNode>(workspacePath(workspaceId, 'spaces', spaceId, 'freeze'), body);
  return res.data;
}

/**
 * Writable again, and the deliveries deferred meanwhile are replayed. A space a migration
 * plan froze cannot be unfrozen here while the plan is running (409, `data.plan_id`).
 */
export async function unfreezeSpaceApi(workspaceId: string, spaceId: string): Promise<SpaceUnfreezeResult> {
  const res = await api.post<SpaceUnfreezeResult>(workspacePath(workspaceId, 'spaces', spaceId, 'unfreeze'));
  return res.data;
}

export async function createFolderApi(
  workspaceId: string,
  spaceId: string,
  body: FolderCreate,
): Promise<FolderNode> {
  const res = await api.post<FolderNode>(workspacePath(workspaceId, 'spaces', spaceId, 'folders'), body);
  return res.data;
}

export async function updateFolderApi(workspaceId: string, folderId: string, body: FolderUpdate): Promise<FolderNode> {
  const res = await api.patch<FolderNode>(workspacePath(workspaceId, 'folders', folderId), body);
  return res.data;
}

/**
 * Archiving a folder makes its lists read-only. Refused (409) while any of its issues is in a
 * planned or active sprint — `data.issue_keys` and `data.sprints` say which.
 */
export async function archiveFolderApi(workspaceId: string, folderId: string): Promise<FolderNode> {
  const res = await api.post<FolderNode>(workspacePath(workspaceId, 'folders', folderId, 'archive'));
  return res.data;
}

export async function unarchiveFolderApi(workspaceId: string, folderId: string): Promise<FolderNode> {
  const res = await api.post<FolderNode>(workspacePath(workspaceId, 'folders', folderId, 'unarchive'));
  return res.data;
}

export async function createListApi(workspaceId: string, body: ListCreate): Promise<ListNode> {
  const res = await api.post<ListNode>(workspacePath(workspaceId, 'lists'), body);
  return res.data;
}

/** Rename, reorder, or move between folders of the same space. Another space is a transfer. */
export async function updateListApi(workspaceId: string, listId: string, body: ListUpdate): Promise<ListNode> {
  const res = await api.patch<ListNode>(workspacePath(workspaceId, 'lists', listId), body);
  return res.data;
}

/** Same refusals as `archiveFolderApi`. */
export async function archiveListApi(workspaceId: string, listId: string): Promise<ListNode> {
  const res = await api.post<ListNode>(workspacePath(workspaceId, 'lists', listId, 'archive'));
  return res.data;
}

export async function unarchiveListApi(workspaceId: string, listId: string): Promise<ListNode> {
  const res = await api.post<ListNode>(workspacePath(workspaceId, 'lists', listId, 'unarchive'));
  return res.data;
}

/** Every member may read them, so a form can mark what is required. */
export async function fetchGovernanceApi(workspaceId: string): Promise<GovernanceSettings> {
  const res = await api.get<GovernanceSettings>(workspacePath(workspaceId, 'settings', 'governance'));
  return res.data;
}

/** Admins. The default template must exist and be applicable (422 otherwise). */
export async function updateGovernanceApi(
  workspaceId: string,
  body: GovernanceSettingsUpdate,
): Promise<GovernanceSettings> {
  const res = await api.patch<GovernanceSettings>(workspacePath(workspaceId, 'settings', 'governance'), body);
  return res.data;
}

/** Admins: GitHub deliveries waiting for a frozen space, newest first, at most 200. */
export async function fetchDeferredDeliveriesApi(workspaceId: string): Promise<DeferredDelivery[]> {
  const res = await api.get<DeferredDelivery[]>(workspacePath(workspaceId, 'integrations', 'deferred'));
  return res.data;
}

export async function fetchRepositoriesApi(workspaceId: string): Promise<RepositorySummary[]> {
  const res = await api.get<RepositorySummary[]>(workspacePath(workspaceId, 'repositories'));
  return res.data;
}

export async function linkRepositoryApi(
  workspaceId: string,
  body: RepositoryLink,
): Promise<RepositorySummary> {
  const res = await api.post<RepositorySummary>(workspacePath(workspaceId, 'repositories'), body);
  return res.data;
}

/** Get workspace currency, default rate, and member rate overrides. */
export async function fetchWorkspaceRatesApi(workspaceId: string): Promise<WorkspaceRatesResponse> {
  const res = await api.get<WorkspaceRatesResponse>(workspacePath(workspaceId, 'settings', 'rates'));
  return res.data;
}

/** Update workspace currency, default rate, or member rate overrides. */
export async function updateWorkspaceRatesApi(
  workspaceId: string,
  body: WorkspaceRatesUpdate,
): Promise<WorkspaceRatesResponse> {
  const res = await api.put<WorkspaceRatesResponse>(workspacePath(workspaceId, 'settings', 'rates'), body);
  return res.data;
}
