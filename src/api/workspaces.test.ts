import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import { notFound } from '@/test/msw/handlers';
import {
  addMemberApi,
  archiveFolderApi,
  archiveListApi,
  archiveSpaceApi,
  createFolderApi,
  createListApi,
  createSpaceApi,
  createWorkspaceApi,
  deleteWorkspaceApi,
  fetchDeferredDeliveriesApi,
  fetchGovernanceApi,
  fetchMembersApi,
  fetchRepositoriesApi,
  fetchSpaceApi,
  fetchWorkspaceTreeApi,
  fetchWorkspacesApi,
  freezeSpaceApi,
  linkRepositoryApi,
  removeMemberApi,
  unarchiveFolderApi,
  unarchiveListApi,
  unarchiveSpaceApi,
  unfreezeSpaceApi,
  updateFolderApi,
  updateGovernanceApi,
  updateListApi,
  updateMemberApi,
  updateSpaceApi,
  updateWorkspaceApi,
  workspacePath,
} from '@/api/workspaces';
import { makeSpace, makeSpaceDetail, makeTree, makeWorkspace } from '@/test/fixtures';

const ok = (data: unknown, status = 200) =>
  HttpResponse.json({ status: 'success', status_code: status, message: 'ok', data }, { status });

/** Registers a POST handler that records what it was sent and answers 201 with `data`. */
function capturePost(path: string, data: unknown) {
  const seen: { url?: string; body?: unknown } = {};
  server.use(
    http.post(path, async ({ request }) => {
      seen.url = request.url;
      seen.body = await request.json();
      return ok(data, 201);
    }),
  );
  return seen;
}

describe('workspacePath', () => {
  it('builds the route from its segments', () => {
    expect(workspacePath('w1')).toBe('/workspaces/w1');
    expect(workspacePath('w1', 'spaces', 'sp1', 'folders')).toBe('/workspaces/w1/spaces/sp1/folders');
  });

  it('encodes every segment, so an id from the URL bar cannot re-target the request', () => {
    // `../users` unencoded would resolve to `/users` — a different route, same token.
    expect(workspacePath('../users', 'a b')).toBe('/workspaces/..%2Fusers/a%20b');
  });
});

describe('workspace reads', () => {
  it('returns the caller’s workspaces as sent', async () => {
    server.use(http.get('*/workspaces', () => ok([makeWorkspace({ role: 'guest' })])));
    expect(await fetchWorkspacesApi()).toEqual([makeWorkspace({ role: 'guest' })]);
  });

  it('returns the whole tree for one workspace', async () => {
    const tree = await fetchWorkspaceTreeApi('w1');
    expect(tree).toEqual(makeTree());
  });

  it('surfaces the tenancy 404 as an ApiError carrying the status', async () => {
    server.use(http.get('*/workspaces/:id', notFound));
    await expect(fetchWorkspaceTreeApi('someone-elses')).rejects.toMatchObject({
      name: 'ApiError',
      status: 404,
      message: 'Workspace not found.',
    });
  });

  it('reads members and repositories from their own routes', async () => {
    const member = { user_id: 'u1', email: 'a@x.com', first_name: 'Ada', last_name: 'L', role: 'admin' };
    const repo = { id: 'r1', provider: 'github', full_name: 'acme/pay', created_at: '2026-09-28T10:00:00Z' };
    server.use(
      http.get('*/workspaces/w1/members', () => ok([member])),
      http.get('*/workspaces/w1/repositories', () => ok([repo])),
    );
    expect(await fetchMembersApi('w1')).toEqual([member]);
    expect(await fetchRepositoriesApi('w1')).toEqual([repo]);
  });
});

describe('workspace writes', () => {
  it('POSTs a new workspace as given and returns the 201 payload', async () => {
    const seen = capturePost('*/workspaces', makeWorkspace({ id: 'w9' }));
    const created = await createWorkspaceApi({ name: 'Acme', slug: 'acme' });
    expect(seen.body).toEqual({ name: 'Acme', slug: 'acme' });
    expect(created.id).toBe('w9');
  });

  it('adds a member', async () => {
    const seen = capturePost('*/workspaces/w1/members', { user_id: 'u5' });
    expect(await addMemberApi('w1', { email: 'dev@x.com', role: 'member' })).toEqual({ user_id: 'u5' });
    expect(seen.body).toEqual({ email: 'dev@x.com', role: 'member' });
  });

  it('creates a space, a folder inside it, and a list', async () => {
    const space = capturePost('*/workspaces/w1/spaces', { id: 'sp9' });
    const folder = capturePost('*/workspaces/w1/spaces/sp9/folders', { id: 'f9' });
    const list = capturePost('*/workspaces/w1/lists', { id: 'l9' });

    expect(await createSpaceApi('w1', { name: 'Payments', key: 'PAY' })).toEqual({ id: 'sp9' });
    expect(await createFolderApi('w1', 'sp9', { name: 'Q4' })).toEqual({ id: 'f9' });
    expect(await createListApi('w1', { space_id: 'sp9', folder_id: null, name: 'Backlog' })).toEqual({ id: 'l9' });

    expect(space.body).toEqual({ name: 'Payments', key: 'PAY' });
    expect(folder.url).toMatch(/\/workspaces\/w1\/spaces\/sp9\/folders$/);
    expect(list.body).toEqual({ space_id: 'sp9', folder_id: null, name: 'Backlog' });
  });

  it('links a repository', async () => {
    const seen = capturePost('*/workspaces/w1/repositories', { id: 'r9' });
    expect(await linkRepositoryApi('w1', { full_name: 'acme/payments' })).toEqual({ id: 'r9' });
    expect(seen.body).toEqual({ full_name: 'acme/payments' });
  });
});

describe('workspace and member changes', () => {
  const refuse = (status: number, message: string, data: unknown = null) =>
    HttpResponse.json({ status: 'error', status_code: status, message, data }, { status });

  it('PATCHes only the fields given and returns the summary with the caller’s role', async () => {
    let body: unknown;
    server.use(
      http.patch('*/workspaces/w1', async ({ request }) => {
        body = await request.json();
        return ok(makeWorkspace({ name: 'Acme Platform', role: 'admin' }));
      }),
    );
    expect(await updateWorkspaceApi('w1', { name: 'Acme Platform' })).toEqual(
      makeWorkspace({ name: 'Acme Platform', role: 'admin' }),
    );
    expect(body).toEqual({ name: 'Acme Platform' });
  });

  it('keeps the API’s words when a slug is taken', async () => {
    const message = 'That slug is taken, possibly by a deleted workspace, which keeps it. Choose another.';
    server.use(http.patch('*/workspaces/w1', () => refuse(409, message)));
    await expect(updateWorkspaceApi('w1', { slug: 'acme' })).rejects.toMatchObject({ status: 409, message });
  });

  it('DELETEs a workspace with no body and returns its id', async () => {
    const seen: { body?: string } = {};
    server.use(
      http.delete('*/workspaces/w1', async ({ request }) => {
        seen.body = await request.text();
        return ok({ id: 'w1' });
      }),
    );
    expect(await deleteWorkspaceApi('w1')).toBe('w1');
    expect(seen.body).toBe('');
  });

  it('keeps what a refused delete names, so it can be shown', async () => {
    server.use(
      http.delete('*/workspaces/w1', () =>
        refuse(409, 'A timer is running on PAY-1. Stop it first.', { issue_keys: ['PAY-1'] }),
      ),
    );
    await expect(deleteWorkspaceApi('w1')).rejects.toMatchObject({
      status: 409,
      message: 'A timer is running on PAY-1. Stop it first.',
      data: { issue_keys: ['PAY-1'] },
    });
  });

  it('PATCHes a member’s role on their own route', async () => {
    const member = { user_id: 'u2', email: 'grace@x.com', first_name: 'Grace', last_name: 'Hopper', role: 'admin' };
    let body: unknown;
    server.use(
      http.patch('*/workspaces/w1/members/u2', async ({ request }) => {
        body = await request.json();
        return ok(member);
      }),
    );
    expect(await updateMemberApi('w1', 'u2', { role: 'admin' })).toEqual(member);
    expect(body).toEqual({ role: 'admin' });
  });

  it('keeps the last-owner refusal as worded', async () => {
    const message = 'A workspace needs at least one owner. Make someone else an owner first.';
    server.use(http.patch('*/workspaces/w1/members/u1', () => refuse(409, message)));
    await expect(updateMemberApi('w1', 'u1', { role: 'admin' })).rejects.toMatchObject({ status: 409, message });
  });

  it('DELETEs a member and returns the user id', async () => {
    server.use(http.delete('*/workspaces/w1/members/u2', () => ok({ user_id: 'u2' })));
    expect(await removeMemberApi('w1', 'u2')).toBe('u2');
  });

  it('encodes the user id too, so it cannot re-target the request', async () => {
    let url = '';
    server.use(
      http.delete('*/workspaces/w1/members/:userId', ({ request }) => {
        url = request.url;
        return ok({ user_id: '../u2' });
      }),
    );
    await removeMemberApi('w1', '../u2');
    expect(url).toMatch(/\/workspaces\/w1\/members\/\.\.%2Fu2$/);
  });
});

describe('space governance and write state', () => {
  it('reads and PATCHes a space detail, explicit nulls included', async () => {
    let body: unknown;
    server.use(
      http.get('*/workspaces/w1/spaces/sp1', () => ok(makeSpaceDetail({ key_aliases: ['PAYM'] }))),
      http.patch('*/workspaces/w1/spaces/sp1', async ({ request }) => {
        body = await request.json();
        return ok(makeSpaceDetail({ key: 'PAYS', key_aliases: ['PAY'] }));
      }),
    );
    expect((await fetchSpaceApi('w1', 'sp1')).key_aliases).toEqual(['PAYM']);
    const updated = await updateSpaceApi('w1', 'sp1', { key: 'PAYS', owner_id: null });
    expect(body).toEqual({ key: 'PAYS', owner_id: null });
    expect(updated.key_aliases).toEqual(['PAY']);
  });

  it('keeps the governance 422 detail a checklist form renders', async () => {
    server.use(
      http.post('*/workspaces/w1/spaces', () =>
        HttpResponse.json(
          {
            status: 'error',
            status_code: 422,
            message: 'This workspace requires the space charter.',
            data: { missing: ['owner_id', 'charter.objective'] },
          },
          { status: 422 },
        ),
      ),
    );
    await expect(createSpaceApi('w1', { name: 'Payments', key: 'PAY' })).rejects.toMatchObject({
      status: 422,
      data: { missing: ['owner_id', 'charter.objective'] },
    });
  });

  it.each([
    ['archive', archiveSpaceApi],
    ['unarchive', unarchiveSpaceApi],
  ] as const)('POSTs a space %s with no body', async (action, call) => {
    const seen: { url?: string; body?: string } = {};
    server.use(
      http.post(`*/workspaces/w1/spaces/sp1/${action}`, async ({ request }) => {
        seen.url = request.url;
        seen.body = await request.text();
        return ok(makeSpace({ archived: action === 'archive' }));
      }),
    );
    expect((await call('w1', 'sp1')).archived).toBe(action === 'archive');
    expect(seen.body).toBe('');
  });

  it('freezes with a reason and unfreezes with the replay summary', async () => {
    const freeze = capturePost('*/workspaces/w1/spaces/sp1/freeze', makeSpace({ frozen: true, freeze_reason: 'Wave 1' }));
    server.use(
      http.post('*/workspaces/w1/spaces/sp1/unfreeze', () =>
        ok({ space: makeSpace(), replay: { replayed: 2, still_deferred: 0, failed: 0 } }),
      ),
    );
    expect((await freezeSpaceApi('w1', 'sp1', { reason: 'Wave 1' })).frozen).toBe(true);
    expect(freeze.body).toEqual({ reason: 'Wave 1' });
    expect((await unfreezeSpaceApi('w1', 'sp1')).replay).toEqual({ replayed: 2, still_deferred: 0, failed: 0 });
  });

  it('renames, moves, archives and unarchives folders and lists on their own routes', async () => {
    const seen: string[] = [];
    const bodies: unknown[] = [];
    const node = { id: 'n', name: 'N', position: 0, archived: false, lists: [], folder_id: null };
    server.use(
      http.patch('*/workspaces/w1/folders/f1', async ({ request }) => {
        seen.push('PATCH folder');
        bodies.push(await request.json());
        return ok(node);
      }),
      http.patch('*/workspaces/w1/lists/l1', async ({ request }) => {
        seen.push('PATCH list');
        bodies.push(await request.json());
        return ok(node);
      }),
      http.post('*/workspaces/w1/:kind/:id/:action', ({ params }) => {
        seen.push(`${String(params.action)} ${String(params.kind)}`);
        return ok(node);
      }),
    );
    await updateFolderApi('w1', 'f1', { name: 'Q1', position: 2 });
    await updateListApi('w1', 'l1', { folder_id: null });
    await archiveFolderApi('w1', 'f1');
    await unarchiveFolderApi('w1', 'f1');
    await archiveListApi('w1', 'l1');
    await unarchiveListApi('w1', 'l1');
    expect(seen).toEqual([
      'PATCH folder',
      'PATCH list',
      'archive folders',
      'unarchive folders',
      'archive lists',
      'unarchive lists',
    ]);
    // `folder_id: null` is "move it to the space root" and has to survive serialisation.
    expect(bodies).toEqual([{ name: 'Q1', position: 2 }, { folder_id: null }]);
  });

  it('reads and PATCHes the governance settings', async () => {
    const settings = {
      require_space_charter: false,
      require_epic_owner_and_criteria: true,
      default_workflow_template: 'default',
      inactive_after_days: 90,
    };
    let body: unknown;
    server.use(
      http.get('*/workspaces/w1/settings/governance', () => ok(settings)),
      http.patch('*/workspaces/w1/settings/governance', async ({ request }) => {
        body = await request.json();
        return ok({ ...settings, require_space_charter: true });
      }),
    );
    expect(await fetchGovernanceApi('w1')).toEqual(settings);
    expect((await updateGovernanceApi('w1', { require_space_charter: true })).require_space_charter).toBe(true);
    expect(body).toEqual({ require_space_charter: true });
  });

  it('lists the deliveries deferred for frozen spaces', async () => {
    const delivery = { id: 'd1', event: 'pull_request', received_at: '2026-10-05T10:00:00', note: 'PAY is frozen', keys: ['PAY-1'] };
    server.use(http.get('*/workspaces/w1/integrations/deferred', () => ok([delivery])));
    expect(await fetchDeferredDeliveriesApi('w1')).toEqual([delivery]);
  });
});
