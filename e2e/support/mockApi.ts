import type { Page, Route } from '@playwright/test';

// The built bundle bakes in whatever VITE_API_BASE_URL resolves to, so we match API
// calls by URL *suffix* (`**/user/login`) rather than by host — this stays correct no
// matter what base URL the build used.

const envelope = (data: unknown, message = 'success') => ({
  status: 'success',
  status_code: 200,
  message,
  data,
});

const json = (route: Route, data: unknown, message?: string) =>
  route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(envelope(data, message)),
  });

export const E2E_USER = {
  id: 'u1',
  first_name: 'Ada',
  last_name: 'Lovelace',
  username: 'ada',
  email: 'ada@example.com',
  organization: 'Analytical Engines',
  department: 'R&D',
  status: true,
  roles: [{ role_id: 'r1', role_name: 'Admin' }],
  permissions: [{ permission_name: 'Manage Users', machine_name: 'manage_users' }],
};

/**
 * Register deterministic API responses for a page. Call before navigating.
 * `authenticated:false` makes `GET /users/profile` 401 so guards send the user to /login.
 */
export async function mockApi(page: Page, opts: { authenticated?: boolean } = {}) {
  const authenticated = opts.authenticated ?? true;

  await page.route('**/user/login', (route) =>
    json(route, { access_token: 'e2e-access', refresh_token: 'e2e-refresh' })
  );
  await page.route('**/user/refresh', (route) =>
    json(route, { access_token: 'e2e-access-2', refresh_token: 'e2e-refresh-2' })
  );
  await page.route('**/user/logout', (route) => json(route, {}));

  await page.route('**/users/profile', (route) => {
    if (!authenticated) {
      return route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'error', status_code: 401, message: 'Unauthorized', data: null }),
      });
    }
    return json(route, E2E_USER);
  });

  await page.route('**/users?*', (route) => json(route, { records: [] }));
  await page.route('**/users', (route) => json(route, { records: [] }));
  await page.route('**/activity-logs*', (route) => json(route, { records: [] }));

  // RBAC. Empty, but *mocked*: without these the two requests RolesAndPermissions fires on
  // mount fall through to the preview server, which answers the SPA's index.html — so the
  // screen's own error path decides how long the route takes to settle. The a11y scan waits
  // on that route's heading, and it is the one that intermittently timed out.
  await page.route('**/permissions*', (route) => json(route, { records: [], total: 0 }));
  await page.route('**/roles*', (route) => json(route, { records: [], total: 0 }));

  // Time tracking. The header asks for the running timer on every authenticated screen, so
  // without this every route's scan would race an unmocked request answered with index.html.
  // Nothing running is the world every other screen expects.
  await page.route('**/timer', (route) => json(route, null));
  // The Timesheet screen: one workspace, its settings, and a week with a little time in it.
  const issue = { id: 'i1', workspace_id: 'w1', list_id: 'l1', key: 'PAY-1', title: 'Refund to original card' };
  const user = { id: 'u1', display_name: 'Ada Lovelace' };
  await page.route('**/workspaces', (route) =>
    json(route, [{ id: 'w1', name: 'Acme Engineering', slug: 'acme-eng', role: 'owner' }])
  );
  await page.route('**/workspaces/*/settings/time-tracking', (route) =>
    json(route, { enabled: true, hours_per_day: 8, days_per_week: 5, visibility: 'everyone', week_start: 'monday' })
  );
  await page.route('**/workspaces/*/members', (route) => json(route, []));
  await page.route('**/workspaces/*/time-report?*', (route) => {
    const params = new URL(route.request().url()).searchParams;
    return json(route, {
      date_from: params.get('date_from'),
      date_to: params.get('date_to'),
      total_seconds: 5400,
      rows: [{ user, issue, work_date: params.get('date_from'), seconds: 5400 }],
      truncated: false,
    });
  });
  await page.route('**/workspaces/*/time-entries?*', (route) =>
    json(route, { records: [], total: 0, total_seconds: 0 })
  );

  // Reports (docs/design/08-reports.md in pmt-api): the catalogue, any report run (answered
  // with a small grouped time report whose dates echo the request), nothing saved or exported
  // yet, and a CSV for an export. The workspace tree feeds the scope picker.
  await page.route('**/workspaces/w1', (route) =>
    json(route, {
      id: 'w1', name: 'Acme Engineering', slug: 'acme-eng', role: 'owner',
      // Every field of `SpaceNode` (src/types/index.ts), so a screen that reads the space's
      // workflow or write state meets the shape the API really sends.
      spaces: [{
        id: 'sp1', name: 'Payments', key: 'PAY', description: null, owner: null,
        delivery_method: null, has_charter: false, archived: false, archived_at: null,
        frozen: false, freeze_reason: null, statuses: [], can_edit_workflow: true,
        workflow: {
          version: 1, transition_mode: 'any', initial_status_id: null, wip_policy: 'warn',
          merge_action: { mode: 'none', target_status_id: null }, transitions: [],
        },
        folders: [], lists: [],
      }],
    })
  );
  await page.route('**/workspaces/*/saved-reports', (route) => json(route, []));
  await page.route('**/workspaces/*/report-jobs', (route) => json(route, []));
  await page.route(/\/workspaces\/[^/]+\/reports\/(?!catalog)[^/?]+(\?.*)?$/, (route) => {
    const params = new URL(route.request().url()).searchParams;
    return json(route, reportResult(params));
  });
  await page.route('**/workspaces/*/reports/catalog', (route) => json(route, REPORT_CATALOG));
  await page.route('**/workspaces/*/reports/*/export', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/csv',
      headers: { 'Content-Disposition': 'attachment; filename="time-by-group.csv"', 'X-Report-Rows': '2' },
      body: 'Group,Time\nAda Lovelace,2.50\n',
    })
  );
}

const timeParams = ['scope', 'preset', 'date_from', 'date_to', 'group_by', 'user_ids', 'billable'];

export const REPORT_CATALOG = {
  reports: [
    { type: 'timesheet', title: 'Timesheet', category: 'time', description: 'Time per person and day.', dates: 'time', params: timeParams, chart: 'stacked_bar', needs_sprints: false, max_days: 92 },
    { type: 'time_by_group', title: 'Time by group', category: 'time', description: 'Time grouped two levels deep.', dates: 'time', params: timeParams, chart: 'bar', needs_sprints: false, max_days: 92 },
    { type: 'project_overview', title: 'Project overview', category: 'project', description: 'Where a project stands.', dates: 'range', params: ['scope', 'preset', 'date_from', 'date_to'], chart: 'donut', needs_sprints: false, max_days: 366 },
    { type: 'velocity', title: 'Velocity', category: 'sprint', description: 'Committed and completed per sprint.', dates: 'none', params: ['scope', 'unit', 'sprint_count'], chart: 'grouped_bar', needs_sprints: false, max_days: null },
  ],
  can_view: true,
  export_formats: ['csv', 'xlsx', 'pdf'],
  can_schedule: true,
  can_manage_sprints: true,
  presets: ['today', 'yesterday', 'this_week', 'last_week', 'this_month', 'last_month', 'last_30_days', 'this_quarter', 'last_quarter', 'this_year', 'custom'],
  limits: { max_sync_rows: 5000 },
  settings: { timezone: 'UTC', working_days: [0, 1, 2, 3, 4], guest_access: false, export_min_role: 'member', schedule_min_role: 'admin', sprint_manage_role: 'admin' },
};

function reportResult(params: URLSearchParams) {
  return {
    meta: {
      type: 'time_by_group', title: 'Time by group', scope: params.get('scope') ?? 'workspace', scope_name: 'Acme Engineering',
      date_from: params.get('date_from') ?? '2026-10-05', date_to: params.get('date_to') ?? '2026-10-11',
      timezone: 'UTC', week_start: 'monday', generated_at: '2026-10-05T10:00:00', rounding_minutes: 0, rounding_mode: 'nearest',
      restricted_to_own: false, notes: [], row_count: 3, cached: false,
    },
    columns: [
      { key: 'label', label: 'Group', type: 'string' },
      { key: 'seconds', label: 'Time', type: 'duration' },
    ],
    rows: [
      { label: 'Ada Lovelace', seconds: 9000, _depth: 0, _key: 'u1', _drill: { user_ids: ['u1'] } },
      { label: 'Payments', seconds: 5400, _depth: 1, _key: 'u1|p1' },
      { label: 'Search', seconds: 3600, _depth: 1, _key: 'u1|p2' },
    ],
    totals: { seconds: 9000 },
    chart: { kind: 'bar', x: ['Ada Lovelace', 'Grace Hopper'], series: [{ key: 'seconds', label: 'Time', values: [9000, 3600] }], unit: 'duration' },
    kpis: [{ key: 'total', label: 'Total time', value: 9000, type: 'duration' }],
    sections: [],
  };
}

