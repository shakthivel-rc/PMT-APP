import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import { createDependencyApi, deleteDependencyApi, fetchDependenciesApi } from '@/api/dependencies';
import {
  createReleaseApi,
  deleteReleaseApi,
  fetchFixVersionsApi,
  fetchReleaseApi,
  fetchReleaseNotesApi,
  fetchReleasesApi,
  setFixVersionsApi,
  shipReleaseApi,
  updateReleaseApi,
} from '@/api/releases';
import {
  createSavedViewApi,
  deleteSavedViewApi,
  fetchSavedViewApi,
  fetchSavedViewsApi,
  updateSavedViewApi,
} from '@/api/savedViews';

/*
 * The three planning-and-coordination modules added with the restructuring (dependencies,
 * releases and fix versions, saved views): paths, bodies, and the refusal data a screen acts on.
 */

const ok = (data: unknown, status = 200) =>
  HttpResponse.json({ status: 'success', status_code: status, message: 'ok', data }, { status });

/** Records every request as `METHOD path?query` and its JSON body, answering `data`. */
function record(data: unknown = {}) {
  const calls: { line: string; body: unknown }[] = [];
  server.use(
    http.all('*/workspaces/w1/*', async ({ request }) => {
      const url = new URL(request.url);
      const text = await request.text();
      calls.push({
        line: `${request.method} ${url.pathname.replace(/^.*\/workspaces\/w1/, '')}${url.search}`,
        body: text ? JSON.parse(text) : undefined,
      });
      return ok(data);
    }),
  );
  return calls;
}

describe('dependencies', () => {
  it('lists, creates by key, and deletes', async () => {
    const calls = record([]);
    await fetchDependenciesApi('w1', 'i1');
    await createDependencyApi('w1', 'i1', { kind: 'blocks', target_key: 'OPS-12' });
    await deleteDependencyApi('w1', 'd1');
    expect(calls).toEqual([
      { line: 'GET /issues/i1/dependencies', body: undefined },
      { line: 'POST /issues/i1/dependencies', body: { kind: 'blocks', target_key: 'OPS-12' } },
      { line: 'DELETE /dependencies/d1', body: undefined },
    ]);
  });

  it('keeps the id of the link a duplicate collides with', async () => {
    server.use(
      http.post('*/workspaces/w1/issues/i1/dependencies', () =>
        HttpResponse.json(
          { status: 'error', status_code: 409, message: 'Already linked.', data: { dependency_id: 'd7' } },
          { status: 409 },
        ),
      ),
    );
    await expect(createDependencyApi('w1', 'i1', { kind: 'relates', target_issue_id: 'i2' })).rejects.toMatchObject({
      status: 409,
      data: { dependency_id: 'd7' },
    });
  });
});

describe('releases and fix versions', () => {
  it('lists (optionally by state), creates, reads, updates, ships and deletes', async () => {
    const calls = record({});
    await fetchReleasesApi('w1', 'sp1');
    await fetchReleasesApi('w1', 'sp1', 'unreleased');
    await createReleaseApi('w1', 'sp1', { name: '2.4', release_date: '2026-11-01' });
    await fetchReleaseApi('w1', 'r1');
    await updateReleaseApi('w1', 'r1', { state: 'archived' });
    await shipReleaseApi('w1', 'r1');
    await shipReleaseApi('w1', 'r1', { move_open_to_release_id: 'r2' });
    await fetchReleaseNotesApi('w1', 'r1');
    await deleteReleaseApi('w1', 'r1');
    expect(calls.map((c) => c.line)).toEqual([
      'GET /spaces/sp1/releases',
      'GET /spaces/sp1/releases?state=unreleased',
      'POST /spaces/sp1/releases',
      'GET /releases/r1',
      'PATCH /releases/r1',
      'POST /releases/r1/release',
      'POST /releases/r1/release',
      'GET /releases/r1/notes',
      'DELETE /releases/r1',
    ]);
    expect(calls[2].body).toEqual({ name: '2.4', release_date: '2026-11-01' });
    expect(calls[4].body).toEqual({ state: 'archived' });
    // Releasing with nothing to say sends `{}`: today's date, and open issues stay put.
    expect(calls[5].body).toEqual({});
    expect(calls[6].body).toEqual({ move_open_to_release_id: 'r2' });
  });

  it('reads fix versions and replaces the whole set', async () => {
    const calls = record([]);
    await fetchFixVersionsApi('w1', 'i1');
    await setFixVersionsApi('w1', 'i1', ['r1', 'r-archived']);
    expect(calls).toEqual([
      { line: 'GET /issues/i1/fix-versions', body: undefined },
      { line: 'PUT /issues/i1/fix-versions', body: { release_ids: ['r1', 'r-archived'] } },
    ]);
  });
});

describe('saved views', () => {
  it('lists with only the query given, and does the rest on their own routes', async () => {
    const calls = record({});
    await fetchSavedViewsApi('w1');
    await fetchSavedViewsApi('w1', { scope_kind: 'space', scope_id: 'sp1', view_type: undefined });
    await fetchSavedViewApi('w1', 'v1');
    await createSavedViewApi('w1', { name: 'Mine', scope_kind: 'list', scope_id: 'l1', filters: { assignee_ids: ['me'] } });
    await updateSavedViewApi('w1', 'v1', { visibility: 'workspace' });
    await deleteSavedViewApi('w1', 'v1');
    expect(calls.map((c) => c.line)).toEqual([
      'GET /saved-views',
      'GET /saved-views?scope_kind=space&scope_id=sp1',
      'GET /saved-views/v1',
      'POST /saved-views',
      'PATCH /saved-views/v1',
      'DELETE /saved-views/v1',
    ]);
    expect(calls[3].body).toEqual({ name: 'Mine', scope_kind: 'list', scope_id: 'l1', filters: { assignee_ids: ['me'] } });
    expect(calls[4].body).toEqual({ visibility: 'workspace' });
  });
});
