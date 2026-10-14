import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { renderWithProviders, screen, userEvent, waitFor, within } from '@/test/renderWithProviders';
import { server } from '@/test/msw/server';
import { makeIssueCard, makeReportCatalog } from '@/test/fixtures';
import type { SprintSummary } from '@/types/sprints';
import { SprintPanel, sprintReportHref } from './SprintPanel';

/**
 * A project's sprints: plan one, fill it from the list, start it, close it with its unfinished
 * work carried over — and open its reports. A role that may not manage sprints only reads.
 */

const ok = (data: unknown, status = 200) =>
  HttpResponse.json({ status: 'success', status_code: status, message: 'ok', data }, { status });

const sprint = (overrides: Partial<SprintSummary> = {}): SprintSummary => ({
  id: 'sp1',
  space_id: 's1',
  name: 'Sprint 1',
  goal: 'Ship refunds',
  state: 'planned',
  starts_on: '2026-10-05',
  ends_on: '2026-10-16',
  committed_points: null,
  completed_points: null,
  started_at: null,
  closed_at: null,
  created_at: '2026-10-01T10:00:00',
  issue_count: 0,
  points: 0,
  done_issue_count: 0,
  done_points: 0,
  canceled_issue_count: 0,
  ...overrides,
});

const render = () =>
  renderWithProviders(
    <SprintPanel workspaceId="w1" spaceId="s1" candidates={[makeIssueCard({ id: 'i1', key: 'PAY-1', title: 'Refund to original card' })]} />,
  );

describe('<SprintPanel>', () => {
  it('plans a sprint', async () => {
    let sent: unknown;
    let list: SprintSummary[] = [];
    server.use(
      http.get('*/workspaces/w1/spaces/s1/sprints', () => ok(list)),
      http.post('*/workspaces/w1/spaces/s1/sprints', async ({ request }) => {
        sent = await request.json();
        list = [sprint()];
        return ok(list[0], 201);
      }),
    );
    render();
    expect(await screen.findByText('No sprints in this project yet.')).toBeInTheDocument();
    await userEvent.click(await screen.findByRole('button', { name: 'Plan a sprint' }));
    const form = screen.getByRole('form', { name: 'Plan a sprint' });
    await userEvent.type(within(form).getByLabelText('Name'), 'Sprint 1');
    await userEvent.type(within(form).getByLabelText('Goal'), 'Ship refunds');
    await userEvent.click(within(form).getByRole('button', { name: 'Plan sprint' }));
    expect(await screen.findByRole('article', { name: 'Sprint 1' })).toBeInTheDocument();
    expect(sent).toMatchObject({ name: 'Sprint 1', goal: 'Ship refunds' });
  });

  it('adds issues from the list and starts the sprint', async () => {
    let added: unknown;
    let started = false;
    let issues: unknown[] = [];
    server.use(
      http.get('*/workspaces/w1/spaces/s1/sprints', () => ok([sprint(started ? { state: 'active' } : {})])),
      http.get('*/workspaces/w1/sprints/sp1/issues', () => ok(issues)),
      http.post('*/workspaces/w1/sprints/sp1/issues', async ({ request }) => {
        added = await request.json();
        issues = [makeIssueCard({ id: 'i1', key: 'PAY-1', title: 'Refund to original card' })];
        return ok({ sprint: sprint(), changed: ['i1'] });
      }),
      http.post('*/workspaces/w1/sprints/sp1/start', () => {
        started = true;
        return ok(sprint({ state: 'active' }));
      }),
    );
    render();
    await userEvent.click(await screen.findByRole('button', { name: 'Show issues of Sprint 1' }));
    await userEvent.click(await screen.findByRole('checkbox', { name: /PAY-1/ }));
    await userEvent.click(screen.getByRole('button', { name: /Add 1 to sprint/ }));
    await waitFor(() => expect(added).toEqual({ issue_ids: ['i1'] }));
    expect(await screen.findByRole('list', { name: 'Issues in Sprint 1' })).toHaveTextContent('PAY-1');

    await userEvent.click(screen.getByRole('button', { name: 'Start' }));
    await waitFor(() => expect(started).toBe(true));
    expect(await screen.findByRole('button', { name: 'Close' })).toBeInTheDocument();
    const article = screen.getByRole('article', { name: 'Sprint 1' });
    expect(within(article).getByRole('link', { name: /Burndown/ })).toHaveAttribute(
      'href',
      sprintReportHref('w1', sprint({ state: 'active' }), 'burndown'),
    );
  });

  it('closes a sprint, carrying unfinished work to the backlog', async () => {
    let body: unknown;
    server.use(
      http.get('*/workspaces/w1/spaces/s1/sprints', () => ok([sprint({ state: body ? 'closed' : 'active' })])),
      http.post('*/workspaces/w1/sprints/sp1/close', async ({ request }) => {
        body = await request.json();
        return ok({ sprint: sprint({ state: 'closed' }), completed_issues: 1, carried_over: 1, completed_points: 3 });
      }),
    );
    render();
    await userEvent.click(await screen.findByRole('button', { name: 'Close' }));
    await userEvent.click(within(screen.getByRole('group', { name: 'Close Sprint 1' })).getByRole('button', { name: 'Close sprint' }));
    await waitFor(() => expect(body).toEqual({ carry_over: 'backlog' }));
    expect(await screen.findByRole('link', { name: 'Velocity of this project' })).toBeInTheDocument();
  });

  it('only reads for a role that may not manage sprints', async () => {
    server.use(
      http.get('*/workspaces/w1/reports/catalog', () => ok(makeReportCatalog({ can_manage_sprints: false }))),
      http.get('*/workspaces/w1/spaces/s1/sprints', () => ok([sprint({ state: 'active' })])),
    );
    render();
    expect(await screen.findByRole('article', { name: 'Sprint 1' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Sprint report/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Plan a sprint' })).toBeNull();
  });

  it('renders progress metrics, goal banner, and switches to Activity & Timeline tab', async () => {
    server.use(
      http.get('*/workspaces/w1/spaces/s1/sprints', () =>
        ok([
          sprint({
            state: 'active',
            points: 10,
            done_points: 6,
            issue_count: 5,
            done_issue_count: 3,
            goal: 'Deliver high-priority refunds feature',
          }),
        ]),
      ),
      http.get('*/workspaces/w1/sprints/sp1/issues', () => ok([])),
    );
    render();

    expect(await screen.findByRole('article', { name: 'Sprint 1' })).toBeInTheDocument();
    expect(screen.getByText(/Goal:/)).toBeInTheDocument();
    expect(screen.getByText('Deliver high-priority refunds feature')).toBeInTheDocument();
    expect(screen.getByText('Points Done')).toBeInTheDocument();
    expect(screen.getByText('Issues Done')).toBeInTheDocument();

    // Expand sprint
    await userEvent.click(screen.getByRole('button', { name: 'Show issues of Sprint 1' }));

    // Switch to Activity & Timeline tab
    const activityTab = await screen.findByRole('button', { name: /Activity & Timeline/i });
    await userEvent.click(activityTab);

    expect(await screen.findByText('Sprint Lifecycle Timeline')).toBeInTheDocument();
    expect(screen.getByText('Sprint Planned & Configured')).toBeInTheDocument();
    expect(screen.getByText('Story Points Completion')).toBeInTheDocument();
  });

  it('filters sprints by state tabs', async () => {
    server.use(
      http.get('*/workspaces/w1/spaces/s1/sprints', () =>
        ok([
          sprint({ id: 'sp-act', name: 'Sprint Active', state: 'active' }),
          sprint({ id: 'sp-plan', name: 'Sprint Planned', state: 'planned' }),
          sprint({ id: 'sp-close', name: 'Sprint Closed', state: 'closed' }),
        ]),
      ),
    );
    render();

    expect(await screen.findByRole('article', { name: 'Sprint Active' })).toBeInTheDocument();
    expect(screen.getByRole('article', { name: 'Sprint Planned' })).toBeInTheDocument();
    expect(screen.getByRole('article', { name: 'Sprint Closed' })).toBeInTheDocument();

    // Filter by Active
    await userEvent.click(screen.getByRole('button', { name: /Active \(1\)/i }));
    expect(screen.getByRole('article', { name: 'Sprint Active' })).toBeInTheDocument();
    expect(screen.queryByRole('article', { name: 'Sprint Planned' })).toBeNull();
    expect(screen.queryByRole('article', { name: 'Sprint Closed' })).toBeNull();

    // Filter by Planned
    await userEvent.click(screen.getByRole('button', { name: /Planned \(1\)/i }));
    expect(screen.queryByRole('article', { name: 'Sprint Active' })).toBeNull();
    expect(screen.getByRole('article', { name: 'Sprint Planned' })).toBeInTheDocument();
  });
});
