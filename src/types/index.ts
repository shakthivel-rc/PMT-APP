import type { SprintSummary } from './sprints';


// --- User & Auth Types ---

export interface UserRole {
  role_id: string;
  role_name: string;
}

export interface UserPermission {
  permission_name: string;
  machine_name: string;
}

export interface User {
  id: string;
  first_name: string;
  last_name: string;
  username: string;
  email: string;
  organization: string;
  department: string;
  status: boolean;
  roles: UserRole[];
  permissions: UserPermission[];
  avatarUrl?: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
}

export function getDisplayName(user: User): string {
  return `${user.first_name} ${user.last_name}`.trim();
}

export function hasPermission(user: User | null, machineNames: string[]): boolean {
  if (!user) return false;
  return machineNames.every(name =>
    user.permissions.some(p => p.machine_name === name)
  );
}

export function getUserRoleName(user: User): string {
  return user.roles[0]?.role_name || 'No Role';
}

// --- Activity Log Types ---

/** The API's `activity_logs.action`, lower-cased (`controllers/activity_log_controller.py`). */
export type ActivityType = 'create' | 'update' | 'delete' | 'login' | 'logout' | 'security';

export interface ActivityLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  details: string;
  type: ActivityType;
  timestamp: string;
  ipAddress?: string;
}

// --- RBAC Types ---

export interface Permission {
  id: string;
  permission_name: string;
  machine_name: string;
}

export interface RoleDefinition {
  id: string;
  name: string;
  permissions: { id: string; permission_name: string }[];
}

/**
 * The envelope the `src/actions/` helpers return.
 *
 * Declared once here rather than byte-identically in both action modules, which is how it
 * was. The directory's Next.js-server-actions shape is residue from an earlier iteration —
 * it is ordinary client code and stays wired up — but the duplicated type was the kind of
 * thing that drifts silently.
 */
export type ActionResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

// --- Project management types ---
//
// Hand-maintained mirrors of the API's pydantic models, one interface per model and with the
// model's own name so a grep finds both halves: payloads from
// `pmt-api/schemas/responses/{workspaces,issues,ai}.py`, request bodies from
// `pmt-api/schemas/{workspaces,issues}.py`. There is no generated client, so nothing fails
// when the two drift — change them together. Field names stay snake_case, exactly as they
// travel, because a mapping layer is one more place for a field to be renamed on one side
// only; the `src/api/` modules for these routes therefore return `data` untouched.
//
// Datetimes and dates arrive as ISO strings. Read a datetime through
// `lib/datetime.ts:parseServerDate`, which copes with the offset-less form the base API emits.
//
// The string unions below are the values each model's `Field(description=…)` enumerates.
// The server types them as plain `str`, so a value outside a union is a contract change, and
// every renderer here falls back to showing the raw string rather than assuming the union is
// closed.

/** `WorkspaceRole` in `schemas/workspaces.py`, lowest to highest. */
export type WorkspaceRole = 'guest' | 'member' | 'admin' | 'owner';

export interface WorkspaceSummary {
  id: string;
  name: string;
  slug: string;
  /** The caller's role in this workspace. */
  role: WorkspaceRole;
}

/**
 * What reports and automations reason about, whatever the column is called. `canceled` is
 * closed but NOT delivered: it leaves the backlog and the sprint without counting toward
 * velocity, burndown "completed" or release notes (pmt-api docs/design/09-restructuring.md
 * §4.2). Only `done` is delivered; `lib/workflowRules.ts` answers the questions.
 */
export type StatusCategory = 'todo' | 'in_progress' | 'done' | 'canceled';

/** A stage's colour: a theme tone, the same six `StatusBadge` draws. Always shown with the name. */
export type StageColor = 'neutral' | 'info' | 'primary' | 'success' | 'warning' | 'danger';

export interface StatusSummary {
  id: string;
  name: string;
  category: StatusCategory;
  /** Left-to-right order on the board, ascending. */
  position: number;
  color: StageColor | string;
  /** Whether story, task and bug issues here count as work in progress. */
  counts_toward_wip: boolean;
  /** The most WIP issues the stage should hold, or null for no limit. */
  wip_limit: number | null;
}

export interface ListNode {
  id: string;
  name: string;
  /** Null when the list sits directly on its space. */
  folder_id: string | null;
  position: number;
  /**
   * The list's OWN flag. A list in an archived folder or space, or in a frozen space, is
   * read-only too — ask `containerReadOnly` rather than this field alone.
   */
  archived: boolean;
}

export interface FolderNode {
  id: string;
  name: string;
  position: number;
  /** Its own flag; its lists are read-only while it is set. */
  archived: boolean;
  /** Archived lists included, and flagged. */
  lists: ListNode[];
}

export type TransitionMode = 'any' | 'restricted';
/** What a move over a stage's WIP limit does: `warn` succeeds and says so, `block` is refused (409). */
export type WipPolicy = 'warn' | 'block';
export type MergeMode = 'status' | 'none';
export type DeliveryMethod = 'scrum' | 'kanban';

/** What a merged, linked pull request does to an issue of the space (09-restructuring.md §6). */
export interface SpaceMergeAction {
  mode: MergeMode | string;
  /**
   * The stage a merge moves issues to, in `status` mode. Null in `none` mode — and when the
   * target is no longer a live stage, in which case merges fail visibly rather than pick another.
   */
  target_status_id: string | null;
}

/** One allowed move of a `restricted` workflow. */
export interface SpaceTransition {
  /** Null for a global transition, allowed from every stage. */
  from_status_id: string | null;
  to_status_id: string;
}

/** The rules of the space's workflow, as the board needs them to check a drag before it is sent. */
export interface SpaceWorkflowSummary {
  /** Bumped by every publish; what a publish names as `base_version`. */
  version: number;
  transition_mode: TransitionMode | string;
  /** Where new issues start; in `restricted` mode the only stage a create may name. */
  initial_status_id: string | null;
  wip_policy: WipPolicy | string;
  merge_action: SpaceMergeAction;
  /** Stored transitions between live stages. Kept, and ignored, while the mode is `any`. */
  transitions: SpaceTransition[];
}

export interface SpaceNode {
  id: string;
  name: string;
  /** Issue-key prefix: `PAY` in `PAY-142`. */
  key: string;
  /** What the space is for, as prose. Rendered as text. */
  description: string | null;
  /** The accountable owner. */
  owner: PersonRef | null;
  delivery_method: DeliveryMethod | string | null;
  /** Whether any field of the creation checklist is filled in; the checklist is on `SpaceDetail`. */
  has_charter: boolean;
  /** Read-only for good, history kept, until an admin unarchives it. */
  archived: boolean;
  archived_at: string | null;
  /** Read-only for now, while it is being reorganised. */
  frozen: boolean;
  freeze_reason: string | null;
  /** The live stages, in board order. */
  statuses: StatusSummary[];
  workflow: SpaceWorkflowSummary;
  /**
   * May the caller change the workflow? Permission only: an archived or frozen space refuses
   * every publish whatever this says.
   */
  can_edit_workflow: boolean;
  folders: FolderNode[];
  lists: ListNode[];
}

/**
 * The creation checklist (`SpaceCharter` in `schemas/workspaces.py`). Every field is plain
 * text of at most 2,000 characters; the API stores a blank as null and sends every key.
 */
export interface SpaceCharter {
  objective: string | null;
  success_measure: string | null;
  delivery_team: string | null;
  scope: string | null;
  exclusions: string | null;
  access_requirements: string | null;
  reuse_justification: string | null;
  canonical_lists: string | null;
  epic_completion_criteria: string | null;
  initial_backlog: string | null;
  reporting_cadence: string | null;
  retention_policy: string | null;
  notes: string | null;
}

/** A space with its checklist and the keys it used to have — `GET`/`PATCH /spaces/{id}`. */
export interface SpaceDetail extends SpaceNode {
  /** Null when none was written. */
  charter: SpaceCharter | null;
  /** Earlier keys, oldest first. Issue keys with them still resolve here; no other space can take them. */
  key_aliases: string[];
  created_at: string;
  frozen_at: string | null;
  /** The migration plan that froze it; while that plan runs or has failed, it cannot be unfrozen by hand. */
  frozen_by_plan_id: string | null;
}

/** What happened to the workspace's deferred GitHub deliveries when a space was unfrozen. */
export interface DeferredReplaySummary {
  replayed: number;
  /** They name issues in a space that is still frozen. */
  still_deferred: number;
  /** Raised when applied; kept for an admin to look at. */
  failed: number;
}

export interface SpaceUnfreezeResult {
  space: SpaceNode;
  /** Null only when the replay itself could not run; the space is unfrozen either way. */
  replay: DeferredReplaySummary | null;
}

/** A GitHub delivery held back because it named an issue in a frozen space (admins only). */
export interface DeferredDelivery {
  /** GitHub's `X-GitHub-Delivery` id — what its webhook log shows. */
  id: string;
  event: string;
  received_at: string;
  /** Which frozen space held it back. */
  note: string | null;
  /** The issue keys the pull request names, as written in it. */
  keys: string[];
}

/** `workspaces.settings.governance` (09-restructuring.md §3.3). */
export interface GovernanceSettings {
  /** A new space needs an owner, a delivery method, an objective, a success measure and a reuse justification. */
  require_space_charter: boolean;
  /** A new epic (or an issue re-typed to one) needs an assignee — its owner — and completion criteria. */
  require_epic_owner_and_criteria: boolean;
  /** A built-in key (`default`, `delivery`, `support`) or a workspace template id. */
  default_workflow_template: string;
  /** Days without activity before the inventory calls a container inactive (7–3650). */
  inactive_after_days: number;
}

export type GovernanceSettingsUpdate = Partial<GovernanceSettings>;

/** A workspace and its whole hierarchy: one read draws the sidebar. */
export interface WorkspaceTree {
  id: string;
  name: string;
  slug: string;
  role: WorkspaceRole;
  spaces: SpaceNode[];
}

export interface MemberSummary {
  /** What `assignee_id` takes. */
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: WorkspaceRole;
}

export interface RepositorySummary {
  id: string;
  provider: string;
  /** `owner/name`. */
  full_name: string;
  created_at: string;
}

export type IssueType = 'epic' | 'story' | 'task' | 'subtask' | 'bug';
export type IssuePriority = 'urgent' | 'high' | 'medium' | 'low' | 'none';
export type PullRequestState = 'open' | 'closed' | 'merged';

export interface UserRef {
  id: string;
  /** `First Last`. */
  display_name: string;
}

/** `PersonRef` in `schemas/responses/workspaces.py`: the same two fields as `UserRef`. */
export type PersonRef = UserRef;

/**
 * An issue at the depth every view draws it. The board, the list and any later view are
 * groupings of this one shape — which is what lets a view switch regroup data already held
 * instead of fetching again.
 */
export interface IssueCard {
  id: string;
  /** Human key, `PAY-142`. */
  key: string;
  type: IssueType;
  title: string;
  status_id: string;
  list_id: string;
  parent_id: string | null;
  priority: IssuePriority;
  story_points: number | null;
  /** Time estimate in seconds, or null. "Remaining" is derived from it, never stored. */
  time_estimate_seconds: number | null;
  /** Seconds logged on this issue itself — not its children's (the drawer has the roll-up). */
  time_spent_seconds: number;
  assignee: UserRef | null;
  /** Sort key within the column. Opaque: never parse it or compute one client-side. */
  rank: string;
  start_date: string | null;
  due_date: string | null;
  /** The most advanced linked PR, or null when none is linked. */
  pull_request_state: PullRequestState | null;
  /** Echo on PATCH; a stale one is a 409. */
  version: number;
  /** The sprint the issue is in now, or null for the backlog. */
  sprint_id: string | null;
  /**
   * Sort key within the space's backlog — one order over the whole space, kept apart from
   * `rank`. Opaque, like `rank`: compare as strings, never compute one.
   */
  backlog_rank: string;
  /** Blocked work stays in its stage and still counts toward WIP; this flag makes it visible. */
  blocked: boolean;
  /** What blocks it, who owns the blocker and the next action; null unless blocked. */
  blocked_reason: string | null;
  /** When it entered its current stage — the work-item age a Kanban team inspects. */
  status_entered_at: string | null;
}

export interface VcsLinkSummary {
  id: string;
  kind: 'pull_request' | 'branch' | 'commit';
  /** `owner/name#123` for a pull request. */
  external_id: string;
  url: string;
  title: string | null;
  state: PullRequestState | null;
  author_login: string | null;
  updated_at: string;
}

export interface IssueDetail extends IssueCard {
  /** Markdown source. Rendered as text, never as HTML. */
  description: string | null;
  space_id: string;
  reporter: UserRef;
  /** What must be true for it to be done — an epic's Definition of Done. Rendered as text. */
  completion_criteria: string | null;
  /** Keys it had before it moved to another space, oldest first. They still resolve to it. */
  previous_keys: string[];
  blocked_at: string | null;
  blocked_by: UserRef | null;
  children: IssueCard[];
  /** Newest first. */
  links: VcsLinkSummary[];
  created_at: string;
  updated_at: string;
}

export interface IssuePage {
  records: IssueCard[];
  /** Matches across ALL pages, not the length of `records`. */
  total: number;
}

/** A column's work in progress, counted for the team rather than for whoever is looking. */
export interface ColumnWip {
  /** Story, task and bug issues in the stage across the whole space, whatever the scope and filters. */
  count: number;
  /** Null when the stage has no limit or does not count toward WIP. */
  limit: number | null;
  /** `count` is above `limit`. */
  over_limit: boolean;
}

export interface BoardColumn {
  status: StatusSummary;
  /** Never narrowed by filters. */
  wip: ColumnWip;
  /** Top to bottom, ascending rank. */
  cards: IssueCard[];
}

/** One allowed move of a restricted workflow, as the board carries it. */
export interface BoardTransition {
  /** Null for a global transition: from any stage. */
  from_status_id: string | null;
  to_status_id: string;
}

export interface Board {
  /** What `scope_id` names: a list, a whole space (every list), or a sprint (across lists). */
  scope: 'list' | 'space' | 'sprint';
  scope_id: string;
  /** The space whose workflow the columns are. */
  space_id: string;
  transition_mode: TransitionMode | string;
  /** Where new issues start; in a restricted workflow the only stage a create may name. */
  initial_status_id: string | null;
  /** Consulted only while `transition_mode` is `restricted`; a reorder inside a stage is always allowed. */
  transitions: BoardTransition[];
  wip_policy: WipPolicy | string;
  /** Whether any filter narrowed the cards. */
  filtered: boolean;
  /** Cards returned, across every column. */
  total: number;
  /** Every status of the space, left to right, including empty ones. */
  columns: BoardColumn[];
}

/** A sprint in the backlog view, with its issues in backlog order. */
export interface SprintPlan {
  sprint: SprintSummary;
  cards: IssueCard[];
}

/** The ordered backlog: open story, task and bug issues of the space in no sprint. */
export interface BacklogCards {
  /** At most 500. */
  cards: IssueCard[];
  /** Including any past the first 500. */
  total: number;
  /** More matched than came back; filter to narrow it. */
  truncated: boolean;
}

/** A space's planning view: its open sprints, then its ordered backlog. */
export interface Backlog {
  space_id: string;
  /** The active sprint first, then planned sprints, oldest first. */
  sprints: SprintPlan[];
  backlog: BacklogCards;
  /** The space's open epics, for filtering by `epic_id`. Never narrowed by filters. */
  epics: IssueCard[];
}

/** Where a key — current or old — points now: what a deep link opens. */
export interface IssueKeyResolution {
  issue: IssueCard;
  list_id: string;
  space_id: string;
  /** Redirect a link that used another. */
  current_key: string;
  resolved_via: 'current' | 'space_alias' | 'issue_alias' | string;
}

export interface CommentSummary {
  id: string;
  author: UserRef;
  /** Markdown source. Rendered as text, never as HTML. */
  body: string;
  created_at: string;
  updated_at?: string | null;
  attachments?: IssueAttachment[];
}

export interface ActionItem {
  /** A name as the thread spells it — never an account id — or null. */
  owner: string | null;
  text: string;
}

/**
 * Model output built from user-written input. Every part is rendered as plain text in its
 * own place: treating any of it as HTML or markdown would hand whoever wrote a comment a way
 * to put markup on everyone else's screen.
 */
export interface ThreadSummary {
  tldr: string;
  decisions: string[];
  open_questions: string[];
  action_items: ActionItem[];
}

/** `succeeded` and `failed` are terminal; stop polling on either. */
export type AIJobStatus = 'queued' | 'running' | 'succeeded' | 'failed';

export interface AIJobSummary {
  id: string;
  kind: string;
  subject_id: string;
  status: AIJobStatus;
  /** Present once `succeeded`. */
  result: ThreadSummary | null;
  /** Present once `failed`, and written to be shown. */
  error: string | null;
  model: string | null;
  /** The thread had not changed, so an earlier answer was reused. */
  cached: boolean;
  created_at: string;
  finished_at: string | null;
}

// Request bodies. Optional here means "may be omitted", which the API treats differently from
// an explicit null on `IssueUpdate`: omitted leaves the field alone, null clears it.

export interface WorkspaceCreate {
  name: string;
  /** Lower-case, URL-safe, globally unique: `^[a-z0-9][a-z0-9-]*[a-z0-9]$`, 2–50 characters. */
  slug: string;
}

export interface MemberAdd {
  /** An account that already exists. */
  email: string;
  role?: WorkspaceRole;
}

/** Only the fields present change, and at least one must be: an empty body is a 422. */
export interface WorkspaceUpdate {
  name?: string;
  /** As `WorkspaceCreate.slug`. A deleted workspace keeps its slug, so it can be taken by one nobody sees. */
  slug?: string;
}

/** Only an owner gives or takes away `owner`, and the last owner keeps it (409). */
export interface MemberUpdate {
  role: WorkspaceRole;
}

export interface SpaceCreate {
  name: string;
  /** 2–10 upper-case letters or digits, starting with a letter. A key another space used to have stays reserved. */
  key: string;
  description?: string | null;
  /** The accountable owner: a member's user id. */
  owner_id?: string | null;
  delivery_method?: DeliveryMethod | null;
  /** The creation checklist. Required items, when the workspace requires them, come back in a 422's `data.missing`. */
  charter?: Partial<SpaceCharter> | null;
  /** `default` | `delivery` | `support` | `builtin:<key>` | a workspace template id. Omitted: the governance default. */
  workflow_template?: string | null;
  /** Up to 10 list names, created in order at the space root. */
  initial_lists?: string[];
}

/** Only the fields present change; null clears the nullable ones. */
export interface SpaceUpdate {
  name?: string;
  /** A new key keeps the old one resolving and reserved; every issue key changes with it. */
  key?: string;
  description?: string | null;
  owner_id?: string | null;
  delivery_method?: DeliveryMethod | null;
  /** Replaces the whole checklist: fields left out are cleared, so a form sends what it shows. */
  charter?: Partial<SpaceCharter> | null;
}

export interface SpaceFreeze {
  /** Shown to everyone who meets the read-only space. */
  reason: string;
}

export interface FolderCreate {
  name: string;
}

export interface FolderUpdate {
  name?: string;
  position?: number;
}

export interface ListCreate {
  space_id: string;
  folder_id?: string | null;
  name: string;
}

/** Rename, reorder or reparent a list within its space. Moving it to another space is a transfer. */
export interface ListUpdate {
  name?: string;
  /** A folder of the same space, or null for the space root. */
  folder_id?: string | null;
  position?: number;
}

export interface RepositoryLink {
  full_name: string;
}

export interface IssueCreate {
  list_id: string;
  type?: IssueType;
  title: string;
  description?: string | null;
  parent_id?: string | null;
  /**
   * Default: the space's initial stage. In a restricted workflow only the initial stage is
   * accepted (422 otherwise); in a free one, any live stage — the board's quick-add.
   */
  status_id?: string | null;
  /** An epic's owner, when the workspace requires one. */
  assignee_id?: string | null;
  priority?: IssuePriority;
  story_points?: number | null;
  time_estimate_seconds?: number | null;
  due_date?: string | null;
  /** Required for an epic when the workspace requires epic owners and criteria. */
  completion_criteria?: string | null;
}

export interface IssueUpdate {
  /** The `version` that was read. */
  version: number;
  title?: string;
  description?: string | null;
  type?: IssueType;
  parent_id?: string | null;
  assignee_id?: string | null;
  priority?: IssuePriority;
  story_points?: number | null;
  time_estimate_seconds?: number | null;
  due_date?: string | null;
  /** An epic that has criteria cannot lose them. */
  completion_criteria?: string | null;
  /** Never null. Blocking needs a `blocked_reason`; unblocking clears it. */
  blocked?: boolean;
  /** What blocks it, who owns the blocker, the next action. A blank reason on blocked work is a 422. */
  blocked_reason?: string | null;
}

/** A drop on the board: the column, and the two cards the issue now sits between. */
export interface IssueMove {
  status_id: string;
  /** The card now directly ABOVE the moved one, or null for the top. */
  after_id: string | null;
  /** The card now directly BELOW the moved one, or null for the bottom. */
  before_id: string | null;
}

/** A drop in the backlog: the two issues it now sits between. Planning only — no version bump. */
export interface BacklogRank {
  after_id: string | null;
  before_id: string | null;
}

export interface CommentCreate {
  body: string;
  attachment_ids?: string[];
}

export interface CommentUpdate {
  body: string;
  attachment_ids?: string[];
}

// ---- time tracking (`routes/time_tracking.py` in pmt-api) --------------------------------
//
// Durations are whole SECONDS everywhere; the server never rounds, so a sum of entries is the
// sum a person gets adding them up. `work_date` is a calendar day (`YYYY-MM-DD`) in the
// logger's own time zone: read it as a date key, never through `parseServerDate`.

export type TimeVisibility = 'everyone' | 'own';
export type WeekStart = 'monday' | 'sunday';

/** `workspaces.settings.time_tracking`. Every field has a server-side default. */
export interface TimeTrackingSettings {
  /** Off: nobody logs or runs a timer here; logged time stays readable. */
  enabled: boolean;
  /** What `1d` means when typing a duration. */
  hours_per_day: number;
  /** What `1w` means when typing a duration. */
  days_per_week: number;
  /** `own`: members see only their own entries; admins see everyone's. */
  visibility: TimeVisibility;
  week_start: WeekStart;
  /** Whether new time is billable unless the person logging it says otherwise. */
  billable_default: boolean;
}

export type TimeTrackingSettingsUpdate = Partial<TimeTrackingSettings>;

/** Enough of an issue to name it and open it from anywhere (`?issue=` on its list). */
export interface TimeIssueRef {
  id: string;
  workspace_id: string;
  list_id: string;
  key: string;
  title: string;
}

export interface TimeEntrySummary {
  id: string;
  issue: TimeIssueRef;
  /** Who did the work. */
  user: UserRef;
  /** Who typed it in — differs from `user` when an admin logged on their behalf. */
  created_by: UserRef;
  work_date: string;
  /** UTC, naive on the wire; null when the logger did not say. */
  started_at: string | null;
  duration_seconds: number;
  /** Plain text. Rendered as text, never as HTML. */
  note: string | null;
  /** Billable to a client. New entries take the workspace's `billable_default`. */
  billable: boolean;
  source: 'manual' | 'timer' | 'automation' | string;
  created_at: string;
  updated_at: string;
  /** Whether the caller may change or delete it. The API decides; this side only hides. */
  can_edit: boolean;
}

export interface TimeEntryPage {
  records: TimeEntrySummary[];
  /** Across ALL pages. */
  total: number;
  total_seconds: number;
}

export interface UserTime {
  user: UserRef;
  seconds: number;
}

/** An issue's own time and its roll-up over every descendant, kept apart on purpose. */
export interface IssueTimeSummary {
  spent_seconds: number;
  rollup_spent_seconds: number;
  estimate_seconds: number | null;
  rollup_estimate_seconds: number | null;
  /** Estimate minus own time, floored at zero; null without an estimate. */
  remaining_seconds: number | null;
  entry_count: number;
  /** Most first. Under `own` visibility a member gets only their own line. */
  by_user: UserTime[];
}

/** Everything the drawer's time panel draws, in one read. */
export interface IssueTimeTracking {
  summary: IssueTimeSummary;
  /** Newest first, at most 200. */
  entries: TimeEntrySummary[];
  entries_total: number;
  settings: TimeTrackingSettings;
  can_log: boolean;
  can_log_for_others: boolean;
}

export interface ActiveTimerSummary {
  issue: TimeIssueRef;
  started_at: string;
  /** Measured by the server as it answered. Tick from this, never from `started_at`. */
  elapsed_seconds: number;
  work_date: string;
  note: string | null;
}

export interface TimerStartResult {
  timer: ActiveTimerSummary;
  /** Saved from the timer that was running before, if any. */
  stopped_entry: TimeEntrySummary | null;
}

export interface TimerStopResult {
  /** Null when nothing was running, or the timer could no longer be saved and was discarded. */
  entry: TimeEntrySummary | null;
  /** The timer ran past a day and the entry was cut to one day. */
  capped: boolean;
}

export interface TimeReportRow {
  user: UserRef;
  issue: TimeIssueRef;
  work_date: string;
  seconds: number;
}

export interface TimeReport {
  date_from: string;
  date_to: string;
  total_seconds: number;
  rows: TimeReportRow[];
  truncated: boolean;
}

export interface TimeEntryCreate {
  duration_seconds: number;
  work_date: string;
  /** With an offset (`toISOString()`): the API refuses a naive time rather than guess. */
  started_at?: string | null;
  note?: string | null;
  /** Admins only: log on someone else's behalf. */
  user_id?: string;
  /** Omitted: the workspace's `billable_default`. */
  billable?: boolean;
}

export interface TimeEntryUpdate {
  duration_seconds?: number;
  work_date?: string;
  started_at?: string | null;
  note?: string | null;
  billable?: boolean;
}

export interface TimerStart {
  /** Today in the caller's zone — always send it; UTC's today is not theirs all day. */
  work_date?: string;
  note?: string | null;
}

/**
 * May this role create spaces, folders and lists? `admin` and `owner` only — the API refuses
 * everyone else, so offering them the form would only produce a 403.
 */
export function canManageWorkspace(role: WorkspaceRole): boolean {
  return role === 'admin' || role === 'owner';
}

/** May this role create, move and comment on issues? Everyone but `guest`, who reads. */
export function canWriteIssues(role: WorkspaceRole): boolean {
  return role !== 'guest';
}

// --- Storage & Attachment Types ---

export type StorageProvider = 'local' | 'aws_s3' | 'azure_blob';

export interface StorageSettings {
  provider: StorageProvider;
  aws_access_key_id: string;
  aws_secret_access_key: string;
  aws_bucket_name: string;
  aws_region: string;
  aws_endpoint_url?: string | null;
  azure_account_name: string;
  azure_account_key: string;
  azure_container_name: string;
  fallback_to_local: boolean;
  is_configured: boolean;
}

export interface StorageSettingsUpdate {
  provider?: StorageProvider;
  aws_access_key_id?: string;
  aws_secret_access_key?: string;
  aws_bucket_name?: string;
  aws_region?: string;
  aws_endpoint_url?: string | null;
  azure_account_name?: string;
  azure_account_key?: string;
  azure_container_name?: string;
  fallback_to_local?: boolean;
}

export interface StorageTestRequest {
  provider: StorageProvider;
  aws_access_key_id?: string;
  aws_secret_access_key?: string;
  aws_bucket_name?: string;
  aws_region?: string;
  aws_endpoint_url?: string | null;
  azure_account_name?: string;
  azure_account_key?: string;
  azure_container_name?: string;
}

export interface StorageTestResponse {
  success: boolean;
  message: string;
  provider: string;
  details?: Record<string, unknown> | null;
}

export interface IssueAttachment {
  id: string;
  workspace_id: string;
  issue_id: string;
  comment_id?: string | null;
  uploader: UserRef;
  filename: string;
  file_size: number;
  content_type: string;
  storage_provider: StorageProvider;
  is_image: boolean;
  created_at: string;
  download_url: string;
}

