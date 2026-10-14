import { describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { toast } from 'sonner';
import { renderWithProviders, screen, userEvent, waitFor, within } from '@/test/renderWithProviders';
import { server } from '@/test/msw/server';
import {
  loggedInState,
  makeIssueDetail,
  makeIssueTime,
  makeTimeEntry,
  makeTimer,
  makeTimeSettings,
  STATUSES,
} from '@/test/fixtures';
import type { IssueTimeTracking } from '@/types';
import IssueDrawer from './IssueDrawer';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() } }));

/**
 * The drawer's time section: the issue's time and who logged it, and the forms that add to it.
 *
 * What is pinned beyond rendering: a duration is parsed before anything is sent and a bad one
 * is explained instead; an edit sends only what changed; a delete asks first; a guest is
 * offered nothing the API would refuse; and a failing time service stays inside its section
 * without raising an alert over the issue.
 */

const ok = (data: unknown, status = 200) =>
  HttpResponse.json({ status: 'success', status_code: status, message: 'ok', data }, { status });
const refuse = (status: number, message: string) =>
  HttpResponse.json({ status: 'error', status_code: status, message, data: null }, { status });

const onCardChanged = vi.fn();

const render = ({ canWrite = true, time }: { canWrite?: boolean; time?: Partial<IssueTimeTracking> } = {}) => {
  if (time) server.use(http.get('*/workspaces/w1/issues/i1/time-tracking', () => ok(makeIssueTime(time))));
  return renderWithProviders(
    <IssueDrawer
      workspaceId="w1"
      issueId="i1"
      statuses={STATUSES}
      canWrite={canWrite}
      onOpenIssue={vi.fn()}
      onCardChanged={onCardChanged}
      onClose={vi.fn()}
    />,
    { preloadedState: loggedInState() },
  );
};

/** The loaded section. Its loading state is a different element, so wait for the work log. */
const section = async () => {
  await screen.findByText(/^Work log \(/);
  return screen.getByRole('heading', { name: 'Time tracking' }).closest('section') as HTMLElement;
};

describe('<TimeTrackingPanel> reading', () => {
  it('shows logged, estimate, remaining, who logged it, and the work log as text', async () => {
    render({
      time: {
        entries: [makeTimeEntry({ note: '<b>not bold</b>' })],
      },
    });
    const panel = await section();
    const value = (term: string) => within(panel).getByText(term, { selector: 'dt' }).nextElementSibling;
    expect(value('Logged')).toHaveTextContent('1h 30m');
    expect(value('Estimate')).toHaveTextContent('4h');
    expect(value('Remaining')).toHaveTextContent('2h 30m');
    expect(within(panel).getByRole('progressbar')).toHaveAttribute('aria-valuetext', '1h 30m of 4h');
    expect(within(panel).getByRole('heading', { name: 'By person' })).toBeInTheDocument();
    expect(within(panel).getByText('<b>not bold</b>')).toBeInTheDocument();
    // The board's card learns the issue's total from the panel's read.
    expect(onCardChanged).toHaveBeenCalledWith('i1', { time_spent_seconds: 5400 });
  });

  it('says when the time is over the estimate and what sub-issues add', async () => {
    render({
      time: {
        summary: {
          ...makeIssueTime().summary,
          spent_seconds: 18_000,
          rollup_spent_seconds: 30_000,
          estimate_seconds: 14_400,
          rollup_estimate_seconds: 28_800,
          remaining_seconds: 0,
        },
      },
    });
    const panel = await section();
    expect(within(panel).getByText('Over the estimate by 1h.')).toBeInTheDocument();
    expect(within(panel).getByText(/With sub-issues: 8h 20m logged of 8h estimated/)).toBeInTheDocument();
  });

  it('offers a guest nothing to do, because the API would refuse it', async () => {
    render({ canWrite: false, time: { can_log: false, can_log_for_others: false, entries: [makeTimeEntry({ can_edit: false })] } });
    const panel = await section();
    expect(within(panel).queryByRole('button', { name: 'Log time' })).toBeNull();
    expect(within(panel).queryByRole('button', { name: /Start timer/ })).toBeNull();
    expect(within(panel).queryByRole('button', { name: 'Edit estimate' })).toBeNull();
    expect(within(panel).queryByRole('button', { name: /^Delete / })).toBeNull();
  });

  it('keeps a failure inside the section, with a retry and no alert over the issue', async () => {
    let calls = 0;
    server.use(
      http.get('*/workspaces/w1/issues/i1/time-tracking', () => {
        calls += 1;
        return calls === 1 ? refuse(500, 'The time service is down.') : ok(makeIssueTime());
      }),
    );
    render();
    expect(await screen.findByText(/Time tracking could not be loaded. The time service is down./)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Work log (1)')).toBeInTheDocument();
  });

  it('says plainly when tracking is switched off, and offers no logging', async () => {
    render({ time: { settings: makeTimeSettings({ enabled: false }), can_log: false, can_log_for_others: false } });
    const panel = await section();
    expect(within(panel).getByText(/switched off in this workspace/)).toBeInTheDocument();
    expect(within(panel).queryByRole('button', { name: 'Log time' })).toBeNull();
    // Logged time can still be deleted, but not edited into new time.
    expect(within(panel).queryByRole('button', { name: /^Edit 1h 30m/ })).toBeNull();
    expect(within(panel).getByRole('button', { name: /^Delete 1h 30m/ })).toBeInTheDocument();
  });
});

describe('<TimeTrackingPanel> logging and editing', () => {
  it('parses the duration and posts exactly what was entered', async () => {
    let sent: Record<string, unknown> | undefined;
    server.use(
      http.post('*/workspaces/w1/issues/i1/time-entries', async ({ request }) => {
        sent = (await request.json()) as Record<string, unknown>;
        return ok(makeTimeEntry({ id: 't-new', duration_seconds: 9000 }), 201);
      }),
    );
    render({ time: { can_log_for_others: false } });
    const panel = await section();
    const user = userEvent.setup();
    await user.click(within(panel).getByRole('button', { name: 'Log time' }));
    const form = within(panel).getByRole('form', { name: 'Log time' });
    await user.type(within(form).getByLabelText('Time spent'), '2h 30m');
    expect(within(form).getByText('= 2h 30m')).toBeInTheDocument();
    await user.clear(within(form).getByLabelText('Day'));
    await user.type(within(form).getByLabelText('Day'), '2026-10-01');
    await user.type(within(form).getByLabelText('What was done (optional)'), '  Paired on the fix  ');
    await user.click(within(form).getByRole('button', { name: 'Log time' }));

    await waitFor(() => expect(sent).toEqual({ duration_seconds: 9000, work_date: '2026-10-01', note: 'Paired on the fix' }));
    expect(toast.success).toHaveBeenCalledWith('Logged 2h 30m.');
  });

  it('sends a start time with its offset, and logs for someone else only when chosen', async () => {
    let sent: Record<string, unknown> | undefined;
    server.use(
      http.post('*/workspaces/w1/issues/i1/time-entries', async ({ request }) => {
        sent = (await request.json()) as Record<string, unknown>;
        return ok(makeTimeEntry(), 201);
      }),
    );
    render();
    const panel = await section();
    const user = userEvent.setup();
    await user.click(within(panel).getByRole('button', { name: 'Log time' }));
    const form = within(panel).getByRole('form', { name: 'Log time' });
    await user.type(within(form).getByLabelText('Time spent'), '45m');
    await user.type(within(form).getByLabelText('Started at (optional)'), '09:30');
    await user.click(await within(form).findByRole('combobox', { name: 'Whose time' }));
    await user.click(await screen.findByRole('option', { name: 'Grace Hopper' }));
    await user.click(within(form).getByRole('button', { name: 'Log time' }));

    await waitFor(() => expect(sent).toBeDefined());
    expect(sent).toMatchObject({ duration_seconds: 2700, user_id: 'u2' });
    expect(sent?.started_at).toMatch(/Z$/);
  });

  it('explains a duration it cannot read and sends nothing', async () => {
    const posted = vi.fn();
    server.use(
      http.post('*/workspaces/w1/issues/i1/time-entries', () => {
        posted();
        return ok(makeTimeEntry(), 201);
      }),
    );
    render();
    const panel = await section();
    const user = userEvent.setup();
    await user.click(within(panel).getByRole('button', { name: 'Log time' }));
    const form = within(panel).getByRole('form', { name: 'Log time' });
    const input = within(form).getByLabelText('Time spent');
    await user.type(input, '2 and a bit');
    await user.click(within(form).getByRole('button', { name: 'Log time' }));
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(within(form).getByText(/Use h and m/)).toBeInTheDocument();
    expect(posted).not.toHaveBeenCalled();
    await user.click(within(form).getByRole('button', { name: 'Cancel' }));
    expect(within(panel).queryByRole('form', { name: 'Log time' })).toBeNull();
  });

  it('shows the refusal inside the form when the API says no', async () => {
    server.use(http.post('*/workspaces/w1/issues/i1/time-entries', () => refuse(422, 'That day has not started anywhere yet.')));
    render();
    const panel = await section();
    const user = userEvent.setup();
    await user.click(within(panel).getByRole('button', { name: 'Log time' }));
    const form = within(panel).getByRole('form', { name: 'Log time' });
    await user.type(within(form).getByLabelText('Time spent'), '1h');
    await user.click(within(form).getByRole('button', { name: 'Log time' }));
    expect(await within(form).findByText('That day has not started anywhere yet.')).toBeInTheDocument();
  });

  it('sends only the fields an edit changed', async () => {
    let sent: unknown;
    server.use(
      http.patch('*/workspaces/w1/time-entries/t1', async ({ request }) => {
        sent = await request.json();
        return ok(makeTimeEntry({ duration_seconds: 3600 }));
      }),
    );
    render();
    const panel = await section();
    const user = userEvent.setup();
    await user.click(within(panel).getByRole('button', { name: /^Edit 1h 30m on/ }));
    const form = within(panel).getByRole('form', { name: 'Edit time entry' });
    const input = within(form).getByLabelText('Time spent');
    expect(input).toHaveValue('1h 30m');
    await user.clear(input);
    await user.type(input, '1h');
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(sent).toEqual({ duration_seconds: 3600 }));
  });

  it('asks before deleting, then deletes', async () => {
    const deleted = vi.fn();
    server.use(
      http.delete('*/workspaces/w1/time-entries/t1', () => {
        deleted();
        return ok({ id: 't1' });
      }),
    );
    render();
    const panel = await section();
    const user = userEvent.setup();
    await user.click(within(panel).getByRole('button', { name: /^Delete 1h 30m on/ }));
    const confirm = await screen.findByRole('dialog', { name: 'Delete this time?' });
    expect(deleted).not.toHaveBeenCalled();
    await user.click(within(confirm).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(deleted).toHaveBeenCalledTimes(1));
  });
});

describe('<TimeTrackingPanel> estimate and timer', () => {
  it('saves the estimate with the version it read, and explains a 409', async () => {
    let sent: unknown;
    server.use(
      http.patch('*/workspaces/w1/issues/i1', async ({ request }) => {
        sent = await request.json();
        return ok(makeIssueDetail({ time_estimate_seconds: 21_600, version: 2 }));
      }),
    );
    render();
    const panel = await section();
    const user = userEvent.setup();
    await user.click(within(panel).getByRole('button', { name: 'Edit estimate' }));
    await user.type(within(panel).getByLabelText('Estimate'), '6h');
    await user.click(within(panel).getByRole('button', { name: 'Save estimate' }));
    await waitFor(() => expect(sent).toEqual({ version: 1, time_estimate_seconds: 21_600 }));
    expect(onCardChanged).toHaveBeenCalledWith('i1', { time_estimate_seconds: 21_600, version: 2 });

    server.use(http.patch('*/workspaces/w1/issues/i1', () => refuse(409, 'stale')));
    await user.click(await within(panel).findByRole('button', { name: 'Edit estimate' }));
    await user.click(within(panel).getByRole('button', { name: 'Save estimate' }));
    expect(await within(panel).findByText(/Someone else changed this issue/)).toBeInTheDocument();
  });

  it('starts the timer here, and says what it saved from the one it replaced', async () => {
    server.use(
      http.post('*/workspaces/w1/issues/i1/timer', () =>
        ok(
          {
            timer: makeTimer(),
            stopped_entry: makeTimeEntry({
              duration_seconds: 600,
              issue: { id: 'i2', workspace_id: 'w1', list_id: 'l1', key: 'PAY-2', title: 'Other' },
            }),
          },
          201,
        ),
      ),
    );
    render();
    const panel = await section();
    await userEvent.click(within(panel).getByRole('button', { name: 'Start timer on PAY-1' }));
    expect(await within(panel).findByRole('button', { name: 'Stop timer on PAY-1' })).toBeInTheDocument();
    expect(toast.success).toHaveBeenCalledWith('Saved 10m on PAY-2; the timer moved to PAY-1.');
  });

  it('stops the timer running here and says what was logged', async () => {
    server.use(
      http.get('*/timer', () => ok(makeTimer())),
      http.post('*/workspaces/w1/issues/i1/timer', () => ok({ timer: makeTimer(), stopped_entry: null }, 201)),
      http.post('*/timer/stop', () => ok({ entry: makeTimeEntry({ duration_seconds: 125, source: 'timer' }), capped: false })),
    );
    render();
    const panel = await section();
    await userEvent.click(within(panel).getByRole('button', { name: 'Start timer on PAY-1' }));
    await userEvent.click(await within(panel).findByRole('button', { name: 'Stop timer on PAY-1' }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Logged 2m on PAY-1.'));
  });

  it('reports a timer that would not start', async () => {
    server.use(http.post('*/workspaces/w1/issues/i1/timer', () => refuse(422, 'Time tracking is switched off in this workspace.')));
    render();
    const panel = await section();
    await userEvent.click(within(panel).getByRole('button', { name: 'Start timer on PAY-1' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Time tracking is switched off in this workspace.'));
  });
});
