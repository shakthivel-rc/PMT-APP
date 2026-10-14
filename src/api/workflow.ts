import type {
  WorkflowDefinition,
  WorkflowDraft,
  WorkflowEditor,
  WorkflowPreview,
  WorkflowPublish,
  WorkflowPublishResult,
  WorkflowTemplateCreate,
  WorkflowTemplateDeleted,
  WorkflowTemplateSummary,
} from '../types/workflow';
import { api } from './client';
import { workspacePath } from './workspaces';

/*
 * Customisable workflows (`routes/workflow.py` in pmt-api; 09-restructuring.md §4).
 * Publishing changes the workflow for the WHOLE space — every list, the sprint board and
 * reports — so the editor previews first and publishes what it previewed:
 *
 * - 409 `data.current_version`: someone published since the draft was loaded; reload.
 * - 409 `data.affected_issue_count`: the number of issues that would move changed since the
 *   preview; preview again and confirm the new number.
 * - 422 `data` is a whole `WorkflowPreview`: the draft is no longer valid against the space.
 * - 423: the space is archived or frozen.
 */

const workflowPath = (workspaceId: string, spaceId: string, ...segments: string[]) =>
  workspacePath(workspaceId, 'spaces', spaceId, 'workflow', ...segments);

export async function fetchWorkflowApi(workspaceId: string, spaceId: string): Promise<WorkflowDefinition> {
  const res = await api.get<WorkflowDefinition>(workflowPath(workspaceId, spaceId));
  return res.data;
}

/** Nothing is written. Every problem comes back as a code with the refs it is about. */
export async function previewWorkflowApi(
  workspaceId: string,
  spaceId: string,
  draft: WorkflowDraft,
): Promise<WorkflowPreview> {
  const res = await api.post<WorkflowPreview>(workflowPath(workspaceId, spaceId, 'preview'), draft);
  return res.data;
}

export async function publishWorkflowApi(
  workspaceId: string,
  spaceId: string,
  body: WorkflowPublish,
): Promise<WorkflowPublishResult> {
  const res = await api.put<WorkflowPublishResult>(workflowPath(workspaceId, spaceId), body);
  return res.data;
}

/** Explicit grants only: admins and owners can always edit and are not listed. */
export async function fetchWorkflowEditorsApi(workspaceId: string, spaceId: string): Promise<WorkflowEditor[]> {
  const res = await api.get<WorkflowEditor[]>(workflowPath(workspaceId, spaceId, 'editors'));
  return res.data;
}

/** Admins. Replaces the set; a 422 carries `data.not_members` and `data.guests`. */
export async function setWorkflowEditorsApi(
  workspaceId: string,
  spaceId: string,
  userIds: string[],
): Promise<WorkflowEditor[]> {
  const res = await api.put<WorkflowEditor[]>(workflowPath(workspaceId, spaceId, 'editors'), { user_ids: userIds });
  return res.data;
}

/** The built-ins first (`builtin:default`, `builtin:delivery`, `builtin:support`), then the workspace's own. */
export async function fetchWorkflowTemplatesApi(workspaceId: string): Promise<WorkflowTemplateSummary[]> {
  const res = await api.get<WorkflowTemplateSummary[]>(workspacePath(workspaceId, 'workflow-templates'));
  return res.data;
}

export async function createWorkflowTemplateApi(
  workspaceId: string,
  body: WorkflowTemplateCreate,
): Promise<WorkflowTemplateSummary> {
  const res = await api.post<WorkflowTemplateSummary>(workspacePath(workspaceId, 'workflow-templates'), body);
  return res.data;
}

/** Built-ins are a 404; the workspace's governance default is a 409. Spaces made from it are unaffected. */
export async function deleteWorkflowTemplateApi(workspaceId: string, templateId: string): Promise<WorkflowTemplateDeleted> {
  const res = await api.delete<WorkflowTemplateDeleted>(workspacePath(workspaceId, 'workflow-templates', templateId));
  return res.data;
}
