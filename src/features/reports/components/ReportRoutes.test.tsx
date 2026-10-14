import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { Route, Routes, useLocation } from 'react-router-dom';
import { renderWithProviders, screen, userEvent, waitFor } from '@/test/renderWithProviders';
import { server } from '@/test/msw/server';
import { makeReportJob } from '@/test/fixtures';
import { ReportJobPage, SavedReportRoute } from './ReportRoutes';

/** A saved report's link opens the report with its parameters; an export's page follows the job. */

const ok = (data: unknown) => HttpResponse.json({ status: 'success', status_code: 200, message: 'ok', data });

const Where = () => {
  const location = useLocation();
  return <output data-testid="where">{location.pathname + location.search}</output>;
};

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

describe('<SavedReportRoute>', () => {
  it('opens the report with the saved parameters', async () => {
    server.use(
      http.get('*/workspaces/w1/saved-reports/r1', () =>
        ok({ id: 'r1', name: 'Weekly hours', report_type: 'time_by_group', params: { preset: 'last_week', group_by: ['user', 'project'] } }),
      ),
    );
    renderWithProviders(
      <Routes>
        <Route path="/reports/saved/:id" element={<SavedReportRoute />} />
        <Route path="/reports/:type" element={<Where />} />
      </Routes>,
      { route: '/reports/saved/r1?workspace=w1' },
    );
    const where = await screen.findByTestId('where');
    expect(where.textContent).toContain('/reports/time_by_group?');
    expect(where.textContent).toContain('preset=last_week');
    expect(where.textContent).toContain('group_by=user&group_by=project');
    expect(where.textContent).toContain('saved=r1');
  });

  it('says so when the saved report is gone', async () => {
    server.use(
      http.get('*/workspaces/w1/saved-reports/r9', () =>
        HttpResponse.json({ status: 'error', status_code: 404, message: 'Saved report not found.', data: null }, { status: 404 }),
      ),
    );
    renderWithProviders(
      <Routes>
        <Route path="/reports/saved/:id" element={<SavedReportRoute />} />
      </Routes>,
      { route: '/reports/saved/r9?workspace=w1' },
    );
    expect(await screen.findByText('Saved report not found.')).toBeInTheDocument();
  });
});

describe('<ReportJobPage>', () => {
  it('follows a running job and downloads the file', async () => {
    let calls = 0;
    server.use(
      http.get('*/workspaces/w1/report-jobs/j1', () => {
        calls += 1;
        return ok(
          calls === 1
            ? makeReportJob({ status: 'running' })
            : makeReportJob({ status: 'done', file_name: 'time.xlsx', row_count: 12, download_path: '/workspaces/w1/report-jobs/j1/download?token=t' }),
        );
      }),
      http.get('*/workspaces/w1/report-jobs/j1/download', () =>
        new HttpResponse('x', { headers: { 'Content-Type': 'application/octet-stream', 'Content-Disposition': 'attachment; filename="time.xlsx"' } }),
      ),
    );
    renderWithProviders(
      <Routes>
        <Route path="/reports/jobs/:id" element={<ReportJobPage />} />
      </Routes>,
      { route: '/reports/jobs/j1?workspace=w1' },
    );
    expect(await screen.findByTestId('job-status')).toHaveTextContent('running');
    await waitFor(() => expect(screen.getByTestId('job-status')).toHaveTextContent('done'), { timeout: 4000 });
    expect(screen.getByRole('heading', { name: 'Time by group export' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Download time.xlsx/ }));
    await waitFor(() => expect(clicked).toEqual(['time.xlsx']));
  });
});
