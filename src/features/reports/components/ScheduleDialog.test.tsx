import { describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { renderWithProviders, screen, userEvent, waitFor, within } from '@/test/renderWithProviders';
import { server } from '@/test/msw/server';
import type { ReportSchedule, SavedReport } from '@/types/reports';
import { ScheduleDialog } from './ScheduleDialog';

/** Schedules of a saved report: list, add, pause, send now, delete. */

const ok = (data: unknown, status = 200) =>
  HttpResponse.json({ status: 'success', status_code: status, message: 'ok', data }, { status });

const saved: SavedReport = {
  id: 'r1',
  name: 'Weekly hours',
  report_type: 'time_by_group',
  params: {},
  visibility: 'workspace',
  pinned: false,
  owner_id: 'u1',
  owner_name: 'Ada Lovelace',
  can_edit: true,
  schedule_count: 0,
  created_at: '2026-10-05T10:00:00',
  updated_at: '2026-10-05T10:00:00',
};

const schedule = (overrides: Partial<ReportSchedule> = {}): ReportSchedule => ({
  id: 'sc1',
  saved_report_id: 'r1',
  cadence: 'weekly',
  weekday: 0,
  day_of_month: null,
  hour_local: 9,
  timezone: 'UTC',
  format: 'pdf',
  recipients: [{ id: 'u1', name: 'Ada Lovelace' }],
  enabled: true,
  next_run_at: '2026-10-12T09:00:00',
  last_run_at: null,
  created_by: 'u1',
  created_at: '2026-10-05T10:00:00',
  ...overrides,
});

const members = [
  { user_id: 'u1', email: 'ada@example.com', first_name: 'Ada', last_name: 'Lovelace', role: 'owner' as const },
  { user_id: 'u2', email: 'grace@example.com', first_name: 'Grace', last_name: 'Hopper', role: 'member' as const },
];

const render = () =>
  renderWithProviders(
    <ScheduleDialog
      open
      onOpenChange={vi.fn()}
      workspaceId="w1"
      saved={saved}
      members={members}
      timezone="UTC"
      formats={['csv', 'xlsx', 'pdf']}
      currentUserId="u1"
    />,
  );

describe('<ScheduleDialog>', () => {
  it('adds a weekly schedule for the chosen recipients', async () => {
    let list: ReportSchedule[] = [];
    let sent: unknown;
    server.use(
      http.get('*/workspaces/w1/saved-reports/r1/schedules', () => ok(list)),
      http.post('*/workspaces/w1/saved-reports/r1/schedules', async ({ request }) => {
        sent = await request.json();
        list = [schedule({ recipients: [{ id: 'u1', name: 'Ada Lovelace' }, { id: 'u2', name: 'Grace Hopper' }] })];
        return ok(list[0], 201);
      }),
    );
    render();
    expect(await screen.findByText('No schedules yet.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Grace Hopper' }));
    await userEvent.click(screen.getByRole('button', { name: 'Add schedule' }));
    await waitFor(() =>
      expect(sent).toEqual({ cadence: 'weekly', weekday: 0, day_of_month: null, hour_local: 9, timezone: 'UTC', format: 'pdf', recipients: ['u1', 'u2'] }),
    );
    const row = await screen.findByTestId('schedule-row');
    expect(row).toHaveTextContent('Mondays at 09:00 UTC');
    expect(row).toHaveTextContent('Ada Lovelace, Grace Hopper');
  });

  it('refuses a schedule with nobody to send it to', async () => {
    server.use(http.get('*/workspaces/w1/saved-reports/r1/schedules', () => ok([])));
    render();
    await screen.findByText('No schedules yet.');
    await userEvent.click(screen.getByRole('checkbox', { name: 'Ada Lovelace' }));
    await userEvent.click(screen.getByRole('button', { name: 'Add schedule' }));
    expect(screen.getByText('Choose at least one recipient.')).toBeInTheDocument();
  });

  it('pauses, sends now and deletes a schedule', async () => {
    let list = [schedule()];
    const calls: string[] = [];
    server.use(
      http.get('*/workspaces/w1/saved-reports/r1/schedules', () => ok(list)),
      http.patch('*/workspaces/w1/saved-reports/r1/schedules/sc1', async ({ request }) => {
        const body = (await request.json()) as { enabled: boolean };
        calls.push(`patch:${body.enabled}`);
        list = [schedule(body)];
        return ok(list[0]);
      }),
      http.post('*/workspaces/w1/saved-reports/r1/schedules/sc1/run', () => {
        calls.push('run');
        return ok({ job_ids: ['j1'] }, 202);
      }),
      http.delete('*/workspaces/w1/saved-reports/r1/schedules/sc1', () => {
        calls.push('delete');
        list = [];
        return ok(null);
      }),
    );
    render();
    const row = await screen.findByTestId('schedule-row');
    await userEvent.click(within(row).getByRole('switch', { name: 'Pause schedule' }));
    expect(await screen.findByText('Paused')).toBeInTheDocument();
    await userEvent.click(within(screen.getByTestId('schedule-row')).getByRole('button', { name: /Run now/ }));
    await waitFor(() => expect(calls).toContain('run'));
    await waitFor(() => expect(within(screen.getByTestId('schedule-row')).getByRole('button', { name: 'Delete schedule' })).toBeEnabled());
    await userEvent.click(within(screen.getByTestId('schedule-row')).getByRole('button', { name: 'Delete schedule' }));
    expect(await screen.findByText('No schedules yet.')).toBeInTheDocument();
    expect(calls).toEqual(['patch:false', 'run', 'delete']);
  });
});
