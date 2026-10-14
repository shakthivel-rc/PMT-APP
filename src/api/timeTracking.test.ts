import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import { ApiError } from '@/api/client';
import {
  createTimeEntryApi,
  deleteTimeEntryApi,
  fetchIssueTimeApi,
  fetchTimeEntriesApi,
  fetchTimeReportApi,
  fetchTimeSettingsApi,
  updateTimeEntryApi,
  updateTimeSettingsApi,
} from '@/api/timeTracking';
import { discardTimerApi, fetchTimerApi, startTimerApi, stopTimerApi } from '@/api/timer';
import { makeIssueTime, makeTimeEntry, makeTimer, makeTimeReport, makeTimeSettings } from '@/test/fixtures';

const ok = (data: unknown, status = 200) =>
  HttpResponse.json({ status: 'success', status_code: status, message: 'ok', data }, { status });

const refuse = (status: number, message: string) =>
  HttpResponse.json({ status: 'error', status_code: status, message, data: null }, { status });

describe('the issue time panel', () => {
  it('reads the one payload the drawer draws', async () => {
    server.use(http.get('*/workspaces/w1/issues/i1/time-tracking', () => ok(makeIssueTime())));
    const panel = await fetchIssueTimeApi('w1', 'i1');
    expect(panel.summary.spent_seconds).toBe(5400);
  });

  it('posts exactly the entry it was given', async () => {
    let sent: unknown;
    server.use(
      http.post('*/workspaces/w1/issues/i1/time-entries', async ({ request }) => {
        sent = await request.json();
        return ok(makeTimeEntry(), 201);
      }),
    );
    await createTimeEntryApi('w1', 'i1', { duration_seconds: 60, work_date: '2026-10-01', note: null });
    expect(sent).toEqual({ duration_seconds: 60, work_date: '2026-10-01', note: null });
  });

  it('patches with explicit nulls kept, and surfaces a 403 as its status', async () => {
    let sent: unknown;
    server.use(
      http.patch('*/workspaces/w1/time-entries/t1', async ({ request }) => {
        sent = await request.json();
        return ok(makeTimeEntry({ note: null }));
      }),
    );
    await updateTimeEntryApi('w1', 't1', { note: null });
    expect(sent).toEqual({ note: null });

    server.use(http.patch('*/workspaces/w1/time-entries/t2', () => refuse(403, "Only an admin can change someone else's time.")));
    await expect(updateTimeEntryApi('w1', 't2', { note: 'x' })).rejects.toMatchObject({ status: 403 });
  });

  it('deletes and returns the id', async () => {
    server.use(http.delete('*/workspaces/w1/time-entries/t1', () => ok({ id: 't1' })));
    expect(await deleteTimeEntryApi('w1', 't1')).toBe('t1');
  });
});

describe('timesheets', () => {
  it('sends the filters it was given, drops empty ones, and pages explicitly', async () => {
    let url = new URL('http://unset');
    server.use(
      http.get('*/workspaces/w1/time-entries', ({ request }) => {
        url = new URL(request.url);
        return ok({ records: [], total: 0, total_seconds: 0 });
      }),
    );
    await fetchTimeEntriesApi('w1', { user_id: 'me', issue_id: '', date_from: '2026-10-01', page: 2 });
    expect(Object.fromEntries(url.searchParams)).toEqual({
      user_id: 'me', date_from: '2026-10-01', page: '2', limit: '50',
    });
    await fetchTimeEntriesApi('w1');
    expect(url.search).toBe('?page=1&limit=50');
  });

  it('asks for a report over a range, with the person only when named', async () => {
    const seen: string[] = [];
    server.use(
      http.get('*/workspaces/w1/time-report', ({ request }) => {
        seen.push(new URL(request.url).search);
        return ok(makeTimeReport());
      }),
    );
    await fetchTimeReportApi('w1', { date_from: '2026-09-28', date_to: '2026-10-04' });
    await fetchTimeReportApi('w1', { date_from: '2026-09-28', date_to: '2026-10-04', user_id: 'u2' });
    expect(seen).toEqual([
      '?date_from=2026-09-28&date_to=2026-10-04',
      '?date_from=2026-09-28&date_to=2026-10-04&user_id=u2',
    ]);
  });
});

describe('settings', () => {
  it('reads and patches the workspace settings', async () => {
    let sent: unknown;
    server.use(
      http.get('*/workspaces/w1/settings/time-tracking', () => ok(makeTimeSettings())),
      http.patch('*/workspaces/w1/settings/time-tracking', async ({ request }) => {
        sent = await request.json();
        return ok(makeTimeSettings({ visibility: 'own' }));
      }),
    );
    expect((await fetchTimeSettingsApi('w1')).hours_per_day).toBe(8);
    expect((await updateTimeSettingsApi('w1', { visibility: 'own' })).visibility).toBe('own');
    expect(sent).toEqual({ visibility: 'own' });
  });
});

describe('the timer', () => {
  it('reads null as "nothing running" rather than as a failure', async () => {
    server.use(http.get('*/timer', () => ok(null)));
    expect(await fetchTimerApi()).toBeNull();
  });

  it('starts on an issue with the local work date', async () => {
    let sent: unknown;
    server.use(
      http.post('*/workspaces/w1/issues/i1/timer', async ({ request }) => {
        sent = await request.json();
        return ok({ timer: makeTimer(), stopped_entry: null }, 201);
      }),
    );
    const result = await startTimerApi('w1', 'i1', { work_date: '2026-10-05' });
    expect(result.timer.issue.key).toBe('PAY-1');
    expect(sent).toEqual({ work_date: '2026-10-05' });
  });

  it('stops with an object body whether or not a note is given', async () => {
    const bodies: unknown[] = [];
    server.use(
      http.post('*/timer/stop', async ({ request }) => {
        bodies.push(await request.json());
        return ok({ entry: makeTimeEntry({ source: 'timer' }), capped: false });
      }),
    );
    await stopTimerApi();
    await stopTimerApi('done');
    expect(bodies).toEqual([{}, { note: 'done' }]);
  });

  it('discards and says whether there was anything to discard', async () => {
    server.use(http.delete('*/timer', () => ok({ discarded: true })));
    expect(await discardTimerApi()).toBe(true);
  });

  it('surfaces a switched-off workspace as a 422 with its message', async () => {
    server.use(http.post('*/workspaces/w1/issues/i1/timer', () => refuse(422, 'Time tracking is switched off in this workspace.')));
    const failure = await startTimerApi('w1', 'i1', {}).catch((err: unknown) => err);
    expect(failure).toBeInstanceOf(ApiError);
    expect((failure as ApiError).message).toMatch(/switched off/);
  });
});
