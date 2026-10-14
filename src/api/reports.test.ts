import { afterEach, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import { ApiError } from '@/api/client';
import {
  downloadReportJobApi,
  exportReportApi,
  isFinishedJob,
  reportSearchParams,
  runReportApi,
  waitForReportJobApi,
} from '@/api/reports';
import { deleteSprintApi, removeSprintIssuesApi, updateSprintApi } from '@/api/sprints';
import type { ReportJob } from '@/types/reports';

/**
 * The reports API: parameters travel as a query string, an export answers with a file or a
 * job, a job is polled until it settles, and the sprint "remove issues" DELETE carries a body.
 */

const ok = (data: unknown, status = 200) =>
  HttpResponse.json({ status: 'success', status_code: status, message: 'ok', data }, { status });

const job = (overrides: Partial<ReportJob> = {}): ReportJob => ({
  id: 'j1',
  kind: 'export',
  report_type: 'timesheet',
  format: 'csv',
  status: 'queued',
  error: null,
  file_name: null,
  size_bytes: null,
  row_count: null,
  params: {},
  created_at: '2026-10-05T10:00:00',
  finished_at: null,
  expires_at: null,
  download_path: null,
  ...overrides,
});

afterEach(() => vi.useRealTimers());

describe('running a report', () => {
  it('sends lists as repeated keys and skips empty values', () => {
    const query = reportSearchParams({ scope: 'workspace', user_ids: ['u1', 'u2'], epic_id: '', sprint_id: null as unknown as string });
    expect(query.toString()).toBe('scope=workspace&user_ids=u1&user_ids=u2');
  });

  it('GETs the report with its parameters', async () => {
    let seen: URL | undefined;
    server.use(
      http.get('*/workspaces/w1/reports/timesheet', ({ request }) => {
        seen = new URL(request.url);
        return ok({ meta: { title: 'Timesheet' }, columns: [], rows: [] });
      }),
    );
    const result = await runReportApi('w1', 'timesheet', { preset: 'last_week', group_by: ['user', 'project'] });
    expect(seen?.searchParams.get('preset')).toBe('last_week');
    expect(seen?.searchParams.getAll('group_by')).toEqual(['user', 'project']);
    expect(result.meta.title).toBe('Timesheet');
  });

  it('passes a 413 through with its hint', async () => {
    server.use(
      http.get('*/workspaces/w1/reports/time_entries', () =>
        HttpResponse.json({ status: 'error', status_code: 413, message: 'Too many rows', data: { hint: 'export' } }, { status: 413 }),
      ),
    );
    const error = await runReportApi('w1', 'time_entries', {}).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(413);
  });
});

describe('exporting', () => {
  it('reads a small export as the file itself', async () => {
    server.use(
      http.post('*/workspaces/w1/reports/timesheet/export', () =>
        new HttpResponse('a,b\n1,2\n', {
          status: 200,
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': 'attachment; filename="timesheet-2026-10-05.csv"',
            'X-Report-Rows': '1',
          },
        }),
      ),
    );
    const outcome = await exportReportApi('w1', 'timesheet', { params: {}, format: 'csv' });
    expect(outcome.kind).toBe('file');
    if (outcome.kind !== 'file') return;
    expect(outcome.fileName).toBe('timesheet-2026-10-05.csv');
    expect(outcome.rows).toBe(1);
    expect(outcome.blob.size).toBe(8);
  });

  it('reads a large export as a job', async () => {
    server.use(http.post('*/workspaces/w1/reports/timesheet/export', () => ok(job(), 202)));
    const outcome = await exportReportApi('w1', 'timesheet', { params: {}, format: 'xlsx', background: true });
    expect(outcome).toEqual({ kind: 'job', job: job() });
  });

  it('polls a job until it settles, then downloads it', async () => {
    const answers = [job({ status: 'running' }), job({ status: 'done', download_path: '/workspaces/w1/report-jobs/j1/download?token=t' })];
    server.use(
      http.get('*/workspaces/w1/report-jobs/j1', () => ok(answers.shift())),
      http.get('*/workspaces/w1/report-jobs/j1/download', ({ request }) => {
        expect(new URL(request.url).searchParams.get('token')).toBe('t');
        return new HttpResponse('pdf', {
          headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="r.pdf"' },
        });
      }),
    );
    const updates: string[] = [];
    const done = await waitForReportJobApi('w1', job(), { intervalMs: 1, onUpdate: (j) => updates.push(j.status) });
    expect(updates).toEqual(['running', 'done']);
    expect(isFinishedJob(done)).toBe(true);
    const file = await downloadReportJobApi(done);
    expect(file.fileName).toBe('r.pdf');
  });

  it('stops polling when told to', async () => {
    const controller = new AbortController();
    const waiting = waitForReportJobApi('w1', job(), { intervalMs: 10_000, signal: controller.signal });
    controller.abort();
    await expect(waiting).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('refuses to download a job without a file', async () => {
    await expect(downloadReportJobApi(job({ status: 'failed' }))).rejects.toThrow('no file');
  });
});

describe('sprints', () => {
  it('removes issues with a DELETE that carries the ids', async () => {
    let sent: unknown;
    server.use(
      http.delete('*/workspaces/w1/sprints/s1/issues', async ({ request }) => {
        sent = await request.json();
        return ok({ sprint_id: 's1', issue_ids: ['i1'] });
      }),
    );
    await removeSprintIssuesApi('w1', 's1', ['i1']);
    expect(sent).toEqual({ issue_ids: ['i1'] });
  });
});

describe('the rest of the sprint calls', () => {
  it('renames and deletes a sprint', async () => {
    const seen: string[] = [];
    server.use(
      http.patch('*/workspaces/w1/sprints/s1', async ({ request }) => {
        seen.push(JSON.stringify(await request.json()));
        return ok({ id: 's1', name: 'Renamed' });
      }),
      http.delete('*/workspaces/w1/sprints/s1', () => {
        seen.push('delete');
        return ok(null);
      }),
    );
    expect((await updateSprintApi('w1', 's1', { name: 'Renamed' })).name).toBe('Renamed');
    await deleteSprintApi('w1', 's1');
    expect(seen).toEqual(['{"name":"Renamed"}', 'delete']);
  });
});
