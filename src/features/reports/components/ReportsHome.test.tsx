import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router-dom';
import { renderWithProviders, screen, userEvent, waitFor, within } from '@/test/renderWithProviders';
import { server } from '@/test/msw/server';
import { makeReportCatalog, makeReportJob } from '@/test/fixtures';
import ReportsHome from './ReportsHome';

/**
 * The Reports home: the catalogue by category, pinned reports with their figures, saved
 * reports to open, pin or delete, and recent exports to download. A project's scope carries.
 */

const ok = (data: unknown) => HttpResponse.json({ status: 'success', status_code: 200, message: 'ok', data });

const saved = (overrides: Record<string, unknown> = {}) => ({
  id: 'r1',
  name: 'Weekly hours',
  report_type: 'time_by_group',
  params: { preset: 'last_week' },
  visibility: 'workspace',
  pinned: true,
  owner_id: 'u1',
  owner_name: 'Ada Lovelace',
  can_edit: true,
  schedule_count: 1,
  created_at: '2026-10-05T10:00:00',
  updated_at: '2026-10-05T10:00:00',
  ...overrides,
});

const render = (route = '/reports?workspace=w1') =>
  renderWithProviders(
    <Routes>
      <Route path="/reports" element={<ReportsHome />} />
    </Routes>,
    { route },
  );

describe('<ReportsHome>', () => {
  it('lists the catalogue by category, carrying a project scope', async () => {
    render('/reports?workspace=w1&scope=space:s1');
    const time = await screen.findByTestId('category-time');
    const link = within(time).getByRole('link', { name: /Time by group/ });
    const href = new URL(link.getAttribute('href') as string, 'http://x');
    expect(href.pathname).toBe('/reports/time_by_group');
    expect(href.searchParams.get('scope')).toBe('space:s1');
    expect(href.searchParams.get('workspace')).toBe('w1');
    expect(within(screen.getByTestId('category-sprint')).getByRole('link', { name: /Velocity/ })).toBeInTheDocument();
  });

  it('previews a pinned report and opens it as saved', async () => {
    server.use(http.get('*/workspaces/w1/saved-reports', () => ok([saved()])));
    render();
    const pinned = await screen.findByTestId('pinned-report');
    expect(await within(pinned).findByTestId('kpi-total')).toHaveTextContent('2h 30m');
    const href = within(pinned).getByRole('link', { name: 'Weekly hours' }).getAttribute('href') as string;
    expect(href).toContain('/reports/time_by_group?');
    expect(href).toContain('saved=r1');
    expect(href).toContain('preset=last_week');
  });

  it('unpins and deletes a saved report', async () => {
    let list = [saved()];
    const patched: unknown[] = [];
    server.use(
      http.get('*/workspaces/w1/saved-reports', () => ok(list)),
      http.patch('*/workspaces/w1/saved-reports/r1', async ({ request }) => {
        const body = (await request.json()) as { pinned: boolean };
        patched.push(body);
        list = [saved(body)];
        return ok(list[0]);
      }),
      http.delete('*/workspaces/w1/saved-reports/r1', () => {
        list = [];
        return ok(null);
      }),
    );
    render();
    await userEvent.click(await screen.findByRole('button', { name: 'Unpin Weekly hours' }));
    await waitFor(() => expect(patched).toEqual([{ pinned: false }]));
    await waitFor(() => expect(screen.queryByTestId('pinned-report')).toBeNull());

    await userEvent.click(await screen.findByRole('button', { name: 'Delete Weekly hours' }));
    const confirm = await screen.findByRole('dialog', { name: /Delete “Weekly hours”/ });
    await userEvent.click(within(confirm).getByRole('button', { name: /Delete/ }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Delete Weekly hours' })).toBeNull());
  });

  it('lists recent exports', async () => {
    server.use(
      http.get('*/workspaces/w1/report-jobs', () =>
        ok([makeReportJob({ status: 'done', file_name: 'time.xlsx', download_path: '/workspaces/w1/report-jobs/j1/download?token=t' })]),
      ),
    );
    render();
    const table = await screen.findByRole('table', { name: 'Recent exports' });
    expect(await within(table).findByRole('link', { name: 'Time by group' })).toHaveAttribute('href', '/reports/jobs/j1?workspace=w1');
    expect(within(table).getByRole('button', { name: 'Download' })).toBeInTheDocument();
  });

  it('tells a guest that reports are closed to them', async () => {
    server.use(http.get('*/workspaces/w1/reports/catalog', () => ok(makeReportCatalog({ can_view: false }))));
    render();
    expect(await screen.findByText(/guest|not available|cannot/i)).toBeInTheDocument();
    expect(screen.queryByTestId('category-time')).toBeNull();
  });
});
