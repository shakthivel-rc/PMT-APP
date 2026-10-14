import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { renderWithProviders, screen, userEvent, waitFor } from '@/test/renderWithProviders';
import { server } from '@/test/msw/server';
import { makeReportJob } from '@/test/fixtures';
import { ExportDialog } from './ExportDialog';

/**
 * Export: a small report downloads straight away; a large one is a job the dialog follows
 * until the file is ready, then downloads; a failed job says so.
 */

const ok = (data: unknown, status = 200) =>
  HttpResponse.json({ status: 'success', status_code: status, message: 'ok', data }, { status });

const csv = () =>
  new HttpResponse('a\n1\n', {
    headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="report.csv"' },
  });

let clicked: string[];
beforeEach(() => {
  clicked = [];
  URL.createObjectURL = vi.fn(() => 'blob:x');
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    clicked.push(this.download);
  });
});
afterEach(() => vi.restoreAllMocks());

const render = (onOpenChange = vi.fn()) => {
  renderWithProviders(
    <ExportDialog
      open
      onOpenChange={onOpenChange}
      workspaceId="w1"
      reportType="time_by_group"
      title="Time by group"
      params={{ preset: 'this_week', group_by: ['user'] }}
      formats={['csv', 'xlsx', 'pdf']}
      pollMs={5}
    />,
  );
  return onOpenChange;
};

describe('<ExportDialog>', () => {
  it('downloads a small export at once, sending the filters and options', async () => {
    let sent: unknown;
    server.use(
      http.post('*/workspaces/w1/reports/time_by_group/export', async ({ request }) => {
        sent = await request.json();
        return csv();
      }),
    );
    const onOpenChange = render();
    await userEvent.click(screen.getByRole('button', { name: 'Export' }));
    await waitFor(() => expect(clicked).toEqual(['report.csv']));
    expect(sent).toEqual({
      params: { preset: 'this_week', group_by: ['user'] },
      format: 'csv',
      duration_format: 'decimal',
      date_format: 'iso',
      background: false,
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('follows a background job to its file', async () => {
    const answers = [makeReportJob({ status: 'running' }), makeReportJob({ status: 'done', download_path: '/workspaces/w1/report-jobs/j1/download?token=t' })];
    let background: unknown;
    server.use(
      http.post('*/workspaces/w1/reports/time_by_group/export', async ({ request }) => {
        background = ((await request.json()) as { background: boolean }).background;
        return ok(makeReportJob(), 202);
      }),
      http.get('*/workspaces/w1/report-jobs/j1', () => ok(answers.shift() ?? makeReportJob({ status: 'done' }))),
      http.get('*/workspaces/w1/report-jobs/j1/download', () => csv()),
    );
    render();
    await userEvent.click(screen.getByRole('switch', { name: /Prepare in the background/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Export' }));
    await waitFor(() => expect(clicked).toEqual(['report.csv']));
    expect(background).toBe(true);
  });

  it('says when the job fails', async () => {
    server.use(
      http.post('*/workspaces/w1/reports/time_by_group/export', () => ok(makeReportJob(), 202)),
      http.get('*/workspaces/w1/report-jobs/j1', () => ok(makeReportJob({ status: 'failed', error: 'The worker fell over.' }))),
    );
    render();
    await userEvent.click(screen.getByRole('button', { name: 'Export' }));
    expect(await screen.findByText('The worker fell over.')).toBeInTheDocument();
    expect(screen.getByTestId('export-job-status')).toHaveTextContent('The export failed.');
    expect(clicked).toEqual([]);
  });

  it('tells a role that cannot export', () => {
    renderWithProviders(
      <ExportDialog open onOpenChange={vi.fn()} workspaceId="w1" reportType="t" title="T" params={{}} formats={[]} />,
    );
    expect(screen.getByText(/cannot export reports/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Export' })).toBeNull();
  });
});
