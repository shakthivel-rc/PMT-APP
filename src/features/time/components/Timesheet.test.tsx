import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { Route, Routes, useLocation } from 'react-router-dom';
import { renderWithProviders, screen, userEvent, waitFor, within } from '@/test/renderWithProviders';
import { server } from '@/test/msw/server';
import { makeTimeEntry, makeTimeReport, makeTimeSettings, makeWorkspace } from '@/test/fixtures';
import Timesheet from './Timesheet';

/**
 * Time by person, per week.
 *
 * What is pinned: the grid's sums (rows, day totals, the week); the week, workspace and person
 * all live in the URL; the report asked for is the one shown; a member of a workspace that
 * keeps time private is never offered other people; and an admin can change the settings.
 */

const ok = (data: unknown) => HttpResponse.json({ status: 'success', status_code: 200, message: 'ok', data });

const Search = () => <output data-testid="search">{useLocation().search}</output>;

/** A Wednesday, so the Monday week is 28 Sep – 4 Oct 2026, where the fixture's time is. */
const render = (route = '/timesheet?week=2026-09-30') =>
  renderWithProviders(
    <Routes>
      <Route
        path="/timesheet"
        element={
          <>
            <Timesheet />
            <Search />
          </>
        }
      />
    </Routes>,
    { route },
  );

function captureReports() {
  const seen: URLSearchParams[] = [];
  server.use(
    http.get('*/workspaces/:w/time-report', ({ request }) => {
      seen.push(new URL(request.url).searchParams);
      return ok(makeTimeReport());
    }),
  );
  return seen;
}

describe('<Timesheet>', () => {
  it("draws the week's time by issue and day, with totals both ways", async () => {
    const seen = captureReports();
    render();
    const table = await screen.findByRole('table', { name: 'Timesheet' });
    const row = within(table).getByRole('row', { name: /PAY-1/ });
    expect(within(row).getAllByRole('cell').map((c) => c.textContent)).toEqual([
      'PAY-1 Refund to original card', '1h 30m', '—', '1h', '—', '—', '—', '—', '2h 30m',
    ]);
    const footer = table.querySelector('tfoot') as HTMLElement;
    expect(within(footer).getAllByRole('cell').at(-1)).toHaveTextContent('2h 30m');
    expect(within(row).getByRole('link')).toHaveAttribute('href', '/projects/w1/lists/l1?issue=i1');
    expect(Object.fromEntries(seen[0])).toEqual({ date_from: '2026-09-28', date_to: '2026-10-04', user_id: 'me' });
  });

  it('steps through weeks in the URL and asks for each week it shows', async () => {
    const seen = captureReports();
    render();
    await screen.findByRole('table', { name: 'Timesheet' });
    await userEvent.click(screen.getByRole('button', { name: 'Previous week' }));
    await waitFor(() => expect(screen.getByTestId('search')).toHaveTextContent('week=2026-09-21'));
    await waitFor(() => expect(seen.at(-1)?.get('date_from')).toBe('2026-09-21'));
    await userEvent.click(screen.getByRole('button', { name: 'Next week' }));
    await waitFor(() => expect(seen.at(-1)?.get('date_from')).toBe('2026-09-28'));
    await userEvent.click(screen.getByRole('button', { name: 'This week' }));
    await waitFor(() => expect(screen.getByTestId('search')).not.toHaveTextContent('week='));
  });

  it("lets someone who may see others pick everyone, and splits rows by person", async () => {
    const seen = captureReports();
    render();
    await screen.findByRole('table', { name: 'Timesheet' });
    await userEvent.click(screen.getByRole('combobox', { name: 'Person' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Everyone' }));
    await waitFor(() => expect(screen.getByTestId('search')).toHaveTextContent('person=everyone'));
    await waitFor(() => expect(seen.at(-1)?.has('user_id')).toBe(false));
    // By element rather than role: in jsdom Radix leaves the page aria-hidden for a moment
    // after the select closes.
    // Both the grid and the entry list gain a Person column.
    expect(await screen.findAllByText('Person', { selector: 'th' })).toHaveLength(2);
  });

  it("offers a member of a private workspace no one else's time, whatever the link says", async () => {
    const seen = captureReports();
    server.use(
      http.get('*/workspaces', () => ok([makeWorkspace({ role: 'member' })])),
      http.get('*/workspaces/:w/settings/time-tracking', () => ok(makeTimeSettings({ visibility: 'own' }))),
    );
    render('/timesheet?week=2026-09-30&person=u2');
    await screen.findByRole('table', { name: 'Timesheet' });
    expect(screen.queryByRole('combobox', { name: 'Person' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Settings' })).toBeNull();
    expect(seen.every((params) => params.get('user_id') === 'me')).toBe(true);
  });

  it('says when nothing was logged, and lists the entries with their notes', async () => {
    server.use(
      http.get('*/workspaces/:w/time-report', () => ok(makeTimeReport({ rows: [], total_seconds: 0 }))),
      http.get('*/workspaces/:w/time-entries', () =>
        ok({ records: [makeTimeEntry({ note: 'Paired with Grace', source: 'timer' })], total: 1, total_seconds: 5400 }),
      ),
    );
    render();
    expect(await screen.findByRole('heading', { name: 'Nothing logged this week' })).toBeInTheDocument();
    const entries = await screen.findByRole('table', { name: 'Time entries' });
    expect(within(entries).getByText('Paired with Grace')).toBeInTheDocument();
    expect(within(entries).getByText('Timer')).toBeInTheDocument();
  });

  it('explains an empty account with no workspace to log time in', async () => {
    server.use(http.get('*/workspaces', () => ok([])));
    render();
    expect(await screen.findByRole('heading', { name: 'No workspaces yet' })).toBeInTheDocument();
  });

  it('lets an admin change the settings, sending what the form says', async () => {
    let sent: unknown;
    server.use(
      http.patch('*/workspaces/w1/settings/time-tracking', async ({ request }) => {
        sent = await request.json();
        return ok(makeTimeSettings({ hours_per_day: 7.5 }));
      }),
    );
    render();
    await screen.findByRole('table', { name: 'Timesheet' });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    const dialog = await screen.findByRole('dialog', { name: 'Time tracking settings' });
    const hours = within(dialog).getByLabelText('Hours in a day');
    await user.clear(hours);
    await user.type(hours, '30');
    await user.click(within(dialog).getByRole('button', { name: 'Save settings' }));
    expect(within(dialog).getByText('A working day is between 1 and 24 hours.')).toBeInTheDocument();

    await user.clear(hours);
    await user.type(hours, '7.5');
    await user.click(within(dialog).getByRole('button', { name: 'Save settings' }));
    await waitFor(() =>
      expect(sent).toEqual({ enabled: true, hours_per_day: 7.5, days_per_week: 5, visibility: 'everyone', week_start: 'monday', billable_default: true }),
    );
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Time tracking settings' })).toBeNull());
  });
});
