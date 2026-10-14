import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import {
  createCommentApi,
  createIssueApi,
  deleteIssueApi,
  fetchAIJobApi,
  fetchBoardApi,
  fetchCommentsApi,
  fetchIssueApi,
  fetchIssuesApi,
  isTerminalJob,
  fetchBacklogApi,
  filterParams,
  moveIssueApi,
  noticeAfter,
  rankInBacklogApi,
  requestThreadSummaryApi,
  resolveIssueKeyApi,
  updateIssueApi,
  waitForAIJobApi,
} from '@/api/issues';
import { makeAIJob, makeBoard, makeComment, makeIssueCard, makeIssueDetail } from '@/test/fixtures';
import type { AIJobSummary } from '@/types';

const ok = (data: unknown, status = 200) =>
  HttpResponse.json({ status: 'success', status_code: status, message: 'ok', data }, { status });

const refuse = (status: number, message: string) =>
  HttpResponse.json({ status: 'error', status_code: status, message, data: null }, { status });

describe('fetchIssuesApi', () => {
  it('sends the filters it was given, drops empty ones, and always pages explicitly', async () => {
    let url = new URL('http://unset');
    server.use(
      http.get('*/workspaces/w1/issues', ({ request }) => {
        url = new URL(request.url);
        return ok({ records: [makeIssueCard()], total: 31 });
      }),
    );

    const page = await fetchIssuesApi('w1', { list_id: 'l1', type: 'bug', q: '', assignee_id: undefined, page: 2 });

    expect(page.total).toBe(31);
    expect(Object.fromEntries(url.searchParams)).toEqual({ list_id: 'l1', type: 'bug', page: '2', limit: '50' });
  });

  it('asks for page 1 of 50 when given no filters at all', async () => {
    let search = '';
    server.use(
      http.get('*/workspaces/w1/issues', ({ request }) => {
        search = new URL(request.url).search;
        return ok({ records: [], total: 0 });
      }),
    );
    await fetchIssuesApi('w1');
    expect(search).toBe('?page=1&limit=50');
  });
});

describe('filterParams and noticeAfter', () => {
  it('repeats arrays, spells booleans, and drops what is unset', () => {
    const params = filterParams({ type: ['bug', 'task'], blocked: false, q: '', epic_id: undefined, assignee_id: null });
    expect(params.toString()).toBe('type=bug&type=task&blocked=false');
  });

  it('adds to the parameters it is given', () => {
    expect(filterParams({ q: 'refund' }, new URLSearchParams({ list_id: 'l1' })).toString()).toBe('list_id=l1&q=refund');
  });

  it('finds the clause after the plain message, and nothing when there is none', () => {
    expect(noticeAfter('Issue moved. Done is over its WIP limit (2 of 1).', 'Issue moved')).toBe(
      'Done is over its WIP limit (2 of 1).',
    );
    expect(noticeAfter('Issue moved', 'Issue moved')).toBeNull();
    expect(noticeAfter('Issue moved. ', 'Issue moved')).toBeNull();
    expect(noticeAfter(undefined, 'Issue moved')).toBeNull();
    expect(noticeAfter('Something else. Entirely', 'Issue moved')).toBeNull();
  });
});

describe('fetchBoardApi', () => {
  it('sends the filters after the scope, repeating the multi-valued ones', async () => {
    let search = '';
    server.use(
      http.get('*/workspaces/w1/board', ({ request }) => {
        search = new URL(request.url).search;
        return ok(makeBoard());
      }),
    );
    await fetchBoardApi('w1', { sprint_id: 'spr1' }, { type: ['story', 'bug'], priority: ['urgent'], blocked: true, assignee_id: 'me' });
    expect(search).toBe('?sprint_id=spr1&type=story&type=bug&priority=urgent&blocked=true&assignee_id=me');
  });

  it.each([
    [{ list_id: 'l1' }, 'list_id=l1'],
    [{ space_id: 'sp1' }, 'space_id=sp1'],
    [{ sprint_id: 'spr1' }, 'sprint_id=spr1'],
  ])('scopes the board by %o', async (scope, query) => {
    let search = '';
    server.use(
      http.get('*/workspaces/w1/board', ({ request }) => {
        search = new URL(request.url).search;
        return ok(makeBoard());
      }),
    );
    const board = await fetchBoardApi('w1', scope);
    expect(search).toBe(`?${query}`);
    expect(board.columns.map((c) => c.status.name)).toEqual(['To Do', 'In Progress', 'In Review', 'Done']);
  });
});

describe('issue reads and writes', () => {
  it('reads one issue', async () => {
    expect(await fetchIssueApi('w1', 'i1')).toEqual(makeIssueDetail());
  });

  it('creates an issue with exactly the body given', async () => {
    let body: unknown;
    server.use(
      http.post('*/workspaces/w1/issues', async ({ request }) => {
        body = await request.json();
        return ok(makeIssueDetail({ id: 'i7' }), 201);
      }),
    );
    const created = await createIssueApi('w1', { list_id: 'l1', title: 'New', type: 'task', status_id: 's-todo' });
    expect(body).toEqual({ list_id: 'l1', title: 'New', type: 'task', status_id: 's-todo' });
    expect(created.value.id).toBe('i7');
    expect(created.notice).toBeNull();
  });

  it('passes on the WIP clause a `warn` space adds to a create', async () => {
    server.use(
      http.post('*/workspaces/w1/issues', () =>
        HttpResponse.json(
          {
            status: 'success',
            status_code: 201,
            message: 'Issue created. In Progress is over its WIP limit (5 of 4).',
            data: makeIssueDetail({ id: 'i7' }),
          },
          { status: 201 },
        ),
      ),
    );
    const created = await createIssueApi('w1', { list_id: 'l1', title: 'New' });
    expect(created.notice).toBe('In Progress is over its WIP limit (5 of 4).');
  });

  it('PATCHes an update, explicit nulls included', async () => {
    let body: unknown;
    server.use(
      http.patch('*/workspaces/w1/issues/i1', async ({ request }) => {
        body = await request.json();
        return ok(makeIssueDetail({ version: 4 }));
      }),
    );
    const updated = await updateIssueApi('w1', 'i1', { version: 3, assignee_id: null });
    // Null is "clear it", omitted is "leave it" — the null has to survive serialisation.
    expect(body).toEqual({ version: 3, assignee_id: null });
    expect(updated.version).toBe(4);
  });

  it('surfaces a stale version as a 409 ApiError', async () => {
    server.use(http.patch('*/workspaces/w1/issues/i1', () => refuse(409, 'Someone changed this issue.')));
    await expect(updateIssueApi('w1', 'i1', { version: 1, title: 'x' })).rejects.toMatchObject({
      status: 409,
      message: 'Someone changed this issue.',
    });
  });

  it('moves an issue between two named neighbours', async () => {
    let body: unknown;
    server.use(
      http.post('*/workspaces/w1/issues/i1/move', async ({ request }) => {
        body = await request.json();
        return ok(makeIssueCard({ status_id: 's-done', rank: 'b5' }));
      }),
    );
    const card = await moveIssueApi('w1', 'i1', { status_id: 's-done', after_id: 'i2', before_id: null });
    expect(body).toEqual({ status_id: 's-done', after_id: 'i2', before_id: null });
    expect(card.value.rank).toBe('b5');
    expect(card.notice).toBeNull();
  });

  it('passes on the WIP clause a `warn` space adds to a move', async () => {
    server.use(
      http.post('*/workspaces/w1/issues/i1/move', () =>
        HttpResponse.json({
          status: 'success',
          status_code: 200,
          message: 'Issue moved. In Review is over its WIP limit (3 of 2).',
          data: makeIssueCard({ status_id: 's-review' }),
        }),
      ),
    );
    const moved = await moveIssueApi('w1', 'i1', { status_id: 's-review', after_id: null, before_id: null });
    expect(moved.notice).toBe('In Review is over its WIP limit (3 of 2).');
  });

  it('surfaces a read-only space as a 423 whose message says what lifts it', async () => {
    server.use(
      http.post('*/workspaces/w1/issues/i1/move', () => refuse(423, 'Payments is frozen while it is being reorganised.')),
    );
    await expect(moveIssueApi('w1', 'i1', { status_id: 's-done', after_id: null, before_id: null })).rejects.toMatchObject({
      status: 423,
      message: 'Payments is frozen while it is being reorganised.',
    });
  });

  it('deletes an issue and returns its id', async () => {
    server.use(http.delete('*/workspaces/w1/issues/i1', () => ok({ id: 'i1' })));
    expect(await deleteIssueApi('w1', 'i1')).toBe('i1');
  });
});

describe('comments', () => {
  it('reads the thread and posts to it', async () => {
    expect(await fetchCommentsApi('w1', 'i1')).toEqual([makeComment()]);
    const posted = await createCommentApi('w1', 'i1', { body: 'Fixed in #42' });
    expect(posted.body).toBe('Fixed in #42');
  });
});

describe('thread summaries', () => {
  it('requests a summary and gets the 202 job back', async () => {
    expect(await requestThreadSummaryApi('w1', 'i1')).toEqual(makeAIJob());
  });

  it('passes the 503 message through untouched, since it is written for people', async () => {
    server.use(
      http.post('*/workspaces/w1/issues/i1/summary', () =>
        refuse(503, 'AI features are turned off on this deployment.'),
      ),
    );
    await expect(requestThreadSummaryApi('w1', 'i1')).rejects.toMatchObject({
      status: 503,
      message: 'AI features are turned off on this deployment.',
    });
  });

  it('reads one job', async () => {
    expect((await fetchAIJobApi('w1', 'job1')).status).toBe('succeeded');
  });

  it('treats succeeded and failed as terminal, and nothing else', () => {
    expect(['queued', 'running', 'succeeded', 'failed'].map((status) =>
      isTerminalJob(makeAIJob({ status: status as AIJobSummary['status'] })),
    )).toEqual([false, false, true, true]);
  });
});

describe('waitForAIJobApi', () => {
  /** Answers each poll with the next status in `statuses`, repeating the last one. */
  function jobSequence(statuses: AIJobSummary['status'][]) {
    let polls = 0;
    server.use(
      http.get('*/workspaces/w1/ai-jobs/job1', () => {
        const status = statuses[Math.min(polls, statuses.length - 1)];
        polls += 1;
        return ok(makeAIJob({ status, error: status === 'failed' ? 'The model refused.' : null }));
      }),
    );
    return () => polls;
  }

  it('polls until the job succeeds, one question at a time', async () => {
    const polls = jobSequence(['queued', 'running', 'succeeded']);
    const job = await waitForAIJobApi('w1', 'job1', { intervalMs: 1, signal: new AbortController().signal });
    expect(job.status).toBe('succeeded');
    expect(polls()).toBe(3);
  });

  it('returns a failed job rather than throwing, because its error is the thing to show', async () => {
    jobSequence(['running', 'failed']);
    const job = await waitForAIJobApi('w1', 'job1', { intervalMs: 1 });
    expect(job).toMatchObject({ status: 'failed', error: 'The model refused.' });
  });

  it('gives up with a readable message once the wait passes its ceiling', async () => {
    const polls = jobSequence(['running']);
    await expect(waitForAIJobApi('w1', 'job1', { intervalMs: 1, maxWaitMs: 20 })).rejects.toThrow(
      /did not finish within 0s\. Try again/,
    );
    expect(polls()).toBeGreaterThan(0);
  });

  it('stops without asking again once aborted', async () => {
    const polls = jobSequence(['running']);
    const controller = new AbortController();
    const waiting = waitForAIJobApi('w1', 'job1', { intervalMs: 50, signal: controller.signal });
    controller.abort();
    await expect(waiting).rejects.toMatchObject({ name: 'AbortError' });
    expect(polls()).toBe(0);
  });

  it('does not start at all on a signal that is already aborted', async () => {
    const polls = jobSequence(['running']);
    const controller = new AbortController();
    controller.abort();
    await expect(waitForAIJobApi('w1', 'job1', { signal: controller.signal })).rejects.toMatchObject({
      name: 'AbortError',
    });
    expect(polls()).toBe(0);
  });
});

describe('planning and keys', () => {
  it('reads the backlog with no query string when unfiltered', async () => {
    let search = 'unset';
    server.use(
      http.get('*/workspaces/w1/spaces/sp1/backlog', ({ request }) => {
        search = new URL(request.url).search;
        return ok({ space_id: 'sp1', sprints: [], backlog: { cards: [], total: 0, truncated: false }, epics: [] });
      }),
    );
    const backlog = await fetchBacklogApi('w1', 'sp1');
    expect(search).toBe('');
    expect(backlog.backlog.total).toBe(0);
  });

  it('reads the backlog filtered, closed work included on request', async () => {
    let search = '';
    server.use(
      http.get('*/workspaces/w1/spaces/sp1/backlog', ({ request }) => {
        search = new URL(request.url).search;
        return ok({ space_id: 'sp1', sprints: [], backlog: { cards: [], total: 0, truncated: false }, epics: [] });
      }),
    );
    await fetchBacklogApi('w1', 'sp1', { epic_id: 'e1', include_closed: true });
    expect(search).toBe('?epic_id=e1&include_closed=true');
  });

  it('ranks an issue in the backlog between two neighbours', async () => {
    let body: unknown;
    server.use(
      http.post('*/workspaces/w1/issues/i1/backlog-rank', async ({ request }) => {
        body = await request.json();
        return ok(makeIssueCard({ backlog_rank: 'c3' }));
      }),
    );
    const card = await rankInBacklogApi('w1', 'i1', { after_id: 'i2', before_id: null });
    expect(body).toEqual({ after_id: 'i2', before_id: null });
    expect(card.backlog_rank).toBe('c3');
  });

  it('resolves a key, encoding it into the path', async () => {
    let path = '';
    server.use(
      http.get('*/workspaces/w1/issue-keys/:key', ({ request }) => {
        path = new URL(request.url).pathname;
        return ok({
          issue: makeIssueCard(),
          list_id: 'l1',
          space_id: 'sp1',
          current_key: 'PAY-1',
          resolved_via: 'issue_alias',
        });
      }),
    );
    const found = await resolveIssueKeyApi('w1', 'OLD-7');
    expect(path).toMatch(/\/workspaces\/w1\/issue-keys\/OLD-7$/);
    expect(found.current_key).toBe('PAY-1');
  });
});
