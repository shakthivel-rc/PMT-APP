import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { Route, Routes, useLocation } from 'react-router-dom';
import { fireEvent, renderWithProviders, screen, userEvent, waitFor, within } from '@/test/renderWithProviders';
import { server } from '@/test/msw/server';
import { makeReportResult } from '@/test/fixtures';
import ReportPage from './ReportPage';

/**
 * One page for every report. What is pinned: the URL runs the report; a filter rewrites the
 * URL (and so re-runs it); the result's figures, chart, table and notes are drawn; a report
 * too large to show points at an export; and saving keeps the report's own parameters.
 */

const ok = (data: unknown, status = 200) =>
  HttpResponse.json({ status: 'success', status_code: status, message: 'ok', data }, { status });

const Search = () => <output data-testid="search">{useLocation().search}</output>;

const render = (route: string) =>
  renderWithProviders(
    <Routes>
      <Route
        path="/reports/:type"
        element={
          <>
            <ReportPage />
            <Search />
          </>
        }
      />
    </Routes>,
    { route },
  );

function captureRuns(type = 'time_by_group') {
  const seen: URLSearchParams[] = [];
  server.use(
    http.get(`*/workspaces/w1/reports/${type}`, ({ request }) => {
      seen.push(new URL(request.url).searchParams);
      return ok(makeReportResult({ meta: { ...makeReportResult().meta, notes: ['Estimates are in points.'] } }));
    }),
  );
  return seen;
}

describe('<ReportPage>', () => {
  it('runs the report the URL names and draws it', async () => {
    const seen = captureRuns();
    render('/reports/time_by_group?workspace=w1&preset=last_week&group_by=project&unit=hours');
    expect(await screen.findByRole('table', { name: /Time by group/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Time by group' })).toBeInTheDocument();
    expect(screen.getByTestId('kpi-total')).toHaveTextContent('2h 30m');
    expect(screen.getByTestId('report-chart')).toHaveAttribute('data-kind', 'bar');
    expect(screen.getByTestId('report-meta')).toHaveTextContent('Acme');
    expect(screen.getByTestId('report-notes')).toHaveTextContent('Estimates are in points.');
    // Only this report's parameters travel: `unit` is not one of them.
    const last = seen[seen.length - 1];
    expect(last.get('preset')).toBe('last_week');
    expect(last.getAll('group_by')).toEqual(['project']);
    expect(last.get('scope')).toBe('workspace');
    expect(last.has('unit')).toBe(false);
  });

  it('writes a filter change to the URL, and runs it', async () => {
    const seen = captureRuns();
    render('/reports/time_by_group?workspace=w1&preset=last_week');
    await screen.findByRole('table', { name: /Time by group/ });
    await userEvent.click(screen.getByRole('combobox', { name: 'Dates' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Custom range' }));
    const from = screen.getByLabelText('From');
    fireEvent.change(from, { target: { value: '2026-09-01' } });
    await waitFor(() => expect(screen.getByTestId('search')).toHaveTextContent('date_from=2026-09-01'));
    expect(screen.getByTestId('search')).toHaveTextContent('preset=custom');
    expect(screen.getByTestId('search')).toHaveTextContent('workspace=w1');
    await waitFor(() => expect(seen.some((s) => s.get('date_from') === '2026-09-01')).toBe(true));
  });

  it('points a report too large for the screen at an export', async () => {
    server.use(
      http.get('*/workspaces/w1/reports/time_by_group', () =>
        HttpResponse.json(
          { status: 'error', status_code: 413, message: 'This report has 9,000 rows; export it instead.', data: { hint: 'export' } },
          { status: 413 },
        ),
      ),
    );
    render('/reports/time_by_group?workspace=w1');
    expect(await screen.findByText(/export it instead/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Export instead/ }));
    expect(await screen.findByRole('dialog', { name: 'Export report' })).toBeInTheDocument();
  });

  it('explains a sprint report with no sprint', async () => {
    server.use(
      http.get('*/workspaces/w1/reports/velocity', () =>
        HttpResponse.json({ status: 'error', status_code: 422, message: 'No sprint to report on.', data: null }, { status: 422 }),
      ),
    );
    render('/reports/velocity?workspace=w1');
    expect(await screen.findByText(/No sprint to report on/)).toBeInTheDocument();
  });

  it('saves the report with its parameters, and then offers to schedule it', async () => {
    captureRuns();
    let sent: Record<string, unknown> | undefined;
    server.use(
      http.post('*/workspaces/w1/saved-reports', async ({ request }) => {
        sent = (await request.json()) as Record<string, unknown>;
        return ok(
          {
            id: 'r1',
            name: sent.name,
            report_type: 'time_by_group',
            params: sent.params,
            visibility: 'private',
            pinned: false,
            owner_id: 'u1',
            owner_name: 'Ada Lovelace',
            can_edit: true,
            schedule_count: 0,
            created_at: '2026-10-05T10:00:00',
            updated_at: '2026-10-05T10:00:00',
          },
          201,
        );
      }),
    );
    render('/reports/time_by_group?workspace=w1&preset=last_week&group_by=user,project');
    await screen.findByRole('table', { name: /Time by group/ });
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    const dialog = await screen.findByRole('dialog', { name: 'Save report' });
    const name = within(dialog).getByLabelText('Name');
    await userEvent.clear(name);
    await userEvent.type(name, 'Weekly hours');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.getByTestId('search')).toHaveTextContent('saved=r1'));
    expect(sent).toMatchObject({
      name: 'Weekly hours',
      report_type: 'time_by_group',
      params: { scope: 'workspace', preset: 'last_week', group_by: ['user', 'project'] },
    });
    expect(await screen.findByRole('button', { name: /Schedule/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Weekly hours' })).toBeInTheDocument();
  });

  it('says so when the report does not exist', async () => {
    render('/reports/nope?workspace=w1');
    expect(await screen.findByText(/not a report|no such report|not found/i)).toBeInTheDocument();
  });
});
