import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import {
  createWorkflowTemplateApi,
  deleteWorkflowTemplateApi,
  fetchWorkflowApi,
  fetchWorkflowEditorsApi,
  fetchWorkflowTemplatesApi,
  previewWorkflowApi,
  publishWorkflowApi,
  setWorkflowEditorsApi,
} from '@/api/workflow';
import type { WorkflowDraft } from '@/types/workflow';

const ok = (data: unknown, status = 200) =>
  HttpResponse.json({ status: 'success', status_code: status, message: 'ok', data }, { status });

const draft: WorkflowDraft = {
  base_version: 3,
  transition_mode: 'restricted',
  wip_policy: 'warn',
  stages: [
    { ref: 's-todo', name: 'To Do', category: 'todo' },
    { ref: 'new:qa', name: 'QA', category: 'in_progress', color: 'warning' },
  ],
  initial: 's-todo',
  // The JSON key is literally `from`, null meaning "from any stage".
  transitions: [
    { from: 's-todo', to: 'new:qa' },
    { from: null, to: 's-todo' },
  ],
  replacements: { 's-review': 'new:qa' },
  merge_action: { mode: 'status', target: 'new:qa' },
};

describe('workflow routes', () => {
  it('reads the workflow of a space', async () => {
    server.use(http.get('*/workspaces/w1/spaces/sp1/workflow', () => ok({ space_id: 'sp1', version: 3 })));
    expect(await fetchWorkflowApi('w1', 'sp1')).toEqual({ space_id: 'sp1', version: 3 });
  });

  it('previews exactly the draft, `from` keys and nulls included', async () => {
    let body: unknown;
    server.use(
      http.post('*/workspaces/w1/spaces/sp1/workflow/preview', async ({ request }) => {
        body = await request.json();
        return ok({ valid: true, affected_issue_count: 4 });
      }),
    );
    expect((await previewWorkflowApi('w1', 'sp1', draft)).affected_issue_count).toBe(4);
    expect(body).toEqual(draft);
  });

  it('publishes with a PUT carrying the confirmation', async () => {
    let method = '';
    let body: unknown;
    server.use(
      http.put('*/workspaces/w1/spaces/sp1/workflow', async ({ request }) => {
        method = request.method;
        body = await request.json();
        return ok({ moved_issues: 4, version: 4 });
      }),
    );
    const result = await publishWorkflowApi('w1', 'sp1', {
      ...draft,
      confirmed_affected_issues: 4,
      acknowledge_reporting_changes: true,
    });
    expect(method).toBe('PUT');
    expect(body).toMatchObject({ confirmed_affected_issues: 4, acknowledge_reporting_changes: true });
    expect(result.version).toBe(4);
  });

  it('keeps the refusal data the editor acts on', async () => {
    server.use(
      http.put('*/workspaces/w1/spaces/sp1/workflow', () =>
        HttpResponse.json(
          { status: 'error', status_code: 409, message: 'Someone published first.', data: { current_version: 5 } },
          { status: 409 },
        ),
      ),
    );
    await expect(
      publishWorkflowApi('w1', 'sp1', { ...draft, confirmed_affected_issues: 0, acknowledge_reporting_changes: false }),
    ).rejects.toMatchObject({ status: 409, data: { current_version: 5 } });
  });

  it('reads and replaces the editors', async () => {
    let body: unknown;
    const editors = [{ user: { id: 'u2', display_name: 'Grace Hopper' }, role: 'member' }];
    server.use(
      http.get('*/workspaces/w1/spaces/sp1/workflow/editors', () => ok(editors)),
      http.put('*/workspaces/w1/spaces/sp1/workflow/editors', async ({ request }) => {
        body = await request.json();
        return ok(editors);
      }),
    );
    expect(await fetchWorkflowEditorsApi('w1', 'sp1')).toEqual(editors);
    expect(await setWorkflowEditorsApi('w1', 'sp1', ['u2'])).toEqual(editors);
    expect(body).toEqual({ user_ids: ['u2'] });
  });

  it('lists, saves and deletes templates', async () => {
    let created: unknown;
    let deletedPath = '';
    server.use(
      http.get('*/workspaces/w1/workflow-templates', () => ok([{ id: 'builtin:default', builtin: true }])),
      http.post('*/workspaces/w1/workflow-templates', async ({ request }) => {
        created = await request.json();
        return ok({ id: 't1', builtin: false }, 201);
      }),
      http.delete('*/workspaces/w1/workflow-templates/:id', ({ request }) => {
        deletedPath = new URL(request.url).pathname;
        return ok({ id: 't1' });
      }),
    );
    expect((await fetchWorkflowTemplatesApi('w1'))[0].id).toBe('builtin:default');
    expect((await createWorkflowTemplateApi('w1', { name: 'Ours', from_space_id: 'sp1' })).id).toBe('t1');
    expect(created).toEqual({ name: 'Ours', from_space_id: 'sp1' });
    expect(await deleteWorkflowTemplateApi('w1', 't1')).toEqual({ id: 't1' });
    expect(deletedPath).toMatch(/\/workflow-templates\/t1$/);
  });
});
