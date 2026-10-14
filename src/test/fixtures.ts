import type {
  ActiveTimerSummary,
  ActivityLog,
  AIJobSummary,
  Board,
  CommentSummary,
  IssueCard,
  IssueDetail,
  IssueTimeTracking,
  RoleDefinition,
  SpaceDetail,
  SpaceNode,
  SpaceWorkflowSummary,
  StatusSummary,
  TimeEntrySummary,
  TimeReport,
  TimeTrackingSettings,
  User,
  WorkspaceSummary,
  WorkspaceTree,
} from '@/types';
import type { RootState } from '@/app/store';
import type { ReportCatalog, ReportJob, ReportResult, ReportType } from '@/types/reports';

/** A fully-populated frontend `User` (the shape `GET /users/profile` returns). */
export function makeUser(overrides: Partial<User> = {}): User {
  return {
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
    ...overrides,
  };
}

export function makeActivityLog(overrides: Partial<ActivityLog> = {}): ActivityLog {
  return {
    id: 'a1',
    userId: 'u1',
    userName: 'Ada Lovelace',
    action: 'Logged in',
    details: 'Successful login',
    type: 'login',
    timestamp: '2026-07-24T10:00:00.000Z',
    ...overrides,
  };
}

export function makeRole(overrides: Partial<RoleDefinition> = {}): RoleDefinition {
  return {
    id: 'r1',
    name: 'Admin',
    permissions: [{ id: 'p1', permission_name: 'Manage Users' }],
    ...overrides,
  };
}

/**
 * A complete `auth` slice state for a logged-in user, so `preloadedState` never
 * leaves selector-read fields undefined. `initializing:false` renders immediately.
 */
export function loggedInState(user: User = makeUser()): Partial<RootState> {
  return {
    auth: {
      user,
      tokens: null,
      status: 'succeeded',
      error: null,
      forgotPasswordStatus: 'idle',
      resetPasswordStatus: 'idle',
      registerStatus: 'idle',
      verifyOTPStatus: 'idle',
      setPasswordRegStatus: 'idle',
      acceptInviteStatus: 'idle',
      authMessage: null,
      initializing: false,
    } satisfies RootState['auth'],
  };
}


/* ---- Project management ----
 *
 * One small, coherent world: workspace `w1` holds space `PAY` with the default four-status
 * workflow, and list `l1` whose board has three cards — two in To Do, one In Progress, and
 * an empty Done so "every status, including empty ones" is always exercised. The default
 * MSW handlers serve exactly these, so a component test only overrides what it is about.
 */

export function makeWorkspace(overrides: Partial<WorkspaceSummary> = {}): WorkspaceSummary {
  return { id: 'w1', name: 'Acme Engineering', slug: 'acme-eng', role: 'owner', ...overrides };
}

export const STATUSES: StatusSummary[] = [
  { id: 's-todo', name: 'To Do', category: 'todo', position: 0, color: 'neutral', counts_toward_wip: false, wip_limit: null },
  { id: 's-doing', name: 'In Progress', category: 'in_progress', position: 1, color: 'info', counts_toward_wip: true, wip_limit: null },
  { id: 's-review', name: 'In Review', category: 'in_progress', position: 2, color: 'info', counts_toward_wip: true, wip_limit: null },
  { id: 's-done', name: 'Done', category: 'done', position: 3, color: 'success', counts_toward_wip: false, wip_limit: null },
];

/** The default workflow's rules: free movement, new issues in To Do, merges to Done. */
export function makeWorkflowSummary(overrides: Partial<SpaceWorkflowSummary> = {}): SpaceWorkflowSummary {
  return {
    version: 1,
    transition_mode: 'any',
    initial_status_id: 's-todo',
    wip_policy: 'warn',
    merge_action: { mode: 'status', target_status_id: 's-done' },
    transitions: [],
    ...overrides,
  };
}

/** Space `PAY`: writable, owned, Scrum, with folder `f1` (list `l2`) and root list `l1`. */
export function makeSpace(overrides: Partial<SpaceNode> = {}): SpaceNode {
  return {
    id: 'sp1',
    name: 'Payments',
    key: 'PAY',
    description: null,
    owner: { id: 'u1', display_name: 'Ada Lovelace' },
    delivery_method: 'scrum',
    has_charter: false,
    archived: false,
    archived_at: null,
    frozen: false,
    freeze_reason: null,
    statuses: STATUSES,
    workflow: makeWorkflowSummary(),
    can_edit_workflow: true,
    folders: [
      {
        id: 'f1',
        name: 'Q4 initiatives',
        position: 0,
        archived: false,
        lists: [{ id: 'l2', name: 'Refunds', folder_id: 'f1', position: 0, archived: false }],
      },
    ],
    lists: [{ id: 'l1', name: 'Backlog', folder_id: null, position: 0, archived: false }],
    ...overrides,
  };
}

export function makeSpaceDetail(overrides: Partial<SpaceDetail> = {}): SpaceDetail {
  return {
    ...makeSpace(),
    charter: null,
    key_aliases: [],
    created_at: '2026-09-01T10:00:00Z',
    frozen_at: null,
    frozen_by_plan_id: null,
    ...overrides,
  };
}

export function makeTree(overrides: Partial<WorkspaceTree> = {}): WorkspaceTree {
  return {
    id: 'w1',
    name: 'Acme Engineering',
    slug: 'acme-eng',
    role: 'owner',
    spaces: [makeSpace()],
    ...overrides,
  };
}

export function makeIssueCard(overrides: Partial<IssueCard> = {}): IssueCard {
  return {
    id: 'i1',
    key: 'PAY-1',
    type: 'story',
    title: 'Refund to original card',
    status_id: 's-todo',
    list_id: 'l1',
    parent_id: null,
    priority: 'high',
    story_points: 5,
    time_estimate_seconds: null,
    time_spent_seconds: 0,
    assignee: { id: 'u1', display_name: 'Ada Lovelace' },
    rank: 'a0',
    start_date: null,
    due_date: null,
    pull_request_state: 'open',
    version: 1,
    sprint_id: null,
    backlog_rank: 'a0',
    blocked: false,
    blocked_reason: null,
    status_entered_at: '2026-09-28T10:00:00Z',
    ...overrides,
  };
}

const NO_WIP = { count: 0, limit: null, over_limit: false };

export function makeBoard(): Board {
  const [todo, doing, review, done] = STATUSES;
  return {
    scope: 'list',
    scope_id: 'l1',
    space_id: 'sp1',
    transition_mode: 'any',
    initial_status_id: 's-todo',
    transitions: [],
    wip_policy: 'warn',
    filtered: false,
    total: 3,
    columns: [
      {
        status: todo,
        wip: { count: 2, limit: null, over_limit: false },
        cards: [
          makeIssueCard(),
          makeIssueCard({
            id: 'i2',
            key: 'PAY-2',
            type: 'bug',
            title: '3DS redirect drops the cart id',
            priority: 'urgent',
            story_points: null,
            assignee: null,
            rank: 'a1',
            pull_request_state: null,
          }),
        ],
      },
      {
        status: doing,
        wip: { count: 1, limit: null, over_limit: false },
        cards: [
          makeIssueCard({
            id: 'i3',
            key: 'PAY-3',
            type: 'task',
            title: 'Ledger reconciliation job',
            status_id: 's-doing',
            priority: 'medium',
            story_points: 3,
            assignee: { id: 'u2', display_name: 'Grace Hopper' },
            pull_request_state: 'merged',
          }),
        ],
      },
      { status: review, wip: NO_WIP, cards: [] },
      { status: done, wip: NO_WIP, cards: [] },
    ],
  };
}

export function makeIssueDetail(overrides: Partial<IssueDetail> = {}): IssueDetail {
  return {
    ...makeIssueCard(),
    description: 'As a customer I want my refund\n  on the card I paid with.',
    space_id: 'sp1',
    reporter: { id: 'u1', display_name: 'Ada Lovelace' },
    completion_criteria: null,
    previous_keys: [],
    blocked_at: null,
    blocked_by: null,
    children: [makeIssueCard({ id: 'i9', key: 'PAY-9', type: 'subtask', title: 'Wire the refund API', parent_id: 'i1' })],
    links: [
      {
        id: 'v1',
        kind: 'pull_request',
        external_id: 'acme/payments#42',
        url: 'https://github.com/acme/payments/pull/42',
        title: 'Refund to original card',
        state: 'open',
        author_login: 'ada',
        updated_at: '2026-09-28T10:00:00Z',
      },
    ],
    created_at: '2026-09-27T10:00:00Z',
    updated_at: '2026-09-28T10:00:00Z',
    ...overrides,
  };
}

export function makeComment(overrides: Partial<CommentSummary> = {}): CommentSummary {
  return {
    id: 'c1',
    author: { id: 'u2', display_name: 'Grace Hopper' },
    body: 'Reproduced on staging.',
    created_at: '2026-09-28T09:00:00Z',
    attachments: [],
    ...overrides,
  };
}

export function makeAIJob(overrides: Partial<AIJobSummary> = {}): AIJobSummary {
  return {
    id: 'job1',
    kind: 'summarize_issue_thread',
    subject_id: 'i1',
    status: 'queued',
    result: null,
    error: null,
    model: null,
    cached: false,
    created_at: '2026-09-28T10:00:00Z',
    finished_at: null,
    ...overrides,
  };
}

// ---- time tracking ---------------------------------------------------------------------

export function makeTimeSettings(overrides: Partial<TimeTrackingSettings> = {}): TimeTrackingSettings {
  return { enabled: true, hours_per_day: 8, days_per_week: 5, visibility: 'everyone', week_start: 'monday', billable_default: true, ...overrides };
}

export function makeTimeEntry(overrides: Partial<TimeEntrySummary> = {}): TimeEntrySummary {
  return {
    id: 't1',
    issue: { id: 'i1', workspace_id: 'w1', list_id: 'l1', key: 'PAY-1', title: 'Refund to original card' },
    user: { id: 'u1', display_name: 'Ada Lovelace' },
    created_by: { id: 'u1', display_name: 'Ada Lovelace' },
    work_date: '2026-10-01',
    started_at: null,
    duration_seconds: 5400,
    note: 'Reproduced the 3DS bug',
    source: 'manual',
    billable: true,
    created_at: '2026-10-01T10:00:00',
    updated_at: '2026-10-01T10:00:00',
    can_edit: true,
    ...overrides,
  };
}

/** The drawer's time panel for `i1`: 1h 30m logged by Ada against a 4h estimate. */
export function makeIssueTime(overrides: Partial<IssueTimeTracking> = {}): IssueTimeTracking {
  return {
    summary: {
      spent_seconds: 5400,
      rollup_spent_seconds: 5400,
      estimate_seconds: 14_400,
      rollup_estimate_seconds: 14_400,
      remaining_seconds: 9000,
      entry_count: 1,
      by_user: [{ user: { id: 'u1', display_name: 'Ada Lovelace' }, seconds: 5400 }],
    },
    entries: [makeTimeEntry()],
    entries_total: 1,
    settings: makeTimeSettings(),
    can_log: true,
    can_log_for_others: true,
    ...overrides,
  };
}

export function makeTimer(overrides: Partial<ActiveTimerSummary> = {}): ActiveTimerSummary {
  return {
    issue: { id: 'i1', workspace_id: 'w1', list_id: 'l1', key: 'PAY-1', title: 'Refund to original card' },
    started_at: '2026-10-05T09:00:00',
    elapsed_seconds: 125,
    work_date: '2026-10-05',
    note: null,
    ...overrides,
  };
}

export function makeTimeReport(overrides: Partial<TimeReport> = {}): TimeReport {
  const issue = { id: 'i1', workspace_id: 'w1', list_id: 'l1', key: 'PAY-1', title: 'Refund to original card' };
  return {
    date_from: '2026-09-28',
    date_to: '2026-10-04',
    total_seconds: 9000,
    rows: [
      { user: { id: 'u1', display_name: 'Ada Lovelace' }, issue, work_date: '2026-09-28', seconds: 5400 },
      { user: { id: 'u1', display_name: 'Ada Lovelace' }, issue, work_date: '2026-09-30', seconds: 3600 },
    ],
    truncated: false,
    ...overrides,
  };
}

/** A report in the catalogue: the timesheet by default. */
export function makeReportType(overrides: Partial<ReportType> = {}): ReportType {
  return {
    type: 'timesheet',
    title: 'Timesheet',
    category: 'time',
    description: 'Time per person and day.',
    dates: 'time',
    params: ['scope', 'preset', 'date_from', 'date_to', 'user_ids', 'billable', 'rounding_minutes', 'rounding_mode'],
    chart: 'stacked_bar',
    needs_sprints: false,
    max_days: 92,
    ...overrides,
  };
}

/** The catalogue an owner of `w1` sees. */
export function makeReportCatalog(overrides: Partial<ReportCatalog> = {}): ReportCatalog {
  return {
    reports: [
      makeReportType(),
      makeReportType({
        type: 'time_by_group',
        title: 'Time by group',
        description: 'Time grouped two levels deep.',
        params: ['scope', 'preset', 'date_from', 'date_to', 'group_by', 'billable'],
        chart: 'bar',
      }),
      makeReportType({
        type: 'velocity',
        title: 'Velocity',
        category: 'sprint',
        description: 'Committed and completed per sprint.',
        dates: 'none',
        params: ['scope', 'unit', 'sprint_count'],
        chart: 'grouped_bar',
        needs_sprints: false,
        max_days: null,
      }),
    ],
    can_view: true,
    export_formats: ['csv', 'xlsx', 'pdf'],
    can_schedule: true,
    can_manage_sprints: true,
    presets: ['today', 'yesterday', 'this_week', 'last_week', 'this_month', 'last_month', 'last_30_days', 'this_quarter', 'last_quarter', 'this_year', 'custom'],
    limits: { max_sync_rows: 5000 },
    settings: {
      timezone: 'UTC',
      working_days: [0, 1, 2, 3, 4],
      guest_access: false,
      export_min_role: 'member',
      schedule_min_role: 'admin',
      sprint_manage_role: 'admin',
    },
    ...overrides,
  };
}

/** A two-level time report: Ada, then her two projects. */
export function makeReportResult(overrides: Partial<ReportResult> = {}): ReportResult {
  return {
    meta: {
      type: 'time_by_group',
      title: 'Time by group',
      scope: 'workspace',
      scope_name: 'Acme',
      date_from: '2026-10-05',
      date_to: '2026-10-11',
      timezone: 'UTC',
      week_start: 'monday',
      generated_at: '2026-10-05T10:00:00',
      rounding_minutes: 0,
      rounding_mode: 'nearest',
      restricted_to_own: false,
      notes: [],
      row_count: 3,
      cached: false,
    },
    columns: [
      { key: 'label', label: 'Group', type: 'string' },
      { key: 'seconds', label: 'Time', type: 'duration' },
    ],
    rows: [
      { label: 'Ada Lovelace', seconds: 9000, _depth: 0, _key: 'u1', _drill: { user_ids: ['u1'], date_from: '2026-10-05', date_to: '2026-10-11' } },
      { label: 'Payments', seconds: 5400, _depth: 1, _key: 'u1|p1' },
      { label: 'Search', seconds: 3600, _depth: 1, _key: 'u1|p2' },
    ],
    totals: { seconds: 9000 },
    chart: { kind: 'bar', x: ['Ada Lovelace'], series: [{ key: 'seconds', label: 'Time', values: [9000] }], unit: 'duration' },
    kpis: [{ key: 'total', label: 'Total time', value: 9000, type: 'duration' }],
    sections: [],
    ...overrides,
  };
}

export function makeReportJob(overrides: Partial<ReportJob> = {}): ReportJob {
  return {
    id: 'j1',
    kind: 'export',
    report_type: 'time_by_group',
    format: 'xlsx',
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
  };
}
